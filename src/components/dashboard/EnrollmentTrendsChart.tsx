import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TiltCard } from '@/components/ui/tilt-card';
import { TrendingUp } from 'lucide-react';

// Generate realistic-looking mock trend data for the last 6 months
function generateTrendData() {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  const base = [12, 18, 15, 24, 22, 30];
  return months.map((month, i) => ({
    month,
    enrollments: base[i],
    completions: Math.round(base[i] * 0.6 + Math.random() * 4),
  }));
}

export function EnrollmentTrendsChart() {
  const data = useMemo(generateTrendData, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      <TiltCard glowColor="hsl(265 90% 65%)" className="overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-purple-500/10 via-transparent to-coral/5">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-coral flex items-center justify-center shadow-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground font-display text-sm">
                  Enrollment Trends
                </h3>
                <p className="text-xs text-muted-foreground">Last 6 months</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-purple-600" />
                Enrollments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                Completions
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[220px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(265 90% 65%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(265 90% 65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(165 80% 45%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(165 80% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px hsl(var(--primary) / 0.15)',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="enrollments"
                  stroke="hsl(265 90% 65%)"
                  strokeWidth={2.5}
                  fill="url(#enrollGrad)"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="completions"
                  stroke="hsl(165 80% 45%)"
                  strokeWidth={2.5}
                  fill="url(#completeGrad)"
                  animationDuration={1800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}
