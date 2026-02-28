import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Bell, Check, Trash2 } from 'lucide-react';
import { NotificationsSkeleton } from '@/components/ui/loading-skeletons';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '' });

  const load = () => { setLoading(true); adminQuery('list_notifications').then(setNotifications).catch(e => toast.error(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message required'); return; }
    try { await adminQuery('create_notification', { title: form.title.trim(), message: form.message.trim() }); toast.success('Notification sent'); setOpen(false); setForm({ title: '', message: '' }); load(); } catch (e: any) { toast.error(e.message); }
  };

  const markRead = async (id: string) => {
    try { await adminQuery('mark_read', { id }); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await adminQuery('delete_notification', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Send Notification</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Message</Label><Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">Send</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <NotificationsSkeleton count={4} /> : notifications.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Bell className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>No notifications</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <Card key={n.id} className={n.read ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{n.title}</h3>
                    {!n.read && <Badge variant="default" className="text-xs">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  {!n.read && <Button variant="ghost" size="icon" onClick={() => markRead(n.id)}><Check className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
