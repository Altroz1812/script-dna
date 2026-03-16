import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link2, Trash2, Plus } from 'lucide-react';

interface ParentChildLink {
  id: string;
  parent_id: string;
  child_id: string;
  parent_profile: { user_id: string; display_name: string | null; email: string | null } | null;
  child_profile: { user_id: string; display_name: string | null; email: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentUserId?: string;
  parentName?: string;
}

export function ParentChildLinkDialog({ open, onOpenChange, parentUserId, parentName }: Props) {
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [selectedParent, setSelectedParent] = useState(parentUserId || '');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);

  const isParentScoped = !!parentUserId;

  useEffect(() => {
    if (!open) return;
    setSelectedParent(parentUserId || '');
    load();
  }, [open, parentUserId]);

  const load = async () => {
    setLoading(true);
    try {
      const [linksData, studentsData] = await Promise.all([
        adminQuery('list_parent_children', parentUserId ? { parent_id: parentUserId } : {}),
        adminQuery('list_all_students'),
      ]);
      setLinks(linksData);
      setStudents(studentsData);
      if (!isParentScoped) {
        const parentsData = await adminQuery('list_parents');
        setParents(parentsData);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const pid = isParentScoped ? parentUserId : selectedParent;
    if (!pid || !selectedStudent) {
      toast.error('Select both parent and student');
      return;
    }
    if (links.some(l => l.parent_id === pid && l.child_id === selectedStudent)) {
      toast.error('This link already exists');
      return;
    }
    try {
      await adminQuery('add_parent_child', { parent_id: pid, child_id: selectedStudent });
      toast.success('Child linked to parent');
      setSelectedStudent('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await adminQuery('remove_parent_child', { id });
      toast.success('Link removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const linkedChildIds = new Set(links.filter(l => {
    const pid = isParentScoped ? parentUserId : selectedParent;
    return l.parent_id === pid;
  }).map(l => l.child_id));

  const availableStudents = students.filter(s => !linkedChildIds.has(s.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {isParentScoped ? `Link Children — ${parentName || 'Parent'}` : 'Manage Parent–Child Links'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isParentScoped && (
            <div>
              <Label>Parent</Label>
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger><SelectValue placeholder="Select parent..." /></SelectTrigger>
                <SelectContent>
                  {parents.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.display_name || p.email || p.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Add Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                <SelectContent>
                  {availableStudents.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.display_name || s.email || s.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} size="icon" disabled={!selectedStudent}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Linked Children</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No children linked yet</p>
            ) : (
              <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                {links.map(link => (
                  <div key={link.id} className="flex items-center justify-between rounded-md border p-2">
                    <div className="text-sm">
                      {!isParentScoped && (
                        <span className="text-muted-foreground mr-2">
                          <Badge variant="outline" className="mr-1">Parent</Badge>
                          {link.parent_profile?.display_name || link.parent_profile?.email || '—'}
                          {' → '}
                        </span>
                      )}
                      <Badge variant="secondary" className="mr-1">Student</Badge>
                      {link.child_profile?.display_name || link.child_profile?.email || '—'}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(link.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
