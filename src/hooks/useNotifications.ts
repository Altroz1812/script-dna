import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface UseNotificationsOptions {
  /** Max rows to keep in memory. Default 50. */
  limit?: number;
  /** Show toast popup on new arrivals (realtime INSERT). Default true. */
  toastOnInsert?: boolean;
}

interface NotificationsState {
  items: NotificationRow[];
  loading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

/**
 * Universal per-user notifications hook. Provides realtime feed,
 * unread count, and shared mark/bulk actions for any role/component.
 */
function useNotificationsSource(options: UseNotificationsOptions = {}): NotificationsState {
  const { limit = 50, toastOnInsert = true } = options;
  const { profile } = useAuth();
  const userId = profile?.id;

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && data) setItems(data as NotificationRow[]);
    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          setItems((prev) => [n, ...prev].slice(0, limit));
          if (toastOnInsert) toast(n.title, { description: n.message });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.old as Partial<NotificationRow>;
          if (n?.id) setItems((prev) => prev.filter((x) => x.id !== n.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load, limit, toastOnInsert]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) toast.error(error.message);
  }, []);

  const markUnread = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    const { error } = await supabase.from('notifications').update({ read: false }).eq('id', id);
    if (error) toast.error(error.message);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids);
    if (error) toast.error(error.message);
  }, [userId, items]);

  const remove = useCallback(async (id: string) => {
    const prev = items;
    setItems((cur) => cur.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  }, [items]);

  return {
    items,
    loading,
    unreadCount,
    refresh: load,
    markRead,
    markUnread,
    markAllRead,
    remove,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = useNotificationsSource({ limit: 100, toastOnInsert: true });
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
