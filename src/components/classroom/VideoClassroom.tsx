import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface VideoClassroomProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
}

export function VideoClassroom({ roomName, displayName, onClose }: VideoClassroomProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(displayName)}"&config.prejoinPageEnabled=false`;

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50' : 'relative w-full'} bg-background border border-border rounded-lg overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-medium text-foreground">Live Classroom</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <iframe
        src={jitsiUrl}
        className={`w-full ${fullscreen ? 'h-[calc(100vh-41px)]' : 'h-[500px]'}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        style={{ border: 'none' }}
      />
    </div>
  );
}
