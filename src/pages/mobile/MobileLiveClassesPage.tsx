import { useEffect, useMemo, useState, useCallback } from 'react';
import { Video, Play, Square, Clock, CalendarDays, BookOpen, Loader2, User, Timer, Maximize2, X } from 'lucide-react';
import { format, parseISO, addMinutes, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { startLiveClass } from '@/services/classroom/startClass';
import { VideoClassroom } from '@/components/classroom/VideoClassroom';
import { EndClassAttendanceDialog } from '@/components/classroom/EndClassAttendanceDialog';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { cn } from '@/lib/utils';

type LC = any;
type Filter = 'live' | 'today' | 'upcoming' | 'past';

function classify(cls: LC, now: Date): Filter {
  if (cls.status === 'cancelled' || cls.status === 'completed') return 'past';
  if (cls.status === 'live') return 'live';
  if (!cls.scheduled_at) return 'upcoming';
  const start = parseISO(cls.scheduled_at);
  const end = addMinutes(start, cls.duration_minutes || 60);
  if (now >= start && now <= end) return 'live';
  if (isSameDay(start, now)) return 'today';
  if (start > now) return 'upcoming';
  return 'past';
}

export default function MobileLiveClassesPage() {
  const { profile } = useAuth();
  const { isAdmin, role } = useRBAC();
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const canManage = isAdmin || isTeacher;

  const [classes, setClasses] = useState<LC[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<Filter>('live');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [endingClass, setEndingClass] = useState<LC | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let raw: any[] = [];
      if (isAdmin) {
        const r = await adminQuery('list_live_classes');
        raw = Array.isArray(r) ? r : [];
      } else {
        const { data } = await supabase
          .from('live_classes')
          .select('*, batches:batch_id(name, teacher_id, courses:course_id(name, total_hours))')
          .order('scheduled_at', { ascending: true });
        raw = data || [];
      }

      const processed = raw.map((c: any) => ({
        ...c,
        status: (c.status || 'scheduled').toLowerCase(),
        batch_name: c.batch_name || c.batches?.name || '—',
        course_name: c.course_name || c.batches?.courses?.name || '—',
        course_total_hours: c.course_total_hours ?? c.batches?.courses?.total_hours ?? null,
        teacher_id_lookup: c.teacher_id || c.batches?.teacher_id || null,
        teacher_name: c.teacher_name || '—',
      }));

      // Resolve teacher display names via profiles (auth uid → user_id)
      const teacherIds = [...new Set(processed.map((c) => c.teacher_id_lookup).filter(Boolean))] as string[];
      const teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', teacherIds);
        (profs || []).forEach((p: any) => {
          teacherMap[p.user_id] = p.display_name || p.email || '—';
        });
      }

      setClasses(
        processed.map((c) => ({
          ...c,
          teacher_name:
            c.teacher_id_lookup && teacherMap[c.teacher_id_lookup]
              ? teacherMap[c.teacher_id_lookup]
              : c.teacher_name,
        })),
      );
    } catch (e: any) {
      toast.error(e.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setNow(new Date());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const out: Record<Filter, LC[]> = { live: [], today: [], upcoming: [], past: [] };
    for (const c of classes) {
      if (c.id === activeId) continue;
      out[classify(c, now)].push(c);
    }
    return out;
  }, [classes, now, activeId]);

  const activeClass = useMemo(() => classes.find((c) => c.id === activeId) || null, [classes, activeId]);

  const onStart = async (c: LC) => {
    if (!profile?.id) return;
    try {
      await startLiveClass({ classId: c.id, startedBy: profile.id, isAdmin });
      toast.success('Class started');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to start');
    }
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ];

  return (
    <MobilePage onRefresh={load}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">
          {isStudent ? 'My Classes' : isTeacher ? 'Teaching' : 'Live Classes'}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Live, today, and upcoming sessions</p>
      </div>

      {activeClass && (
        <div
          className={`fixed inset-0 z-[100] bg-black flex flex-col ${minimized ? 'invisible pointer-events-none' : 'visible'}`}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex-1 min-h-0 relative">
            <VideoClassroom
              roomName={`edu-room-${activeClass.id}`}
              displayName={profile?.displayName || profile?.email || 'User'}
              isTeacher={isTeacher}
              classStatus={activeClass.status}
              classId={activeClass.id}
              onClose={() => {
                setActiveId(null);
                setMinimized(false);
                load();
              }}
              onMinimize={() => setMinimized(true)}
              onClassStarted={load}
            />
            {canManage && (
              <button
                className="absolute top-12 right-3 z-30 text-[11px] px-3 py-1.5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
                onClick={() => setEndingClass(activeClass)}
              >
                <Square className="w-3 h-3" /> End
              </button>
            )}
          </div>
        </div>
      )}

      {activeClass && minimized && (
        <div className="fixed bottom-20 right-3 z-[110] flex items-center gap-2 bg-card/95 backdrop-blur-lg border border-border shadow-2xl rounded-full pl-3 pr-1.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <Video className="h-3.5 w-3.5 text-foreground" />
          <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
            {activeClass.title || 'In class'}
          </span>
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted"
            onClick={() => setMinimized(false)}
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <button
              className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-destructive text-destructive-foreground flex items-center gap-1"
              onClick={() => setEndingClass(activeClass)}
              title="End"
            >
              <Square className="w-3 h-3" /> End
            </button>
          )}
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-destructive/20 hover:text-destructive"
            onClick={() => { setActiveId(null); setMinimized(false); load(); }}
            title="Leave"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Segmented tabs */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-card border border-white/[0.06] sticky top-0">
        {tabs.map((t) => (
          <TouchPress
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 h-9 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
              tab === t.key
                ? 'bg-gradient-to-br from-primary/30 to-accent/20 text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {t.key === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
            {t.label}
            <span className="text-[10px] opacity-70">({grouped[t.key].length})</span>
          </TouchPress>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <ShimmerCard />
          <ShimmerCard />
        </div>
      ) : grouped[tab].length === 0 ? (
        <EmptyState icon={Video} title={`No ${tab} classes`} message="Pull down to refresh." />
      ) : (
        <div className="space-y-3">
          {grouped[tab].map((c) => {
            const status = classify(c, now);
            const isLive = status === 'live';
            const isToday = status === 'today';
            const start = c.scheduled_at ? parseISO(c.scheduled_at) : null;
            const end = start ? addMinutes(start, c.duration_minutes || 60) : null;
            const windowEnded = !!(end && now > end) && c.status !== 'live';
            const canStart = canManage && (isLive || isToday) && c.status !== 'completed';
            const canJoin = !windowEnded && (isLive || (isStudent && isToday && start && now >= addMinutes(start, -10)));
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-2xl p-4 bg-card border text-left',
                  isLive ? 'border-success/40' : isToday ? 'border-orange-500/30' : 'border-white/[0.06]',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full',
                      isLive
                        ? 'bg-success/20 text-success'
                        : isToday
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-muted/30 text-muted-foreground',
                    )}
                  >
                    {isLive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse mr-1" />}
                    {status}
                  </span>
                </div>
                <div className="font-semibold text-sm leading-snug">{c.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {c.course_name} · {c.batch_name}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.teacher_name}</span>
                  {c.duration_minutes ? (
                    <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{c.duration_minutes} min</span>
                  ) : null}
                  {c.course_total_hours ? (
                    <span className="opacity-80">Course: {c.course_total_hours}h</span>
                  ) : null}
                </div>
                {start && (
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(start, 'EEE, MMM d')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(start, 'h:mm a')}</span>
                  </div>
                )}
                {(canJoin || canStart) && (
                  <div className="flex gap-2 mt-3">
                    {canJoin && (
                      <TouchPress
                        onClick={() => setActiveId(c.id)}
                        className="flex-1 h-10 rounded-xl bg-gradient-to-r from-success to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-4 h-4" /> {isLive ? 'Join' : 'Waiting Room'}
                      </TouchPress>
                    )}
                    {canStart && !isLive && (
                      <TouchPress
                        onClick={() => onStart(c)}
                        className="flex-1 h-10 rounded-xl bg-primary/20 border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-4 h-4 fill-current" /> Start
                      </TouchPress>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EndClassAttendanceDialog
        open={!!endingClass}
        onOpenChange={(o) => { if (!o) setEndingClass(null); }}
        liveClass={endingClass}
        isTeacher={isTeacher}
        isAdmin={isAdmin}
        onClassEnded={() => { setActiveId(null); setMinimized(false); load(); }}
      />
    </MobilePage>
  );
}