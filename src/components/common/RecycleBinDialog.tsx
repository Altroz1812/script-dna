import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminQuery } from '@/services/api/adminService';
import { Loader2, RotateCcw, Trash2, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type Kind = 'course' | 'batch';
const RETENTION_DAYS = 7;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Kind;
}

export function RecycleBinDialog({ open, onOpenChange, kind }: Props) {
  const qc = useQueryClient();
  const listAction = kind === 'course' ? 'list_deleted_courses' : 'list_deleted_batches';
  const restoreAction = kind === 'course' ? 'restore_course' : 'restore_batch';
  const purgeAction = kind === 'course' ? 'purge_course' : 'purge_batch';

  const { data: items, isLoading } = useQuery({
    queryKey: [listAction],
    queryFn: () => adminQuery(listAction) as Promise<any[]>,
    enabled: open,
    staleTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [listAction] });
    qc.invalidateQueries({ queryKey: ['courses'] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['list_courses'] });
    qc.invalidateQueries({ queryKey: ['list_batches'] });
  };

  const restore = useMutation({
    mutationFn: (id: string) => adminQuery(restoreAction, { id }),
    onSuccess: () => { toast.success(`${kind === 'course' ? 'Course' : 'Batch'} restored`); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Restore failed'),
  });

  const purge = useMutation({
    mutationFn: (id: string) => adminQuery(purgeAction, { id }),
    onSuccess: () => { toast.success('Permanently deleted'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const isExpired = (deletedAt: string) =>
    Date.now() - new Date(deletedAt).getTime() > RETENTION_DAYS * 24 * 60 * 60 * 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> {kind === 'course' ? 'Courses' : 'Batches'} Recycle Bin
          </DialogTitle>
          <DialogDescription>
            Items can be restored within {RETENTION_DAYS} days of deletion. After that, they can only be permanently removed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !items?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">Recycle bin is empty.</p>
          ) : (
            items.map((it: any) => {
              const expired = isExpired(it.deleted_at);
              return (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Deleted {formatDistanceToNow(new Date(it.deleted_at), { addSuffix: true })}
                      {it.courses?.name ? ` · ${it.courses.name}` : ''}
                      {expired ? ' · retention expired' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={expired || restore.isPending}
                      onClick={() => restore.mutate(it.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={purge.isPending}
                      onClick={() => {
                        if (confirm(`Permanently delete "${it.name}"? This cannot be undone.`)) purge.mutate(it.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}