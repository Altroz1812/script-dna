import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Video, Play, Square, Calendar as CalendarIcon, Clock, CheckCircle2, Radio } from 'lucide-react';
import { EndClassAttendanceDialog } from '@/components/classroom/EndClassAttendanceDialog';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/contexts/AuthContext';
import { VideoClassroom } from '@/components/classroom/VideoClassroom';
import { format, isToday, isFuture, isPast, parseISO, startOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
};

type LiveClass = {
  id: string;
  title: string;
  batch_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_url: string | null;
  schedule_id: string | null;
  batches?: { name: string; courses?: { delivery_mode?: string } | null } | null;
};

export default function LiveClassesPage() {
  const { isAdmin, role } = useRBAC();
  const { profile } = useAuth();
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const canManage = isAdmin || isTeacher;

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClassroom, setActiveClassroom] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'completed' | 'all'>('today');
  const [endingClass, setEndingClass] = useState<LiveClass | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      if (isTeacher || isStudent) {
        const { data, error } = await supabase
          .from('live_classes')
          .select('*, batches(name, courses(delivery_mode))')
          .order('scheduled_at', { ascending: true });
        if (error) throw error;
        setClasses((data as any[]) || []);
      } else {
        const c = await adminQuery('list_live_classes');
        setClasses(c);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const todaysClasses = useMemo(() => classes.filter(c => isToday(parseISO(c.scheduled_at))), [classes]);
  const upcomingClasses = useMemo(() => classes.filter(c => isFuture(parseISO(c.scheduled_at)) && !isToday(parseISO(c.scheduled_at)) && c.status !== 'completed'), [classes]);
  const completedClasses = useMemo(() => classes.filter(c => c.status === 'completed'), [classes]);
  const liveNow = useMemo(() => classes.filter(c => c.status === 'live'), [classes]);

  const filteredClasses = useMemo(() => {
    if (filter === 'today') return todaysClasses;
    if (filter === 'upcoming') return upcomingClasses;
    if (filter === 'completed') return completedClasses;
    return classes;
  }, [filter, todaysClasses, upcomingClasses, completedClasses, classes]);

  const dateClasses = useMemo(() => {
    if (!selectedDate) return [];
    return classes.filter(c => {
      const d = parseISO(c.scheduled_at);
      return startOfDay(d).getTime() === startOfDay(selectedDate).getTime();
    });
  }, [selectedDate, classes]);

  // Dates that have classes for calendar highlighting
  const classDates = useMemo(() => {
    const dates = new Set<string>();
    classes.forEach(c => dates.add(format(parseISO(c.scheduled_at), 'yyyy-MM-dd')));
    return dates;
  }, [classes]);

  const startClass = async (cls: LiveClass) => {
    try {
      const roomName = `class-${cls.id.slice(0, 8)}`;
      if (isTeacher) {
        const { error } = await supabase.from('live_classes')
          .update({ status: 'live' as any, meeting_url: roomName })
          .eq('id', cls.id);
        if (error) throw error;
      } else {
        await adminQuery('update_live_class', { id: cls.id, status: 'live', meeting_url: roomName });
      }
      toast.success('Class started!');
      setActiveClassroom(cls.id);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEndClassDialog = (cls: LiveClass) => {
    setEndingClass(cls);
  };

  const handleClassEnded = () => {
    setActiveClassroom(null);
    load();
  };

  const activeClass = classes.find(c => c.id === activeClassroom);

  const ClassCard = ({ cls }: { cls: LiveClass }) => {
    const isLive = cls.status === 'live';
    const isScheduled = cls.status === 'scheduled';
    const scheduledDate = parseISO(cls.scheduled_at);
    const canStart = canManage && isScheduled && (isToday(scheduledDate) || isPast(scheduledDate));
    const isOfflineCourse = cls.batches?.courses?.delivery_mode === 'offline';

    return (
      <Card className={`transition-all hover:shadow-md ${isLive ? 'border-green-500/50 shadow-green-500/10' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isLive && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
                <h3 className="font-semibold text-foreground truncate">{cls.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{cls.batches?.name || '—'}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(scheduledDate, 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(scheduledDate, 'hh:mm a')} · {cls.duration_minutes}m
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className={STATUS_COLORS[cls.status] || ''}>
                {cls.status}
              </Badge>
              <div className="flex gap-1.5">
                {isOfflineCourse ? (
                  <Badge variant="outline" className="h-7 text-xs">Offline — Manual Attendance</Badge>
                ) : (
                  <>
                    {canStart && (
                      <Button size="sm" className="h-7 gap-1" onClick={() => startClass(cls)}>
                        <Play className="h-3 w-3" /> Start
                      </Button>
                    )}
                    {isLive && (
                      <>
                        <Button size="sm" className="h-7 gap-1" onClick={() => setActiveClassroom(cls.id)}>
                          <Video className="h-3 w-3" /> Join
                        </Button>
                        {canManage && (
                          <Button size="sm" variant="destructive" className="h-7 gap-1" onClick={() => openEndClassDialog(cls)}>
                            <Square className="h-3 w-3" /> End
                          </Button>
                        )}
                      </>
                    )}
                    {isStudent && isLive && (
                      <Button size="sm" className="h-7 gap-1" onClick={() => setActiveClassroom(cls.id)}>
                        <Video className="h-3 w-3" /> Join
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {activeClass && (
        <VideoClassroom
          roomName={activeClass.meeting_url || `class-${activeClass.id.slice(0, 8)}`}
          displayName={profile?.displayName || (isStudent ? 'Student' : 'Teacher')}
          isTeacher={isTeacher || isAdmin}
          onClose={() => setActiveClassroom(null)}
        />
      )}

      <h1 className="text-2xl font-bold text-foreground">
        {isStudent ? 'My Classes' : isTeacher ? 'My Classes' : 'Live Classes'}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === 'today' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('today')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todaysClasses.length}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === 'upcoming' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{upcomingClasses.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${filter === 'completed' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('completed')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedClasses.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${liveNow.length > 0 ? 'border-green-500/50' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${liveNow.length > 0 ? 'bg-green-500/10' : 'bg-muted'}`}>
              <Radio className={`h-5 w-5 ${liveNow.length > 0 ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{liveNow.length}</p>
              <p className="text-xs text-muted-foreground">Live Now</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: Calendar + Class List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calendar</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setFilter('all'); }}
              modifiers={{
                hasClass: (date) => classDates.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                hasClass: 'bg-primary/20 font-bold text-primary',
              }}
              className="w-full"
            />
            {/* Selected date classes */}
            {selectedDate && dateClasses.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">{format(selectedDate, 'MMMM d, yyyy')}</p>
                {dateClasses.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                    <div className="truncate">
                      <span className="font-medium">{cls.title}</span>
                      <span className="text-muted-foreground ml-2">{format(parseISO(cls.scheduled_at), 'hh:mm a')}</span>
                    </div>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[cls.status] || ''}`}>
                      {cls.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground capitalize">
              {filter === 'all' ? 'All Classes' : `${filter} Classes`}
            </h2>
            <span className="text-sm text-muted-foreground">{filteredClasses.length} classes</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-muted/30" /></Card>
              ))}
            </div>
          ) : filteredClasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="mx-auto h-10 w-10 mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {filter === 'today' ? 'No classes scheduled for today' :
                   filter === 'upcoming' ? 'No upcoming classes' :
                   filter === 'completed' ? 'No completed classes yet' :
                   'No classes found'}
                </p>
                {(isAdmin || isTeacher) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Classes are auto-created when schedules are generated
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredClasses.map(cls => <ClassCard key={cls.id} cls={cls} />)}
            </div>
          )}
        </div>
      </div>

      <EndClassAttendanceDialog
        open={!!endingClass}
        onOpenChange={(open) => { if (!open) setEndingClass(null); }}
        liveClass={endingClass}
        isTeacher={isTeacher}
        isAdmin={isAdmin}
        onClassEnded={handleClassEnded}
      />
    </div>
  );
}
