import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, Award, ClipboardCheck, BookOpen, Video, FileCheck, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow, ShimmerStat } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { ResponsiveDialog } from '@/components/mobile/ui/ResponsiveDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { downloadCertificate } from '@/services/certificateService';

function statusTone(s?: string) {
  const v = String(s || '').toLowerCase();
  if (v === 'completed') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v === 'needs_improvement' || v === 'needs improvement') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v === 'reviewed' || v === 'present') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v === 'late') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v === 'absent' || v === 'rejected') return 'bg-destructive/15 text-destructive border-destructive/30';
  return 'bg-muted/30 text-muted-foreground border-border';
}

export default function MobileParentProgressPage() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(params.get('child') || '');
  const [progress, setProgress] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ name: string; course: string; duration: string | null; date: string | null } | null>(null);
  const [dlId, setDlId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: links } = await supabase.from('parent_children').select('child_id').eq('parent_id', profile.id);
      const ids = (links || []).map((l) => l.child_id);
      if (!ids.length) { setChildren([]); setLoading(false); return; }
      const { data: p } = await supabase.from('profiles').select('user_id, display_name, email').in('user_id', ids);
      const list = (p || []).map((x: any) => ({ id: x.user_id, name: x.display_name || x.email || 'Child' }));
      setChildren(list);
      if (!selected && list.length) setSelected(list[0].id);
    })();
  }, [profile?.id]);

  const load = async (childId: string) => {
    setLoading(true);
    try {
      const [pr, sr, ar, cr, cer] = await Promise.all([
        supabase.from('student_progress').select('*, courses(name)').eq('student_id', childId),
        supabase.from('student_submissions').select('*, practice_assignments(title)').eq('student_id', childId).order('created_at', { ascending: false }).limit(20),
        supabase.from('attendance').select('*, batches(name)').eq('student_id', childId).order('date', { ascending: false }).limit(30),
        supabase.from('live_classes').select('id, title, scheduled_at, status, batches(name)').in('status', ['scheduled', 'live']).order('scheduled_at', { ascending: true }).limit(10),
        (supabase as any).from('certificates').select('id, student_name, course_name, course_duration, completion_date, issued_at, status').eq('student_id', childId).order('issued_at', { ascending: false }),
      ]);
      setProgress(pr.data || []);
      setSubs(sr.data || []);
      setAtt(ar.data || []);
      setClasses(cr.data || []);
      setCerts(cer.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selected) return;
    setParams({ child: selected });
    load(selected);
  }, [selected]);

  const avgCompletion = progress.length
    ? Math.round(progress.reduce((s, p) => s + (p.completion_pct || 0), 0) / progress.length)
    : 0;
  const reviewed = subs.filter((s) => s.score != null);
  const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, x) => s + x.score, 0) / reviewed.length) : null;
  const attRate = att.length ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100) : null;

  return (
    <MobilePage onRefresh={async () => { if (selected) await load(selected); }}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">Child Progress</h1>
        <p className="text-xs text-muted-foreground mt-1">Detailed insights and certificates</p>
      </div>

      {children.length > 1 && (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select child" /></SelectTrigger>
          <SelectContent>
            {children.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3"><ShimmerStat /><ShimmerStat /><ShimmerStat /><ShimmerStat /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={TrendingUp} label="Completion" value={`${avgCompletion}%`} tint="from-primary/30 to-primary/5" />
          <Stat icon={Award} label="Avg Score" value={avgScore != null ? `${avgScore}/100` : '—'} tint="from-emerald-500/30 to-emerald-500/5" />
          <Stat icon={ClipboardCheck} label="Attendance" value={attRate != null ? `${attRate}%` : '—'} tint="from-orange-500/30 to-orange-500/5" />
          <Stat icon={BookOpen} label="Courses" value={progress.length} tint="from-accent/30 to-accent/5" />
        </div>
      )}

      <Tabs defaultValue="courses" className="space-y-3">
        <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="subs">Subs</TabsTrigger>
            <TabsTrigger value="att">Attendance</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="certs">Certs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="courses" className="space-y-2 mt-0">
          {progress.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" />
          ) : progress.map((p) => (
            <div key={p.id} className="rounded-xl p-3 bg-card border border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{p.courses?.name || 'Course'}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sessions_attended}/{p.total_sessions} sessions</div>
                </div>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusTone(p.status)}`}>
                  {p.status || 'not started'}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${p.completion_pct || 0}%` }} />
              </div>
              <div className="text-[11px] text-right text-muted-foreground mt-1">{p.completion_pct || 0}%</div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="subs" className="space-y-2 mt-0">
          {subs.length === 0 ? <EmptyState icon={FileCheck} title="No submissions" /> : subs.map((s) => (
            <div key={s.id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.practice_assignments?.title || 'Submission'}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {new Date(s.created_at).toLocaleDateString()} {s.teacher_feedback ? `· ${s.teacher_feedback}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusTone(s.status)}`}>{s.status}</span>
                <div className="text-[11px] text-foreground mt-1">{s.score != null ? `${s.score}/100` : '—'}</div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="att" className="space-y-2 mt-0">
          {att.length === 0 ? <EmptyState icon={ClipboardCheck} title="No attendance records" /> : att.map((a) => (
            <div key={a.id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{new Date(a.date).toLocaleDateString()}</div>
                <div className="text-[11px] text-muted-foreground truncate">{a.batches?.name || a.batch_id}</div>
              </div>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusTone(a.status)}`}>{a.status}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="classes" className="space-y-2 mt-0">
          {classes.length === 0 ? <EmptyState icon={Video} title="No upcoming classes" /> : classes.map((c) => (
            <div key={c.id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.batches?.name || ''} · {new Date(c.scheduled_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusTone(c.status)}`}>{c.status}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="certs" className="space-y-3 mt-0">
          {certs.length === 0 ? (
            <EmptyState icon={Award} title="No certificates yet" message="Certificates appear once a course is completed." />
          ) : certs.map((c) => (
            <div key={c.id} className="rounded-2xl p-4 bg-emerald-500/5 border border-emerald-500/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{c.course_name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {c.course_duration && <>{c.course_duration} · </>}
                    Completed {new Date(c.completion_date || c.issued_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                  <Award className="w-3 h-3" /> Certified
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview({ name: c.student_name, course: c.course_name, duration: c.course_duration, date: c.completion_date })}>
                  <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={dlId === c.id}
                  onClick={async () => {
                    setDlId(c.id);
                    try { await downloadCertificate(c.student_name, c.course_name, { duration: c.course_duration, completionDate: c.completion_date }); }
                    catch (e: any) { console.error(e); }
                    finally { setDlId(null); }
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {dlId === c.id ? 'Generating…' : 'Download'}
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title="Certificate Preview"
        desktopWidthClass="sm:max-w-3xl"
      >
        {preview && (
          <div className="relative w-full">
            <img src="/certificate.jpeg" alt="Certificate" className="w-full h-auto" />
            <div className="absolute left-[5%] right-[5%] top-[55%] text-[#2c3e50] font-serif font-bold uppercase text-base">
              {preview.name}
            </div>
            <div className="absolute left-[5%] right-[5%] top-[74%] text-[#555] font-serif italic text-sm">
              {preview.course}
            </div>
            <div className="absolute left-[5%] right-[5%] top-[86%] text-[#333] font-serif text-[10px]">
              {preview.duration && <>Duration: {preview.duration}    •    </>}
              Date: {preview.date ? new Date(preview.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </MobilePage>
  );
}

function Stat({ icon: Icon, label, value, tint }: any) {
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${tint} border border-white/[0.08]`}>
      <Icon className="w-5 h-5 text-foreground" />
      <div className="text-2xl font-bold font-display mt-2">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}