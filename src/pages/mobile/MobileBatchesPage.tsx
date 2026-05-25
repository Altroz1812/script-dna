import { useQuery } from '@tanstack/react-query';
import { Layers, Users, BookOpen } from 'lucide-react';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { batchService, type Batch } from '@/services/api/courseService';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { useNavigate } from 'react-router-dom';

export default function MobileBatchesPage() {
  const { activeOrgId } = useActiveOrg();
  const navigate = useNavigate();

  const { data: batches = [], isLoading, refetch } = useQuery<Batch[]>({
    queryKey: ['mobile_batches', activeOrgId],
    queryFn: () => batchService.listBatches(),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <MobilePage onRefresh={refetch}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">Batches</h1>
        <p className="text-xs text-muted-foreground mt-1">Your assigned student groups</p>
      </div>

      {isLoading ? (
        <div className="space-y-3"><ShimmerCard /><ShimmerCard /></div>
      ) : batches.length === 0 ? (
        <EmptyState icon={Layers} title="No batches" message="Create or assign batches on desktop." />
      ) : (
        <div className="space-y-3">
          {batches.map((b: any) => (
            <TouchPress
              key={b.id}
              onClick={() => navigate(`/batches/${b.id}`)}
              className="w-full rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    {b.course_name && (
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{b.course_name}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {b.student_count ?? 0}/{b.max_students ?? '—'} students
                  </div>
                </div>
              </div>
            </TouchPress>
          ))}
        </div>
      )}
    </MobilePage>
  );
}