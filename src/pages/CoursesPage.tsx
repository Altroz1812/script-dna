import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { courseService, type Course, type CreateCourseParams } from '@/services/api/courseService';
import { adminQuery } from '@/services/api/adminService';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen, Clock, Calendar, GraduationCap, IndianRupee, Eye, Pencil, MapPin, Wifi, Building2, Users, ChevronDown } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { CourseForm } from '@/components/courses/CourseForm';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileCoursesPage from './mobile/MobileCoursesPage';
import { CascadeDeleteDialog } from '@/components/common/CascadeDeleteDialog';
import { RecycleBinDialog } from '@/components/common/RecycleBinDialog';
import { History } from 'lucide-react';

export default function CoursesPage() {
  const __isMobile = useIsMobileApp();
  if (__isMobile) return <MobileCoursesPage />;
  const { profile } = useAuth();
  const { isAdmin, role } = useRBAC();
  const isStudent = role === 'student';
  const { activeOrgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Partial<Record<keyof CreateCourseParams, string>>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Partial<Record<keyof CreateCourseParams, string>>>({});
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [recycleOpen, setRecycleOpen] = useState(false);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['courses', isStudent, activeOrgId],
    queryFn: async () => {
      if (isStudent) {
        const { data: enrollments } = await supabase
          .from('batch_students')
          .select('batch_id, batches(course_id)')
          .eq('student_id', profile!.id);
        const courseIds = [...new Set((enrollments || []).map((e: any) => e.batches?.course_id).filter(Boolean))];
        if (courseIds.length === 0) return [];
        const { data, error } = await supabase.from('courses').select('*').in('id', courseIds);
        if (error) throw error;
        return data || [];
      }
      return adminQuery('list_courses');
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!profile,
  });

  /**
   * Compare what we submitted against what the server returned and surface any
   * field that didn't persist as expected. Returns a map of field -> message.
   */
  const diffPersisted = (
    submitted: Partial<CreateCourseParams>,
    saved: Course | null | undefined,
  ): Partial<Record<keyof CreateCourseParams, string>> => {
    if (!saved) return {};
    const errs: Partial<Record<keyof CreateCourseParams, string>> = {};
    const numericFields: (keyof CreateCourseParams)[] = ['duration_days', 'total_hours', 'daily_hours', 'fee'];
    const stringFields: (keyof CreateCourseParams)[] = ['name', 'description', 'grade_level', 'language', 'writing_style', 'delivery_mode', 'center'];
    for (const k of numericFields) {
      const sent = submitted[k];
      if (sent === undefined || sent === null) continue;
      const got = (saved as any)[k];
      if (Number(got ?? 0) !== Number(sent)) {
        errs[k] = `Did not save (sent ${sent}, stored ${got ?? 'empty'})`;
      }
    }
    for (const k of stringFields) {
      const sent = submitted[k];
      if (sent === undefined || sent === null || sent === '') continue;
      const got = (saved as any)[k];
      if ((got ?? '') !== sent) {
        errs[k] = `Did not save (sent "${sent}", stored "${got ?? 'empty'}")`;
      }
    }
    if (submitted.includes_speed !== undefined && Boolean((saved as any).includes_speed) !== Boolean(submitted.includes_speed)) {
      errs.includes_speed = 'Did not save';
    }
    return errs;
  };

  const createMutation = useMutation({
    mutationFn: (values: Partial<CreateCourseParams>) => courseService.createCourse({
      name: values.name!.trim(),
      description: values.description?.trim() || null,
      created_by: profile!.id,
      grade_level: values.grade_level?.trim() || undefined,
      duration_days: values.duration_days ?? undefined,
      total_hours: values.total_hours ?? undefined,
      daily_hours: values.daily_hours ?? undefined,
      language: values.language || undefined,
      writing_style: values.writing_style || undefined,
      includes_speed: values.includes_speed ?? false,
      fee: values.fee ?? 0,
      delivery_mode: values.delivery_mode || 'online',
      center: values.center?.trim() || undefined,
    }),
    onSuccess: (saved, submitted) => {
      const errs = diffPersisted(submitted, saved as Course);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
      if (Object.keys(errs).length > 0) {
        setCreateFieldErrors(errs);
        toast.error('Course created, but some details did not save', {
          description: Object.entries(errs).map(([k, v]) => `${k}: ${v}`).join('\n'),
        });
        return;
      }
      setCreateFieldErrors({});
      toast.success('Course created');
      setCreateOpen(false);
    },
    onError: (e: any) => {
      setCreateFieldErrors({});
      toast.error(e?.message || 'Failed to create course');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<CreateCourseParams> & { id: string }) => {
      const { id, ...updates } = values;
      const saved = await courseService.updateCourse(id, updates);
      return { saved, submitted: updates as Partial<CreateCourseParams> };
    },
    onSuccess: ({ saved, submitted }) => {
      const errs = diffPersisted(submitted, saved as Course);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      if (Object.keys(errs).length > 0) {
        setEditFieldErrors(errs);
        toast.error('Course saved, but some details did not persist', {
          description: Object.entries(errs).map(([k, v]) => `${k}: ${v}`).join('\n'),
        });
        return;
      }
      setEditFieldErrors({});
      toast.success('Course updated');
      setEditCourse(null);
    },
    onError: (e: any) => {
      setEditFieldErrors({});
      toast.error(e?.message || 'Failed to update course');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => courseService.deleteCourse(id),
    onSuccess: () => {
      toast.success('Course deleted');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const centers = [...new Set(courses.filter(c => c.center).map(c => c.center!))].sort();

  // Fetch batches with student counts for all courses
  const courseIds = courses.map(c => c.id);
  const { data: allBatches = [] } = useQuery({
    queryKey: ['course_batches', courseIds, activeOrgId],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const data: any[] = await adminQuery('list_batches');
      const filtered = (data ?? []).filter((b: any) => courseIds.includes(b.course_id));
      return filtered.map((b: any) => ({
        id: b.id,
        name: b.name,
        max_students: b.max_students,
        teacher_id: b.teacher_id,
        course_id: b.course_id,
        enrolled_count: b.enrolled_count ?? 0,
        teacher_name: b.teacher_name ?? null,
      }));
    },
    enabled: courseIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const batchesByCourse = allBatches.reduce<Record<string, typeof allBatches>>((acc, b) => {
    if (!acc[b.course_id]) acc[b.course_id] = [];
    acc[b.course_id].push(b);
    return acc;
  }, {});

  const filterByCenter = (list: Course[]) =>
    selectedCenter === 'all' ? list : list.filter(c => c.center === selectedCenter);

  const onlineCourses = courses.filter(c => (c.delivery_mode || 'online') === 'online');
  const offlineCourses = filterByCenter(courses.filter(c => c.delivery_mode === 'offline'));
  const allFiltered = [...onlineCourses, ...offlineCourses];

  const CourseCard = ({ c }: { c: Course }) => {
    const isOffline = c.delivery_mode === 'offline';
    const courseBatches = batchesByCourse[c.id] || [];
    return (
      <Card key={c.id}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg leading-tight">{c.name}</CardTitle>
              {c.description && <CardDescription className="mt-1 line-clamp-2">{c.description}</CardDescription>}
            </div>
            {isAdmin && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditCourse(c)}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={isOffline ? 'default' : 'secondary'} className="gap-1">
              {isOffline ? <Building2 className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
              {isOffline ? 'Offline' : 'Online'}
            </Badge>
            {isOffline && c.center && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" /> {c.center}
              </Badge>
            )}
            {c.language && <Badge variant="secondary">{c.language}</Badge>}
            {c.writing_style && <Badge variant="outline">{c.writing_style}</Badge>}
            {c.includes_speed && <Badge variant="secondary">Speed</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            {c.grade_level && (
              <div className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{c.grade_level}</div>
            )}
            {c.duration_days && (
              <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{c.duration_days} days</div>
            )}
            {c.total_hours && (
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.total_hours} hrs total</div>
            )}
            {c.daily_hours && (
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.daily_hours} hr/day</div>
            )}
            {(c.fee != null && c.fee > 0) && (
              <div className="flex items-center gap-1 font-medium text-foreground"><IndianRupee className="h-3.5 w-3.5" />₹{c.fee.toLocaleString('en-IN')}</div>
            )}
          </div>

          {/* Batch/Slot Details */}
          {courseBatches.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {courseBatches.length} batch{courseBatches.length !== 1 ? 'es' : ''}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {courseBatches.map(b => {
                  const pct = Math.round((b.enrolled_count / b.max_students) * 100);
                  const isFull = b.enrolled_count >= b.max_students;
                  const remaining = b.max_students - b.enrolled_count;
                  return (
                    <div key={b.id} className={`p-3 rounded-lg border text-sm space-y-1.5 ${isFull ? 'bg-muted/30 opacity-60' : 'border-border/50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{b.name}</span>
                        {isFull ? (
                          <Badge variant="destructive" className="text-[10px]">Full</Badge>
                        ) : (
                          <span className={`text-xs font-medium ${pct >= 90 ? 'text-destructive' : pct >= 75 ? 'text-warning' : 'text-primary'}`}>
                            {remaining} seat{remaining !== 1 ? 's' : ''} left
                          </span>
                        )}
                      </div>
                      {b.teacher_name && <p className="text-xs text-muted-foreground">Teacher: {b.teacher_name}</p>}
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">{b.enrolled_count}/{b.max_students}</span>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {isStudent && (
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate(`/courses/${c.id}/lessons`)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> View Lessons
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const CourseGrid = ({ items }: { items: Course[] }) => (
    items.length === 0 ? (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>{isStudent ? 'No courses in this category.' : 'No courses yet.'}{isAdmin ? ' Create one to get started.' : ''}</p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(c => <CourseCard key={c.id} c={c} />)}
      </div>
    )
  );

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Courses</h1><p className="text-muted-foreground text-sm">Loading...</p></div>
      <CardGridSkeleton count={6} />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courses</h1>
          <p className="text-muted-foreground text-sm">
            {isStudent ? 'Your enrolled courses' : isAdmin ? 'Manage courses and curriculum' : 'Browse available courses'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRecycleOpen(true)}>
              <History className="mr-2 h-4 w-4" /> Recycle Bin
            </Button>
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateFieldErrors({}); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Course</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Course</DialogTitle></DialogHeader>
              <CourseForm
                onSubmit={values => createMutation.mutate(values)}
                isPending={createMutation.isPending}
                submitLabel="Create Course"
                fieldErrors={createFieldErrors}
              />
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'online') setSelectedCenter('all'); }}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="all">All ({allFiltered.length})</TabsTrigger>
            <TabsTrigger value="online">
              <Wifi className="h-3.5 w-3.5 mr-1" /> Online ({onlineCourses.length})
            </TabsTrigger>
            <TabsTrigger value="offline">
              <Building2 className="h-3.5 w-3.5 mr-1" /> Offline ({offlineCourses.length})
            </TabsTrigger>
          </TabsList>
          {activeTab !== 'online' && centers.length > 0 && (
            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
              <SelectTrigger className="w-[200px]">
                <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {centers.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <TabsContent value="all"><CourseGrid items={allFiltered} /></TabsContent>
        <TabsContent value="online"><CourseGrid items={onlineCourses} /></TabsContent>
        <TabsContent value="offline"><CourseGrid items={offlineCourses} /></TabsContent>
      </Tabs>

      {/* Edit Course Dialog */}
      <Dialog open={!!editCourse} onOpenChange={v => { if (!v) { setEditCourse(null); setEditFieldErrors({}); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
          {editCourse && (
            <CourseForm
              initialValues={{
                name: editCourse.name,
                description: editCourse.description || '',
                grade_level: editCourse.grade_level || '',
                duration_days: editCourse.duration_days || 30,
                total_hours: editCourse.total_hours || 25,
                daily_hours: editCourse.daily_hours || 1,
                language: editCourse.language || 'English',
                writing_style: editCourse.writing_style || 'Cursive',
                includes_speed: editCourse.includes_speed || false,
                fee: editCourse.fee || 0,
                delivery_mode: editCourse.delivery_mode || 'online',
                center: editCourse.center || '',
              }}
              onSubmit={values => updateMutation.mutate({ id: editCourse.id, ...values })}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
              fieldErrors={editFieldErrors}
            />
          )}
        </DialogContent>
      </Dialog>

      <CascadeDeleteDialog
        target={deleteTarget ? { kind: 'course', id: deleteTarget.id, name: deleteTarget.name } : null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
