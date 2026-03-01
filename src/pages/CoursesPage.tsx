import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { courseService, type Course, type CreateCourseParams } from '@/services/api/courseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen, Clock, Calendar, GraduationCap, IndianRupee } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';

export default function CoursesPage() {
  const { profile } = useAuth();
  const { isAdmin } = useRBAC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CreateCourseParams>>({
    name: '', description: '', grade_level: '', duration_days: 30, total_hours: 25,
    daily_hours: 1.0, language: 'English', writing_style: 'Cursive', includes_speed: false, fee: 0,
  });

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => courseService.listCourses(),
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: () => courseService.createCourse({
      name: form.name!.trim(),
      description: form.description?.trim() || null,
      created_by: profile!.id,
      grade_level: form.grade_level?.trim() || undefined,
      duration_days: form.duration_days || undefined,
      total_hours: form.total_hours || undefined,
      daily_hours: form.daily_hours || undefined,
      language: form.language || undefined,
      writing_style: form.writing_style || undefined,
      includes_speed: form.includes_speed || false,
      fee: form.fee || 0,
    }),
    onSuccess: () => {
      toast.success('Course created');
      setForm({ name: '', description: '', grade_level: '', duration_days: 30, total_hours: 25, daily_hours: 1.0, language: 'English', writing_style: 'Cursive', includes_speed: false, fee: 0 });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
    },
    onError: (e: any) => toast.error(e.message),
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

  const handleCreate = () => {
    if (!form.name?.trim()) { toast.error('Course name is required'); return; }
    createMutation.mutate();
  };

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
            {isAdmin ? 'Manage courses and curriculum' : 'Browse available courses'}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Course</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Course</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={200} placeholder="e.g. English Cursive Handwriting" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={1000} placeholder="Optional description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Language</Label>
                    <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="Kannada">Kannada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Writing Style</Label>
                    <Select value={form.writing_style} onValueChange={v => setForm(f => ({ ...f, writing_style: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cursive">Cursive</SelectItem>
                        <SelectItem value="Split">Split</SelectItem>
                        <SelectItem value="Speedwriting">Speedwriting</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="Kannada">Kannada</SelectItem>
                        <SelectItem value="Calligraphy">Calligraphy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Grade Level</Label>
                  <Input value={form.grade_level} onChange={e => setForm(f => ({ ...f, grade_level: e.target.value }))} placeholder="e.g. UKG, 1st, 2nd" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Duration (days)</Label>
                    <Input type="number" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>Total Hours</Label>
                    <Input type="number" value={form.total_hours} onChange={e => setForm(f => ({ ...f, total_hours: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>Daily Hours</Label>
                    <Input type="number" step="0.5" value={form.daily_hours} onChange={e => setForm(f => ({ ...f, daily_hours: parseFloat(e.target.value) || 1 }))} />
                  </div>
                </div>
                <div>
                  <Label>Course Fee (₹)</Label>
                  <Input type="number" min="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 5000" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.includes_speed} onCheckedChange={v => setForm(f => ({ ...f, includes_speed: v }))} />
                  <Label>Includes Speedwriting</Label>
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? 'Creating...' : 'Create Course'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No courses yet.{isAdmin ? ' Create one to get started.' : ''}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight">{c.name}</CardTitle>
                    {c.description && <CardDescription className="mt-1 line-clamp-2">{c.description}</CardDescription>}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
