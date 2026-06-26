import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Minimize2, Loader2, MessageSquare, WifiOff, AlertTriangle, RotateCw, CheckCircle2, Unplug, Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import {
  LiveKitRoom,
  useTracks,
  useParticipants,
  VideoTrack,
  RoomAudioRenderer,
  useRoomContext,
} from '@livekit/components-react';
import {
  Track,
  type Participant,
  type RoomOptions,
  VideoPresets,
  AudioPresets,
  DisconnectReason,
  RoomEvent,
} from 'livekit-client';
import '@livekit/components-styles';
import { StudentDataListener } from './StudentDataListener';
import { ClassroomChat } from './ClassroomChat';
import { RoleAwareControls } from './RoleAwareControls';
import { MicOff, ScreenShare, User as UserIcon } from 'lucide-react';

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

// Tuned room options for stability + adaptive quality.
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: true,
    dtx: true,
    red: true,
    // Higher bitrate stereo opus for noticeably better voice clarity & loudness
    audioPreset: AudioPresets.musicHighQuality,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    videoCodec: 'vp8',
  },
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
  },
  reconnectPolicy: {
    nextRetryDelayInMs: (ctx) => {
      // Exponential backoff up to 10s, give up after ~12 attempts
      if (ctx.retryCount > 12) return null;
      return Math.min(1000 * Math.pow(1.5, ctx.retryCount), 10_000);
    },
  },
  disconnectOnPageLeave: true,
};

export function VideoClassroom({ roomName, displayName, isTeacher, classStatus, classId, onClose, onMinimize, onClassStarted }: VideoClassroomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'unreachable' | 'config' | 'generic'>('generic');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [waitingForTeacher, setWaitingForTeacher] = useState(!isTeacher && classStatus === 'scheduled');
  const [reconnecting, setReconnecting] = useState(false);
  const [livekitConnected, setLivekitConnected] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const intentionalCloseRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const [joinKey, setJoinKey] = useState(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const waitingPollRef = useRef<ReturnType<typeof setInterval>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchToken = useCallback(async () => {
    setConnectionState('fetching');
    setError(null);
    setToken(null);
    setServerUrl(null);
    setLivekitConnected(false);
    // Fresh join — clear any stale "intentional close" flag and bump the join
    // key so LiveKitRoom remounts cleanly even if the new token string happens
    // to match (prevents stale Room state across rejoins).
    intentionalCloseRef.current = false;
    setReconnecting(false);
    setJoinKey((k) => k + 1);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('livekit-token', {
        body: { roomName, participantName: displayName },
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

      // Safety timeout — if LiveKitRoom doesn't connect within 30s, show error
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        setErrorType('unreachable');
        setError('Connection timed out. The video server did not respond in time.');
        setConnectionState('failed');
        setToken(null);
        setServerUrl(null);
      }, 30_000);
    } catch (err: any) {
      setErrorType((t) => (t === 'config' ? t : 'generic'));
      setError(err.message || 'Failed to connect to classroom');
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
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchToken, waitingForTeacher]);

  // Network online/offline awareness
  useEffect(() => {
    const on = () => {
      setOnline(true);
      // If we previously failed because of net, try again automatically
      if (connectionState === 'failed' && errorType === 'unreachable') {
        retryAttemptRef.current = 0;
        fetchToken();
      }
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [connectionState, errorType, fetchToken]);

  const handleLiveKitConnected = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    retryAttemptRef.current = 0;
    setReconnecting(false);
    setLivekitConnected(true);
  }, []);

  const handleReconnecting = useCallback(() => setReconnecting(true), []);
  const handleReconnected = useCallback(() => setReconnecting(false), []);

  const handleLiveKitError = useCallback((err: Error) => {
    // Don't tear down on transient errors — LiveKit will try to recover.
    // Just surface a soft "reconnecting" badge.
    setReconnecting(true);
    // eslint-disable-next-line no-console
    console.warn('[LiveKit] error:', err?.message || err);
  }, []);

  const handleLiveKitDisconnected = useCallback((reason?: DisconnectReason) => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    // User-initiated leave → close.
    if (intentionalCloseRef.current || reason === DisconnectReason.CLIENT_INITIATED) {
      onClose();
      return;
    }
    // Server replaced this session because the same identity rejoined from
    // another tab/device, or the moderator removed the participant. Either way
    // do NOT auto-reconnect — that would steal the new session back and cause
    // a rejoin loop / "out of sync" symptoms.
    if (
      reason === DisconnectReason.DUPLICATE_IDENTITY ||
      reason === DisconnectReason.PARTICIPANT_REMOVED ||
      reason === DisconnectReason.ROOM_DELETED
    ) {
      intentionalCloseRef.current = true;
      onClose();
      return;
    }
    // Try to recover automatically with a fresh token (handles expired token, server hiccups).
    const attempt = retryAttemptRef.current++;
    if (attempt >= 4) {
      setErrorType('unreachable');
      setError('Lost connection to the classroom. Please retry.');
      setConnectionState('failed');
      setToken(null);
      setServerUrl(null);
      setReconnecting(false);
      return;
    }
    setReconnecting(true);
    const delay = Math.min(1500 * Math.pow(1.7, attempt), 8000);
    retryTimerRef.current = setTimeout(() => fetchToken(), delay);
  }, [fetchToken, onClose]);

  const handleLeave = useCallback(() => {
    intentionalCloseRef.current = true;
    onClose();
  }, [onClose]);

  const isLoading = connectionState === 'fetching';
  const isFailed = connectionState === 'failed';

  return (
    <div className="w-full h-full bg-background overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Live Classroom</span>
          {!online && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}
          {online && reconnecting && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <RotateCw className="h-3 w-3 animate-spin" /> Reconnecting…
            </Badge>
          )}
        </div>
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLeave} title="Leave class">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 h-full relative flex">
          {waitingForTeacher && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Waiting for teacher to start…</h3>
                <p className="text-sm text-muted-foreground">You'll be connected automatically once the class begins.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLeave}>Leave Waiting Room</Button>
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
                    <Button size="sm" onClick={() => { retryAttemptRef.current = 0; fetchToken(); }}>Retry</Button>
                    <Button size="sm" variant="outline" onClick={handleLeave}>Close</Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {token && serverUrl && connectionState === 'ready' && (
            <LiveKitRoom
              key={`${joinKey}:${token}` /* force fresh Room on each (re)join */}
              serverUrl={serverUrl}
              token={token}
              connect={true}
              video={!!isTeacher}
              audio={!!isTeacher}
              options={ROOM_OPTIONS}
              style={{ height: '100%', width: '100%', display: 'flex' }}
              onConnected={handleLiveKitConnected}
              onError={handleLiveKitError}
              onDisconnected={handleLiveKitDisconnected}
            >
              <ReconnectWatcher onReconnecting={handleReconnecting} onReconnected={handleReconnected} />
              <ClassroomStage isTeacher={!!isTeacher} onLeave={handleLeave} />
              <RoomAudioRenderer />
              <StudentDataListener />
              {chatOpen && (
                <>
                  {/* Backdrop (mobile fullscreen, desktop overlay-less) */}
                  <div
                    className="absolute inset-0 z-10 bg-black/50 sm:hidden"
                    onClick={() => setChatOpen(false)}
                  />
                  {/* Mobile: bottom sheet. Desktop: right side panel */}
                  <div
                    className="absolute z-20 shadow-2xl
                      inset-x-0 bottom-0 h-[70vh] rounded-t-2xl overflow-hidden
                      sm:relative sm:inset-auto sm:h-full sm:w-80 sm:rounded-none sm:shadow-none sm:shrink-0"
                  >
                    <ClassroomChat onClose={() => setChatOpen(false)} onNewMessage={() => setUnread(u => u + 1)} />
                  </div>
                </>
              )}
            </LiveKitRoom>
          )}
        </div>
      </div>
    </div>
  );
}

function isModerator(p: Participant | undefined): boolean {
  if (!p) return false;
  if (p.metadata) {
    try {
      const m = JSON.parse(p.metadata);
      if (m?.bucket === 'moderator') return true;
    } catch { /* ignore */ }
  }
  return !!p.permissions?.canPublish && !!p.permissions?.canPublishData;
}

function ReconnectWatcher({
  onReconnecting,
  onReconnected,
}: {
  onReconnecting: () => void;
  onReconnected: () => void;
}) {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, onReconnecting, onReconnected]);
  return null;
}

function ClassroomStage({ isTeacher, onLeave }: { isTeacher: boolean; onLeave: () => void }) {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const screenTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  );
  const participants = useParticipants();

  // Determine main track:
  // 1) active screen-share, 2) host (moderator) camera, 3) first camera.
  const moderator = participants.find(isModerator);
  const publishedCams = cameraTracks.filter((t) => !!t.publication);
  const hostCam =
    publishedCams.find((t) => t.participant.identity === moderator?.identity)
    ?? cameraTracks.find((t) => t.participant.identity === moderator?.identity)
    ?? publishedCams[0]
    ?? cameraTracks[0];
  const screen = screenTracks[0];
  const mainTrack = screen ?? hostCam;
  const mainIsScreen = !!screen;
  const mainHasVideo = mainIsScreen || !!hostCam?.publication;

  // PiP tiles: every camera track EXCEPT the one currently on the main stage
  // (unless screen is main — then include host camera too).
  const pipTracks = cameraTracks.filter((t) => {
    if (mainIsScreen) return true;
    return t !== hostCam;
  });

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-black">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Main stage — chromeless full-bleed */}
        {mainTrack && mainHasVideo ? (
          <div className="absolute inset-0">
            <VideoTrack
              trackRef={mainTrack as any}
              className="w-full h-full object-contain bg-black"
            />
            {/* Name label */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-sm">
                {mainIsScreen && <ScreenShare className="h-3.5 w-3.5 text-white" />}
                <span className="text-xs font-medium text-white truncate max-w-[60vw]">
                  {mainTrack.participant?.name || mainTrack.participant?.identity || 'Host'}
                  {mainIsScreen ? ' · sharing screen' : ''}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center">
              <UserIcon className="h-8 w-8" />
            </div>
            <span>
              {mainTrack?.participant?.name || mainTrack?.participant?.identity || 'Host'} · camera off
            </span>
          </div>
        )}

        {/* Chromeless PiP strip */}
        {pipTracks.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-col gap-2 max-h-[70%] overflow-y-auto pr-0.5">
            {pipTracks.map((t, idx) => {
              const p = t.participant;
              const micPub = p?.getTrackPublication?.(Track.Source.Microphone);
              const micMuted = micPub ? micPub.isMuted : true;
              const isHost = mainIsScreen && p?.identity === moderator?.identity;
              return (
                <div
                  key={`${p?.identity || 'p'}-${idx}`}
                  className="relative w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden ring-1 ring-white/15 bg-black/60 shadow-lg"
                >
                  <VideoTrack
                    trackRef={t as any}
                    className="w-full h-full object-cover"
                  />
                  {/* Fallback avatar when camera off */}
                  {(!t.publication || t.publication.isMuted) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                      <UserIcon className="h-6 w-6 text-white/60" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-white truncate bg-black/50 px-1.5 py-0.5 rounded">
                      {isHost ? 'Host' : (p?.name || p?.identity?.slice(0, 8) || '—')}
                    </span>
                    {micMuted && (
                      <span className="rounded bg-black/60 p-0.5">
                        <MicOff className="h-3 w-3 text-red-400" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <RoleAwareControls onLeave={onLeave} />
    </div>
  );
}
