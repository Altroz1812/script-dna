import { useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Bell } from 'lucide-react';
import { NotificationsSkeleton } from '@/components/ui/loading-skeletons';
import { useNotifications } from '@/hooks/useNotifications';
import { useRBAC } from '@/hooks/useRBAC';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { MarkAllReadButton } from '@/components/notifications/MarkAllReadButton';

export default function NotificationsPage() {
  const { isAdmin } = useRBAC();
  const { items, loading, markRead, markUnread, remove, refresh } = useNotifications({
    limit: 100,
    toastOnInsert: false,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '' });

  const handleCreate = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message required');
      return;
    }
    try {
      await adminQuery('create_notification', {
        title: form.title.trim(),
        message: form.message.trim(),
      });
      toast.success('Notification sent');
      setOpen(false);
      setForm({ title: '', message: '' });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <div className="flex items-center gap-2">
          <MarkAllReadButton variant="outline" />
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Send Notification
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Notification</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleCreate} className="w-full">
                    Send
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <NotificationsSkeleton count={4} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No notifications</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-white/[0.06]">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                variant="full"
                onMarkRead={markRead}
                onMarkUnread={markUnread}
                onDelete={isAdmin ? remove : undefined}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
