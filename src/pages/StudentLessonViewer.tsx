import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Clock, Play, ExternalLink, BookOpen } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';

export default function StudentLessonViewer() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').eq('id', courseId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['course_modules', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_modules')
        .select('*, lessons(*)')
        .eq('course_id', courseId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        lessons: (m.lessons || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }));
    },
    enabled: !!courseId,
  });

  const toggleModule = (id: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalLessons = modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/courses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{course?.name || 'Course Lessons'}</h1>
          <p className="text-muted-foreground text-sm">
            {modules.length} module{modules.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : modules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No lessons available for this course yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {modules.map((mod: any, idx: number) => (
            <Card key={mod.id}>
              <Collapsible open={openModules.has(mod.id)} onOpenChange={() => toggleModule(mod.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div>
                          <CardTitle className="text-base">{mod.title}</CardTitle>
                          {mod.description && <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{mod.lessons?.length || 0} lessons</Badge>
                        {openModules.has(mod.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {(mod.lessons?.length || 0) === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No lessons in this module yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {mod.lessons.map((lesson: any, li: number) => (
                          <div key={lesson.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                              {li + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground">{lesson.title}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5">{lesson.lesson_type}</Badge>
                              </div>
                              {lesson.content && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.content}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                {lesson.duration_minutes > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />{lesson.duration_minutes} min
                                  </span>
                                )}
                                {lesson.file_url && (
                                  <a href={lesson.file_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <ExternalLink className="h-3 w-3" /> View Resource
                                  </a>
                                )}
                              </div>
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
    </div>
  );
}
