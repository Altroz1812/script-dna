import { useMemo } from 'react';
import { Video, Radio, Clock, Play } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { TiltCard } from '@/components/ui/tilt-card';
import { Button } from '@/components/ui/button';
import { useClassroomSession } from '@/contexts/ClassroomSessionContext';
import { startLiveClass } from '@/services/classroom/startClass';
import { toast } from 'sonner';

export interface QuickJoinClass {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  meeting_url?: string | null;
  batches?: { name?: string | null } | null;
}

interface Props {
  classes: QuickJoinClass[];
  displayName: string;
  isTeacher: boolean;
  isAdmin: boolean;
  userId?: string | null;
  onAfterStart?: () => void;
}

export function ClassQuickJoinCards({ classes, displayName, isTeacher, isAdmin, userId, onAfterStart }: Props) {
  const { joinClass } = useClassroomSession();

  const liveNow = useMemo(
    () => classes.find((c) => c.status === 'live'),
    [classes],
  );
  const nextToday = useMemo(
    () =>
      classes
        .filter((c) => c.status === 'scheduled' && isToday(parseISO(c.scheduled_at)))
        .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())[0],
    [classes],
  );

  const canStart = isTeacher || isAdmin;

  const handleJoinLive = (c: QuickJoinClass) => {
    joinClass({
      classId: c.id,
      roomName: c.meeting_url || `class-${c.id.slice(0, 8)}`,
      displayName,
      isTeacher: isTeacher || isAdmin,
      classStatus: c.status,
    });
  };

  const handleTodayClick = async (c: QuickJoinClass) => {
    if (c.status === 'live') return handleJoinLive(c);
    if (canStart) {
      try {
        const roomName = await startLiveClass({ classId: c.id, startedBy: userId, isAdmin });
        toast.success('Class started!');
        joinClass({
          classId: c.id,
          roomName,
          displayName,
          isTeacher: true,
          classStatus: 'live',
        });
        onAfterStart?.();
      } catch {
        /* toast handled in startLiveClass */
      }
    } else {
      // Student / parent: join waiting room
      joinClass({
        classId: c.id,
        roomName: c.meeting_url || `class-${c.id.slice(0, 8)}`,
        displayName,
        isTeacher: false,
        classStatus: c.status,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Live Now */}
      <TiltCard glowColor="hsl(142 76% 50%)" className="h-[140px]">
        <div
          className={`relative h-full p-5 flex items-center justify-between bg-gradient-to-br ${
            liveNow
              ? 'from-emerald-500/40 via-emerald-600/20 to-emerald-900/10 cursor-pointer'
              : 'from-muted/40 via-muted/10 to-transparent'
          }`}
          onClick={liveNow ? () => handleJoinLive(liveNow) : undefined}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${liveNow ? 'bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-emerald-500/40' : 'bg-muted'}`}>
              <Radio className={`w-6 h-6 text-white ${liveNow ? 'animate-pulse' : 'opacity-50'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {liveNow && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Now</span>
              </div>
              {liveNow ? (
                <>
                  <h3 className="font-semibold text-foreground truncate mt-1">{liveNow.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{liveNow.batches?.name || '—'}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No class live right now</p>
              )}
            </div>
          </div>
          {liveNow && (
            <Button size="sm" className="shrink-0 gap-1" onClick={(e) => { e.stopPropagation(); handleJoinLive(liveNow); }}>
              <Video className="w-4 h-4" /> Join
            </Button>
          )}
        </div>
      </TiltCard>

      {/* Today's Class */}
      <TiltCard glowColor="hsl(265 90% 65%)" className="h-[140px]">
        <div
          className={`relative h-full p-5 flex items-center justify-between bg-gradient-to-br ${
            nextToday
              ? 'from-purple-500/40 via-purple-600/20 to-purple-900/10 cursor-pointer'
              : 'from-muted/40 via-muted/10 to-transparent'
          }`}
          onClick={nextToday ? () => handleTodayClick(nextToday) : undefined}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${nextToday ? 'bg-gradient-to-br from-purple-300 to-purple-600 shadow-purple-500/40' : 'bg-muted'}`}>
              <Clock className={`w-6 h-6 text-white ${nextToday ? '' : 'opacity-50'}`} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Class</span>
              {nextToday ? (
                <>
                  <h3 className="font-semibold text-foreground truncate mt-1">{nextToday.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(parseISO(nextToday.scheduled_at), 'hh:mm a')} · {nextToday.batches?.name || '—'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No class scheduled today</p>
              )}
            </div>
          </div>
          {nextToday && (
            <Button size="sm" variant="secondary" className="shrink-0 gap-1" onClick={(e) => { e.stopPropagation(); handleTodayClick(nextToday); }}>
              {canStart ? <><Play className="w-4 h-4" /> Start</> : <><Video className="w-4 h-4" /> Join</>}
            </Button>
          )}
        </div>
      </TiltCard>
    </div>
  );
}