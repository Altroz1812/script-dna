import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Minimize2, Loader2, MessageSquare, WifiOff, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  classStatus?: string;
  classId?: string;
  onClose: () => void;
  onMinimize?: () => void;
  onClassStarted?: () => void;
}

type ConnectionState = 'idle' | 'fetching' | 'ready' | 'failed';

export function VideoClassroom({ roomName, displayName, isTeacher, classStatus, classId, onClose, onMinimize, onClassStarted }: VideoClassroomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'unreachable' | 'config' | 'generic'>('generic');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [waitingForTeacher, setWaitingForTeacher] = useState(!isTeacher && classStatus === 'scheduled');
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const waitingPollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchToken = useCallback(async () => {
    setConnectionState('fetching');
    setError(null);
    setToken(null);
    setServerUrl(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('livekit-token', {
        body: { roomName, participantName: displayName, isTeacher: !!isTeacher },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) {
        if (data.error.includes('not configured') || data.error.includes('invalid')) {
          setErrorType('config');
        }
        throw new Error(data.error);
      }

      setToken(data.token);
      setServerUrl(data.url);
      setConnectionState('ready');

      // Safety timeout — if LiveKitRoom doesn't connect within 15s, show error
      connectionTimeoutRef.current = setTimeout(() => {
        setErrorType('unreachable');
        setError('Connection timed out. The video server did not respond in time.');
        setConnectionState('failed');
        setToken(null);
        setServerUrl(null);
      }, 15000);
    } catch (err: any) {
      if (!error) {
        setErrorType('generic');
        setError(err.message || 'Failed to connect to classroom');
      }
      setConnectionState('failed');
    }
  }, [roomName, displayName, isTeacher]);

  // Poll for class status change when student is in waiting room
  useEffect(() => {
    if (!waitingForTeacher || !classId) return;
    
    waitingPollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('live_classes')
        .select('status, meeting_url')
        .eq('id', classId)
        .single();
      
      if (data && data.status === 'live') {
        setWaitingForTeacher(false);
        onClassStarted?.();
        // Now connect
        fetchToken();
      }
    }, 3000);

    return () => { if (waitingPollRef.current) clearInterval(waitingPollRef.current); };
  }, [waitingForTeacher, classId, fetchToken, onClassStarted]);

  useEffect(() => {
    if (!waitingForTeacher) {
      fetchToken();
    }
    return () => { if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current); };
  }, [fetchToken, waitingForTeacher]);

  const handleLiveKitConnected = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
  }, []);

  const handleLiveKitError = useCallback((err: Error) => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    setErrorType('unreachable');
    setError(err.message || 'Lost connection to video server.');
    setConnectionState('failed');
    setToken(null);
    setServerUrl(null);
  }, []);

  const isLoading = connectionState === 'fetching';
  const isFailed = connectionState === 'failed';

  return (
    <div className="w-full h-full bg-background overflow-hidden flex flex-col">
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
          {onMinimize && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize} title="Minimize">
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Leave class">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          {waitingForTeacher && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Waiting for teacher to start…</h3>
                <p className="text-sm text-muted-foreground">You'll be connected automatically once the class begins.</p>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>Leave Waiting Room</Button>
            </div>
          )}

          {!waitingForTeacher && isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Connecting to classroom...
              </span>
            </div>
          )}

          {!waitingForTeacher && isFailed && (
            <div className="flex items-center justify-center h-full p-6">
              <Alert variant="destructive" className="max-w-md">
                {errorType === 'unreachable' ? (
                  <WifiOff className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <AlertTitle>
                  {errorType === 'unreachable' ? 'Video server unreachable' : errorType === 'config' ? 'Configuration error' : 'Connection failed'}
                </AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-3">
                    {errorType === 'unreachable'
                      ? 'The video server is not responding. This may be due to server maintenance or an incorrect server URL. Please try again later or contact your administrator.'
                      : errorType === 'config'
                        ? 'The video service is not properly configured. Please contact your administrator to check the server settings.'
                        : error || 'An unexpected error occurred while connecting to the classroom.'}
                  </p>
                  {errorType === 'unreachable' && (
                    <p className="text-xs text-muted-foreground mb-3">Server URL may be inactive or unreachable.</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={fetchToken}>Retry</Button>
                    <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {token && serverUrl && connectionState === 'ready' && (
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              connect={true}
              video={true}
              audio={true}
              style={{ height: '100%' }}
              onConnected={handleLiveKitConnected}
              onError={handleLiveKitError}
              onDisconnected={onClose}
            >
              <VideoConference />
              <RoomAudioRenderer />
              {isTeacher && <TeacherControls />}
              {!isTeacher && <StudentDataListener />}
              {chatOpen && (
                <div className="fixed right-0 top-0 bottom-0 w-80 z-50">
                  <ClassroomChat onNewMessage={() => { if (!chatOpen) setUnread(u => u + 1); }} />
                </div>
              )}
            </LiveKitRoom>
          )}
        </div>
      </div>
    </div>
  );
}
