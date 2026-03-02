import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TiltCard } from '@/components/ui/tilt-card';
import { TrendingUp } from 'lucide-react';

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
        <div className="p-6 bg-gradient-to-br from-purple-500/25 via-card/80 to-coral/10 relative">
          {/* Inner ambient glow */}
          <div className="absolute top-0 left-1/4 w-1/2 h-24 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-300 to-coral flex items-center justify-center shadow-lg shadow-purple-500/30">
                <TrendingUp className="w-4.5 h-4.5 text-white" />
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
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 shadow-sm shadow-purple-500/40" />
                Enrollments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-500/40" />
                Completions
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[220px] -mx-2 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(265 90% 65%)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(265 90% 65%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="completeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(165 80% 45%)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(165 80% 45%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.4}
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
                    boxShadow: '0 8px 32px hsl(var(--primary) / 0.2)',
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
