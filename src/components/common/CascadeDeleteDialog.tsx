import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminQuery } from '@/services/api/adminService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Target =
  | { kind: 'course'; id: string; name: string }
  | { kind: 'batch'; id: string; name: string };

const COURSE_LINKS: { key: string; label: string; route?: string }[] = [
  { key: 'batches', label: 'Batches', route: '/batches' },
  { key: 'modules', label: 'Modules' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'materials', label: 'Materials', route: '/materials' },
  { key: 'assignments', label: 'Practice assignments', route: '/practice-assignments' },
  { key: 'certificates', label: 'Certificates', route: '/certificates' },
  { key: 'student_progress', label: 'Student progress records' },
];

const BATCH_LINKS: { key: string; label: string; route?: string }[] = [
  { key: 'students', label: 'Enrolled students' },
  { key: 'schedules', label: 'Schedules', route: '/schedule' },
  { key: 'live_classes', label: 'Live classes', route: '/live-classes' },
  { key: 'attendance', label: 'Attendance records', route: '/attendance' },
  { key: 'assignments', label: 'Practice assignments', route: '/practice-assignments' },
  { key: 'certificates', label: 'Certificates', route: '/certificates' },
  { key: 'extension_requests', label: 'Extension requests' },
];

interface Props {
  target: Target | null;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function CascadeDeleteDialog({ target, onCancel, onConfirm, isDeleting }: Props) {
  const navigate = useNavigate();
  const action = target?.kind === 'course' ? 'course_delete_impact' : 'batch_delete_impact';
  const links = target?.kind === 'course' ? COURSE_LINKS : BATCH_LINKS;

  const { data: impact, isLoading } = useQuery({
    queryKey: ['delete_impact', target?.kind, target?.id],
    queryFn: () => adminQuery(action, { id: target!.id }) as Promise<Record<string, number>>,
    enabled: !!target,
    staleTime: 0,
  });

  const total = impact ? Object.values(impact).reduce((s, n) => s + (n || 0), 0) : 0;

  return (
    <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete {target?.kind} "{target?.name}"?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent. The following linked records will also be removed:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculating impact…
            </div>
          ) : total === 0 ? (
            <p className="text-muted-foreground">No linked records found. Safe to delete.</p>
          ) : (
            <ul className="space-y-1.5">
              {links.map((l) => {
                const n = impact?.[l.key] ?? 0;
                if (!n) return null;
                return (
                  <li key={l.key} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold text-foreground">{n}</span>{' '}
                      <span className="text-muted-foreground">{l.label}</span>
                    </span>
                    {l.route && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => { navigate(l.route!); onCancel(); }}
                      >
                        View <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting || isLoading}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : `Delete ${target?.kind} & ${total} linked item${total === 1 ? '' : 's'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}