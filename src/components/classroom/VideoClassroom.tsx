import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Loader2, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { TeacherControls } from './TeacherControls';
import { StudentDataListener } from './StudentDataListener';
import { ClassroomChat } from './ClassroomChat';

interface VideoClassroomProps {
  roomName: string;
  displayName: string;
  isTeacher?: boolean;
  onClose: () => void;
}

export function VideoClassroom({ roomName, displayName, isTeacher, onClose }: VideoClassroomProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName,
          participantName: displayName,
          isTeacher: !!isTeacher,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setToken(data.token);
      setServerUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to classroom');
    } finally {
      setLoading(false);
    }
  }, [roomName, displayName, isTeacher]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50' : 'relative w-full'} bg-background border border-border rounded-lg overflow-hidden flex flex-col`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Live Classroom</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 relative" onClick={() => { setChatOpen(o => !o); setUnread(0); }}>
            <MessageSquare className="h-4 w-4" />
            {unread > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center" variant="destructive">
                {unread}
              </Badge>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className={`flex-1 ${fullscreen ? 'h-[calc(100vh-41px)]' : 'h-[500px]'}`}>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Connecting to classroom...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button size="sm" onClick={fetchToken}>Retry</Button>
          </div>
        )}

        {token && serverUrl && (
          <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            video={true}
            audio={true}
            style={{ height: '100%' }}
            onDisconnected={onClose}
          >
            <VideoConference />
            <RoomAudioRenderer />
            {isTeacher && <TeacherControls />}
            {!isTeacher && <StudentDataListener />}
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
