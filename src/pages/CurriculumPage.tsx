import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  lesson_type: string;
  duration_minutes: number;
  sort_order: number;
  file_url: string | null;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: Lesson[];
}

export default function CurriculumPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Module form
  const [moduleOpen, setModuleOpen] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');

  // Lesson form
  const [lessonOpen, setLessonOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [lessonModuleId, setLessonModuleId] = useState('');
  const [lTitle, setLTitle] = useState('');
  const [lContent, setLContent] = useState('');
  const [lType, setLType] = useState('text');
  const [lDuration, setLDuration] = useState('');
  const [lFileUrl, setLFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    adminQuery('list_courses').then(setCourses).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCourse) loadModules();
  }, [selectedCourse]);

  const loadModules = async () => {
    try {
      const data = await adminQuery('list_course_modules', { course_id: selectedCourse });
      setModules(data);
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleModule = (id: string) => {
    const next = new Set(expandedModules);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedModules(next);
  };

  // Module CRUD
  const resetModuleForm = () => { setMTitle(''); setMDesc(''); setEditModule(null); };
  const openEditModule = (m: Module) => { setEditModule(m); setMTitle(m.title); setMDesc(m.description || ''); setModuleOpen(true); };

  const handleSaveModule = async () => {
    if (!mTitle.trim()) { toast.error('Title required'); return; }
    try {
      if (editModule) {
        await adminQuery('update_course_module', { id: editModule.id, title: mTitle.trim(), description: mDesc.trim() || null });
        toast.success('Module updated');
      } else {
        await adminQuery('create_course_module', { course_id: selectedCourse, title: mTitle.trim(), description: mDesc.trim() || null, sort_order: modules.length });
        toast.success('Module created');
      }
      setModuleOpen(false); resetModuleForm(); loadModules();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    try { await adminQuery('delete_course_module', { id }); toast.success('Deleted'); loadModules(); } catch (e: any) { toast.error(e.message); }
  };

  // Lesson CRUD
  const resetLessonForm = () => { setLTitle(''); setLContent(''); setLType('text'); setLDuration(''); setLFileUrl(''); setEditLesson(null); setLessonModuleId(''); };

  const openAddLesson = (moduleId: string) => {
    resetLessonForm(); setLessonModuleId(moduleId); setLessonOpen(true);
  };

  const openEditLesson = (l: Lesson) => {
    setEditLesson(l); setLessonModuleId(l.module_id); setLTitle(l.title); setLContent(l.content || '');
    setLType(l.lesson_type); setLDuration(String(l.duration_minutes || '')); setLFileUrl(l.file_url || ''); setLessonOpen(true);
  };

  const handleLessonFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `lessons/${profile?.id ?? 'anon'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('materials').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('materials').getPublicUrl(path);
      setLFileUrl(data.publicUrl);
      toast.success('File uploaded');
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const handleSaveLesson = async () => {
    if (!lTitle.trim()) { toast.error('Title required'); return; }
    const mod = modules.find(m => m.id === lessonModuleId);
    try {
      if (editLesson) {
        await adminQuery('update_lesson', { id: editLesson.id, title: lTitle.trim(), content: lContent.trim() || null, lesson_type: lType, duration_minutes: Number(lDuration) || 0, file_url: lFileUrl.trim() || null });
        toast.success('Lesson updated');
      } else {
        await adminQuery('create_lesson', { module_id: lessonModuleId, title: lTitle.trim(), content: lContent.trim() || null, lesson_type: lType, duration_minutes: Number(lDuration) || 0, sort_order: mod?.lessons?.length ?? 0, file_url: lFileUrl.trim() || null });
        toast.success('Lesson created');
      }
      setLessonOpen(false); resetLessonForm(); loadModules();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Delete this lesson?')) return;
    try { await adminQuery('delete_lesson', { id }); toast.success('Deleted'); loadModules(); } catch (e: any) { toast.error(e.message); }
  };

  const totalLessons = modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
  const totalDuration = modules.reduce((s, m) => s + (m.lessons ?? []).reduce((ss, l) => ss + (l.duration_minutes || 0), 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" /> Curriculum</h1>
        <p className="text-muted-foreground text-sm">Manage course modules and lessons</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1 max-w-sm">
          <Label>Select Course</Label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
            <SelectContent>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedCourse && (
          <Dialog open={moduleOpen} onOpenChange={(v) => { if (!v) resetModuleForm(); setModuleOpen(v); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Module</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editModule ? 'Edit Module' : 'New Module'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={mTitle} onChange={e => setMTitle(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea value={mDesc} onChange={e => setMDesc(e.target.value)} rows={2} /></div>
                <Button onClick={handleSaveModule} className="w-full">{editModule ? 'Update' : 'Create'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedCourse && (
        <>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{modules.length} modules</span>
            <span>{totalLessons} lessons</span>
            <span>{totalDuration} min total</span>
          </div>

          {modules.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">No modules yet. Add your first module above.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {modules.map((m, mi) => (
                <Card key={m.id}>
                  <Collapsible open={expandedModules.has(m.id)} onOpenChange={() => toggleModule(m.id)}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                          {expandedModules.has(m.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="text-xs text-muted-foreground font-mono">M{mi + 1}</span>
                          <CardTitle className="text-base">{m.title}</CardTitle>
                          <Badge variant="secondary" className="ml-2">{m.lessons?.length ?? 0} lessons</Badge>
                        </CollapsibleTrigger>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openAddLesson(m.id)}><Plus className="h-3 w-3 mr-1" />Lesson</Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModule(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteModule(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                      {m.description && <p className="text-xs text-muted-foreground ml-10">{m.description}</p>}
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3">
                        {(!m.lessons || m.lessons.length === 0) ? (
                          <p className="text-sm text-muted-foreground ml-10">No lessons in this module</p>
                        ) : (
                          <div className="ml-10 space-y-2">
                            {m.lessons.map((l, li) => (
                              <div key={l.id} className="flex items-center justify-between border rounded-md p-2 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-mono">{mi + 1}.{li + 1}</span>
                                  <span className="text-sm font-medium">{l.title}</span>
                                  <Badge variant="outline" className="text-xs">{l.lesson_type}</Badge>
                                  {l.duration_minutes > 0 && <span className="text-xs text-muted-foreground">{l.duration_minutes} min</span>}
                                  {l.file_url && <a href={l.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">File</a>}
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(l)}><Pencil className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLesson(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lesson Dialog */}
      <Dialog open={lessonOpen} onOpenChange={(v) => { if (!v) resetLessonForm(); setLessonOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editLesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={lTitle} onChange={e => setLTitle(e.target.value)} /></div>
            <div><Label>Content</Label><Textarea value={lContent} onChange={e => setLContent(e.target.value)} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={lType} onValueChange={setLType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Duration (min)</Label><Input type="number" value={lDuration} onChange={e => setLDuration(e.target.value)} /></div>
            </div>
            <div><Label>File URL</Label><Input value={lFileUrl} onChange={e => setLFileUrl(e.target.value)} placeholder="https://..." /></div>
            <div>
              <Label>Or Upload File</Label>
              <Input type="file" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleLessonFileUpload(f); }} />
              {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
            </div>
            <Button onClick={handleSaveLesson} className="w-full">{editLesson ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
