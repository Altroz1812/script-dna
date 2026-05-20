import { Video, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoClassroom } from './VideoClassroom';
import { useClassroomSession } from '@/contexts/ClassroomSessionContext';

export function GlobalClassroomOverlay() {
  const { session, minimized, leaveClass, toggleMinimize } = useClassroomSession();

  if (!session) return null;

  return (
    <>
      {/* Full-page classroom — kept mounted (LiveKit connection persists) */}
      <div
        className={`fixed inset-0 z-[100] bg-background ${minimized ? 'invisible pointer-events-none' : 'visible'}`}
      >
        <VideoClassroom
          roomName={session.roomName}
          displayName={session.displayName}
          isTeacher={session.isTeacher}
          classStatus={session.classStatus}
          classId={session.classId}
          onClose={leaveClass}
          onMinimize={toggleMinimize}
        />
      </div>

      {/* Minimized pill */}
      {minimized && (
        <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 bg-card/95 backdrop-blur-lg border border-border shadow-2xl rounded-full pl-4 pr-2 py-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <Video className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground hidden sm:inline">Class in progress</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={toggleMinimize} title="Expand">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive" onClick={leaveClass} title="Leave">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}