import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, FileText } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { courseService } from '@/services/api/courseService';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ course_id: '', title: '', description: '', file_url: '', material_type: 'document' });
  const [filterCourse, setFilterCourse] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([adminQuery('list_materials', filterCourse !== 'all' ? { course_id: filterCourse } : {}), courseService.listCourses()]);
      setMaterials(m); setCourses(c);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filterCourse]);

  const handleCreate = async () => {
    if (!form.course_id || !form.title.trim()) { toast.error('Course and title required'); return; }
    try { await adminQuery('create_material', { ...form, title: form.title.trim(), description: form.description || null, file_url: form.file_url || null }); toast.success('Created'); setOpen(false); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await adminQuery('delete_material', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Materials</h1>
        <div className="flex gap-2">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter course" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Courses</SelectItem>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Material</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Material</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Course</Label><Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>File URL</Label><Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." /></div>
                <div><Label>Type</Label><Select value={form.material_type} onValueChange={v => setForm(f => ({ ...f, material_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Document</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent></Select></div>
                <Button onClick={handleCreate} className="w-full">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {loading ? <TableSkeleton columns={5} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Course</TableHead><TableHead>Type</TableHead><TableHead>Link</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {materials.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />No materials</TableCell></TableRow> :
                materials.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{m.courses?.name || '—'}</TableCell>
                    <TableCell className="capitalize">{m.material_type}</TableCell>
                    <TableCell>{m.file_url ? <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open</a> : '—'}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
