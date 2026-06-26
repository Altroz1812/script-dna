import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { adminQuery } from "@/services/api/adminService";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export type MetricKey =
  | "users"
  | "students"
  | "teachers"
  | "courses"
  | "batches"
  | "organizations"
  | "leads"
  | "payments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricKey | null;
  label: string;
  total: number;
  targetOrgId?: string | null;
  navigatePath?: string;
}

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export function MetricDrillDownDialog({
  open,
  onOpenChange,
  metric,
  label,
  total,
  targetOrgId,
  navigatePath,
}: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["metric_breakdown", metric, targetOrgId],
    queryFn: () =>
      adminQuery("metric_breakdown", {
        metric,
        target_org_id: targetOrgId ?? undefined,
      }) as Promise<any>,
    enabled: open && !!metric,
    staleTime: 30_000,
  });

  const windows: Array<{ key: string; label: string; count: number }> = data?.windows ?? [];
  const revenue = data?.extras?.revenue;
  const roleCounts: Record<string, number> | undefined = data?.extras?.roleCounts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {label} breakdown
          </DialogTitle>
          <DialogDescription>
            Activity by time window · Total {total.toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {windows.map((w) => {
              const pct = total > 0 ? Math.min(100, Math.round((w.count / total) * 100)) : 0;
              return (
                <div
                  key={w.key}
                  className="relative rounded-lg border border-white/[0.06] bg-card/60 p-3 overflow-hidden"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/15 to-accent/10"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div className="text-sm font-medium">{w.label}</div>
                    <div className="flex items-center gap-3">
                      {revenue && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatINR(
                            w.key === "today"
                              ? revenue.today
                              : w.key === "7d"
                              ? revenue.w7
                              : w.key === "30d"
                              ? revenue.w30
                              : w.key === "90d"
                              ? revenue.w90
                              : revenue.all,
                          )}
                        </span>
                      )}
                      <span className="text-sm font-semibold tabular-nums">
                        {w.count.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {roleCounts && Object.keys(roleCounts).length > 0 && (
              <div className="pt-2">
                <div className="text-xs text-muted-foreground mb-2">By role</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(roleCounts).map(([role, count]) => (
                    <span
                      key={role}
                      className="text-xs px-2 py-1 rounded-md bg-muted/40 border border-white/[0.06]"
                    >
                      {role}: <span className="font-semibold">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {navigatePath && (
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(navigatePath);
                  }}
                >
                  Open {label} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}