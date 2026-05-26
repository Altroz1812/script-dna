import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Play, Square, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Users, User, UserRoundCog, Minimize2, Maximize2, Video, X, BookOpen, Loader2, Star } from 'lucide-react';
import { format, parseISO, addMinutes, isAfter, isBefore, isSameDay, differenceInMinutes } from 'date-fns';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/contexts/AuthContext';
import { startLiveClass } from '@/services/classroom/startClass';
import { EndClassAttendanceDialog } from '@/components/classroom/EndClassAttendanceDialog';
import { VideoClassroom } from '@/components/classroom/VideoClassroom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileLiveClassesPage from './mobile/MobileLiveClassesPage';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  today: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
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
  started_by: string | null;
  normalized_batch_name: string;
  normalized_course_name: string;
  teacher_name: string;
  teacher_id_lookup?: string | null;
  is_featured?: boolean;
};

type ClassStatus = 'live' | 'today' | 'upcoming' | 'completed' | 'cancelled';

function getClassDateTime(cls: LiveClass): { start: Date | null; end: Date | null } {
  if (!cls.scheduled_at) return { start: null, end: null };
  try {
    const start = parseISO(cls.scheduled_at);
    if (isNaN(start.getTime())) return { start: null, end: null };
    const end = addMinutes(start, cls.duration_minutes || 60);
    return { start, end };
  } catch {
    return { start: null, end: null };
  }
}

// CRITICAL: This matches SchedulePage's classification logic exactly
function classifyClass(cls: LiveClass, now: Date): ClassStatus {
  // Explicit statuses take precedence
  if (cls.status === 'cancelled') return 'cancelled';
  if (cls.status === 'completed') return 'completed';

  // Teacher must explicitly end — never auto-flip DB status to completed.
  if (cls.status === 'live') return 'live';

  const { start, end } = getClassDateTime(cls);
  if (!start) return 'upcoming';

  // Check if currently LIVE (now between start and end)
  if (now >= start && end && now <= end) return 'live';

  // Same-day classes stay TODAY (even after window) until teacher ends them
  if (isSameDay(start, now)) return 'today';

  if (start > now) return 'upcoming';
  return 'completed';
}

export default function LiveClassesPage() {
  const isMobile = useIsMobileApp();
  return isMobile ? <MobileLiveClassesPage /> : <DesktopLiveClassesPage />;
}

function DesktopLiveClassesPage() {
  const { isAdmin, role } = useRBAC();
  const { profile } = useAuth();
  
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const canManage = isAdmin || isTeacher;

  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [activeJoinedClassId, setActiveJoinedClassId] = useState<string | null>(null);
  const [classroomMinimized, setClassroomMinimized] = useState(false);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingClass, setEndingClass] = useState<LiveClass | null>(null);
  
  // Real-time clock for status updates - refreshes every 30 seconds like SchedulePage
  const [now, setNow] = useState(() => new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
        // Also refresh classes periodically to catch status changes
        load();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rawClasses: any[] = [];
      if (isAdmin) {
        const result = await adminQuery('list_live_classes');
        rawClasses = Array.isArray(result) ? result : [];
      } else {
        const { data, error } = await supabase
          .from('live_classes')
          .select(`
            *,
            batches:batch_id (
              name,
              teacher_id,
              courses:course_id (
                name
              )
            )
          `)
          .order('scheduled_at', { ascending: true });
        
        if (error) throw error;
        rawClasses = data || [];
      }

      const processedClasses = rawClasses.map((cls: any) => {
        let batchName = '—';
        let courseName = '—';
        let teacherId = null;

        if (cls.batch_name) batchName = cls.batch_name;
        if (cls.course_name) courseName = cls.course_name;
        if (cls.teacher_id) teacherId = cls.teacher_id;

        if (cls.batches) {
          const batch = cls.batches;
          if (batch) {
            if (batch.name) batchName = batch.name;
            if (batch.teacher_id) teacherId = batch.teacher_id;
            if (batch.courses) {
              const course = batch.courses;
              if (course) courseName = course.name || '—';
            }
          }
        }

        return {
          ...cls,
          normalized_batch_name: batchName,
          normalized_course_name: courseName,
          teacher_id_lookup: teacherId,
          teacher_name: cls.teacher_name || cls.host_name || '—',
          status: cls.status ? cls.status.toLowerCase() : 'scheduled',
          is_featured: cls.is_featured || false,
        };
      });

      const teacherIds = [...new Set(processedClasses.map((cls: any) => cls.teacher_id_lookup).filter(Boolean))];
      let teacherMap: Record<string, string> = {};
      
      if (teacherIds.length > 0) {
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', teacherIds);
        
        if (!pError && profiles) {
          profiles.forEach((p: any) => {
            teacherMap[p.user_id] = p.display_name || p.email || '—';
          });
        }
      }

      setClasses(processedClasses.map((cls: any) => ({
        ...cls,
        teacher_name: cls.teacher_id_lookup && teacherMap[cls.teacher_id_lookup] 
          ? teacherMap[cls.teacher_id_lookup] 
          : (cls.teacher_name !== '—' ? cls.teacher_name : '—')
      })));
    } catch (e: any) {
      console.error('Error loading classes:', e);
      toast.error(e.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { 
    load(); 
  }, [load]);

  // Categorize classes using the classification logic
  const categorizedClasses = useMemo(() => {
    const featured: LiveClass[] = [];
    const live: LiveClass[] = [];
    const today: LiveClass[] = [];
    const upcoming: LiveClass[] = [];
    const completed: LiveClass[] = [];
    const cancelled: LiveClass[] = [];
    
    for (const cls of classes) {
      // Skip the currently active joined class
      if (cls.id === activeJoinedClassId) continue;
      
      if (cls.is_featured) featured.push(cls);
      
      const status = classifyClass(cls, now);
      
      switch (status) {
        case 'live':
          live.push(cls);
          break;
        case 'today':
          today.push(cls);
          break;
        case 'upcoming':
          upcoming.push(cls);
          break;
        case 'completed':
          completed.push(cls);
          break;
        case 'cancelled':
          cancelled.push(cls);
          break;
      }
    }
    
    const byDateAsc = (a: LiveClass, b: LiveClass) => {
      const aDate = parseISO(a.scheduled_at);
      const bDate = parseISO(b.scheduled_at);
      return aDate.getTime() - bDate.getTime();
    };
    
    const byDateDesc = (a: LiveClass, b: LiveClass) => {
      const aDate = parseISO(a.scheduled_at);
      const bDate = parseISO(b.scheduled_at);
      return bDate.getTime() - aDate.getTime();
    };
    
    return {
      featured: featured.sort(byDateAsc),
      live: live.sort(byDateAsc),
      today: today.sort(byDateAsc),
      upcoming: upcoming.sort(byDateAsc),
      completed: completed.sort(byDateDesc),
      cancelled: cancelled.sort(byDateDesc),
    };
  }, [classes, now, activeJoinedClassId]);

  const currentLiveClass = useMemo(() => {
    return classes.find(c => c.id === activeJoinedClassId) || null;
  }, [classes, activeJoinedClassId]);

  const startClassHandler = async (cls: LiveClass) => {
    if (!profile?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      await startLiveClass({ 
        classId: cls.id, 
        startedBy: profile.id, 
        isAdmin 
      });
      toast.success('Session started successfully!');
      await load();
    } catch (e: any) {
      console.error('Error starting class:', e);
      toast.error(e.message || 'Failed to start session');
    }
  };

  const handleJoinClass = (classId: string) => {
    setActiveJoinedClassId(classId);
    setClassroomMinimized(false);
    setIsRosterOpen(false);
  };

  const handleCloseClass = () => {
    setActiveJoinedClassId(null);
    setClassroomMinimized(false);
    load();
  };

  const ClassCard = ({ cls }: { cls: LiveClass }) => {
    const status = classifyClass(cls, now);
    const isLive = status === 'live';
    const isToday_ = status === 'today';
    const isUpcoming = status === 'upcoming';
    
    let startDateStr = '—';
    let startTimeStr = '—';
    let endTimeStr = '';
    let canStart = false;
    let canJoinWaitingRoom = false;
    let targetStartDate: Date | null = null;
    let windowEnded = false;
    
    if (cls.scheduled_at) {
      try {
        targetStartDate = parseISO(cls.scheduled_at);
        if (!isNaN(targetStartDate.getTime())) {
          startDateStr = format(targetStartDate, 'MMM d, yyyy');
          startTimeStr = format(targetStartDate, 'h:mm a');
          
          // Teachers can start TODAY classes (not just live)
          canStart = canManage && (isLive || isToday_) && cls.status !== 'completed';
          
          // Students can join waiting room 10 minutes before scheduled time for TODAY classes
          if (isToday_ && targetStartDate) {
            const tenMinutesBefore = new Date(targetStartDate.getTime() - 10 * 60000);
            canJoinWaitingRoom = isStudent && now >= tenMinutesBefore && now < targetStartDate;
          }
          
          if (cls.duration_minutes && cls.duration_minutes > 0) {
            const endDate = addMinutes(targetStartDate, cls.duration_minutes);
            if (!isNaN(endDate.getTime())) {
              endTimeStr = ` - ${format(endDate, 'h:mm a')}`;
              if (now > endDate) windowEnded = true;
            }
          }
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }

    // After the scheduled window ends, students/parents lose Join until teacher ends or restarts.
    // Teacher/Admin keep Start/Join controls so they can still run/close the session manually.
    const showJoinButton = (isLive || isToday_) && (!windowEnded || canManage);

    // Determine display status text
    let displayStatus = cls.status;
    if (status === 'today') displayStatus = 'TODAY';
    else if (status === 'upcoming') displayStatus = 'UPCOMING';
    else if (status === 'live') displayStatus = 'LIVE';
    else displayStatus = cls.status.toUpperCase();

    return (
      <Card className={`transition-all border-l-4 hover:shadow-md ${
        isLive ? 'border-l-green-500 border-green-500/30 bg-green-500/5 shadow-sm' : 
        isToday_ ? 'border-l-orange-500 border-orange-500/30 bg-orange-500/5' :
        'border-l-primary/40'
      }`}>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {cls.is_featured && (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] uppercase tracking-wider font-semibold">
                  <Star className="h-2.5 w-2.5 mr-1" /> Featured
                </Badge>
              )}
              <Badge variant="outline" className={`${STATUS_COLORS[status] || STATUS_COLORS[cls.status] || ''} text-[10px] uppercase tracking-wider font-semibold`}>
                {displayStatus}
              </Badge>
              <h3 className="font-bold text-base text-foreground tracking-tight truncate max-w-md">{cls.title}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" /> {cls.normalized_course_name}
              </span>
              <span className="text-muted-foreground/60">|</span>
              <span>Batch: <strong className="text-zinc-300 font-normal">{cls.normalized_batch_name}</strong></span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>Host: <strong className="text-zinc-300 font-medium">{cls.teacher_name}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5 text-muted-foreground/70" /> {startDateStr}</span>
                <span className="flex items-center gap-1 font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                  <Clock className="h-3 w-3" /> {startTimeStr}{endTimeStr}
                </span>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
            {showJoinButton && (
              <Button 
                size="sm" 
                variant={isLive ? "default" : "outline"}
                className={`h-9 w-full sm:w-auto gap-1.5 ${isLive ? 'bg-green-600 hover:bg-green-700 text-white font-medium' : 'border-orange-500/30 hover:bg-orange-500/5 text-orange-400'}`}
                onClick={() => handleJoinClass(cls.id)}
              >
                <Video className="h-4 w-4" /> {isLive ? 'Join Class' : 'Join Waiting Room'}
              </Button>
            )}
            {canStart && !isLive && (
              <Button 
                size="sm" 
                className="h-9 w-full sm:w-auto gap-1.5" 
                onClick={() => startClassHandler(cls)}
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Start Session
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const activeParticipants = useMemo(() => {
    const currentClass = classes.find(c => c.id === activeJoinedClassId);
    return [
      { id: 'host-1', name: currentClass?.teacher_name || 'Instructor', isHost: true },
      { id: 'stud-1', name: profile?.displayName || profile?.email || 'You', isHost: false }
    ];
  }, [classes, activeJoinedClassId, profile]);

  const sections = [
    { key: 'live' as const, label: 'Live', icon: <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> },
    { key: 'today' as const, label: 'Today' },
    { key: 'upcoming' as const, label: 'Upcoming' },
    { key: 'completed' as const, label: 'Completed' },
    { key: 'cancelled' as const, label: 'Cancelled' },
    { key: 'featured' as const, label: 'Featured', icon: <Star className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="p-6 space-y-6 relative min-h-screen pb-24">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {isStudent ? 'My Workspace' : isTeacher ? 'Instructor Studio' : 'Live Dashboard'}
        </h1>
      </div>

      {/* Active Live Class Video Component */}
      {currentLiveClass && (
        <div
          className={`fixed inset-0 z-[100] bg-black flex flex-col ${classroomMinimized ? 'invisible pointer-events-none' : 'visible'}`}
        >
          <div className="flex-1 min-h-0 relative">
            <VideoClassroom
              roomName={`edu-room-${currentLiveClass.id}`}
              displayName={profile?.displayName || profile?.email || 'User'}
              isTeacher={isTeacher}
              classStatus={currentLiveClass.status}
              classId={currentLiveClass.id}
              onClose={handleCloseClass}
              onMinimize={() => setClassroomMinimized(true)}
              onClassStarted={load}
            />
            {canManage && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-12 right-3 z-30 h-8 text-xs rounded-full shadow-lg"
                onClick={() => setEndingClass(currentLiveClass)}
              >
                <Square className="h-3 w-3 mr-1" /> End Session
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Minimized pill */}
      {currentLiveClass && classroomMinimized && (
        <div className="fixed bottom-4 right-4 z-[110] flex items-center gap-2 bg-card/95 backdrop-blur-lg border border-border shadow-2xl rounded-full pl-4 pr-2 py-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <Video className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground hidden sm:inline truncate max-w-[180px]">
            {currentLiveClass.title || 'Class in progress'}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setClassroomMinimized(false)} title="Expand">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive" onClick={handleCloseClass} title="Leave">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tabs for categorized classes */}
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="flex-wrap h-auto">
          {sections.map(sec => (
            <TabsTrigger key={sec.key} value={sec.key} className="gap-2">
              {sec.icon}
              {sec.label}
              <span className="ml-1 text-xs text-muted-foreground">({categorizedClasses[sec.key].length})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map(sec => (
          <TabsContent key={sec.key} value={sec.key} className="mt-4">
            {loading ? (
              <Card className="p-4 h-24 animate-pulse bg-muted/30" />
            ) : categorizedClasses[sec.key].length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <CalendarIcon className="h-8 w-8 opacity-50" />
                  <p>No {sec.label.toLowerCase()} classes available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {categorizedClasses[sec.key].map(cls => (
                  <ClassCard key={cls.id} cls={cls} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <EndClassAttendanceDialog
        open={!!endingClass}
        onOpenChange={(open) => { if (!open) setEndingClass(null); }}
        liveClass={endingClass}
        isTeacher={isTeacher}
        isAdmin={isAdmin}
        onClassEnded={() => {
          setActiveJoinedClassId(null);
          load();
        }}
      />
    </div>
  );
}
