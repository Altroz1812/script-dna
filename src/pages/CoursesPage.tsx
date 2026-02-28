import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { courseService, type Course } from '@/services/api/courseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';

export default function CoursesPage() {
  const { profile } = useAuth();
  const { isAdmin } = useRBAC();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setCourses(await courseService.listCourses());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Course name is required'); return; }
    if (name.trim().length > 200) { toast.error('Name must be under 200 characters'); return; }
    setSubmitting(true);
    try {
      await courseService.createCourse(name.trim(), description.trim() || null, profile!.id);
      toast.success('Course created');
      setName(''); setDescription(''); setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await courseService.deleteCourse(id);
      toast.success('Course deleted');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return (
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Course</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} maxLength={200} placeholder="e.g. Mathematics Grade 10" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Optional description" />
                </div>
                <Button onClick={handleCreate} disabled={submitting} className="w-full">
                  {submitting ? 'Creating...' : 'Create Course'}
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
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    {c.description && <CardDescription className="mt-1">{c.description}</CardDescription>}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(c.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
