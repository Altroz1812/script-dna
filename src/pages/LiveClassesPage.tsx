import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, Minimize2, Loader2, MessageSquare, Mic, MicOff, 
  Video, VideoOff, Users, Clock, Monitor, Hand, MoreVertical 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Participant Item
function ParticipantItem({ participant, isLocal }: { 
  participant: any; 
  isLocal?: boolean 
}) {
  const hasVideo = participant.getTrack(Track.Source.Camera)?.isSubscribed;
  const hasAudio = participant.getTrack(Track.Source.Microphone)?.isSubscribed;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 rounded-xl transition-colors">
      <div className="relative">
        <Avatar className="h-9 w-9 ring-1 ring-border">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {(participant.name || 'U').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {participant.isAgent && <div className="absolute -top-0.5 -right-0.5 text-base">👑</div>}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">
          {participant.name || 'Participant'}
          {isLocal && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{hasAudio ? '🎤' : '🔇'}</span>
          <span>{hasVideo ? '📹' : '📹❌'}</span>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function VideoClassroom({
  roomName,
  displayName,
  isTeacher = false,
  classStatus,
  classId,
  onClose,
  onMinimize,
  onClassStarted,
}: VideoClassroomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'idle' | 'fetching' | 'ready' | 'failed'>('idle');
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [unread, setUnread] = useState(0);
  const [classTime, setClassTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchToken = useCallback(async () => {
    setConnectionState('fetching');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('livekit-token', {
        body: { roomName, participantName: displayName, isTeacher },
      });

      if (fnError || data?.error) throw new Error(data?.error || fnError?.message);

      setToken(data.token);
      setServerUrl(data.url);
      setConnectionState('ready');
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      setConnectionState('failed');
    }
  }, [roomName, displayName, isTeacher]);

  // Class Timer
  useEffect(() => {
    if (connectionState === 'ready') {
      timerRef.current = setInterval(() => {
        setClassTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [connectionState]);

  // Auto-connect
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const handleConnected = () => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
  };

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center px-4 shrink-0 z-10">
        <div className="flex items-center gap-3 flex-1">
          <div className="font-semibold text-lg">Live Class</div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {isTeacher ? 'Host' : 'Student'}
          </Badge>
          {isRecording && (
            <Badge variant="destructive" className="gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTime(classTime)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('chat')}>
              <MessageSquare className="h-5 w-5" />
              {unread > 0 && <Badge className="ml-1">{unread}</Badge>}
            </Button>

            {onMinimize && (
              <Button variant="ghost" size="icon" onClick={onMinimize}>
                <Minimize2 className="h-5 w-5" />
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col relative bg-black">
          {connectionState === 'fetching' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-lg">Connecting to classroom...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/90 z-20">
              <Alert variant="destructive" className="max-w-md">
                <AlertTitle>Connection Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button onClick={fetchToken} className="mt-4">Retry Connection</Button>
              </Alert>
            </div>
          )}

          {token && serverUrl && (
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              connect={true}
              video={true}
              audio={true}
              className="flex-1 flex flex-col"
              onConnected={handleConnected}
              onDisconnected={onClose}
            >
              <MainVideoArea isTeacher={isTeacher} />
              <ControlBar isTeacher={isTeacher} onLeave={onClose} />
              <RoomAudioRenderer />
            </LiveKitRoom>
          )}
        </div>

        {/* Right Sidebar - Professional Tabbed Panel */}
        {token && serverUrl && (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800 m-2">
                <TabsTrigger value="participants" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="participants" className="flex-1 mt-0">
                <ParticipantsPanel />
              </TabsContent>

              <TabsContent value="chat" className="flex-1 mt-0">
                <ChatPanel onNewMessage={() => setUnread(u => u + 1)} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== Sub Components ==================== */

function MainVideoArea({ isTeacher }: { isTeacher: boolean }) {
  const participants = useParticipants();
  const host = participants.find(p => p.isAgent || p.name?.toLowerCase().includes('teacher')) || participants[0];

  return (
    <div className="flex-1 relative bg-black flex items-center justify-center">
      {host ? (
        <div className="relative w-full h-full">
          <video
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            ref={(el) => {
              const track = host.getTrack(Track.Source.Camera);
              if (el && track?.track) {
                el.srcObject = new MediaStream([track.track.mediaStreamTrack]);
              }
            }}
          />
          <div className="absolute bottom-6 left-6 bg-black/70 px-4 py-2 rounded-xl text-white">
            {host.name || 'Teacher'} {host.isAgent && '• Host'}
          </div>
        </div>
      ) : (
        <div className="text-center text-zinc-400">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
          <p>Waiting for host video...</p>
        </div>
      )}

      {/* Floating student previews (for teacher) */}
      {isTeacher && participants.length > 1 && (
        <div className="absolute bottom-6 right-6 flex gap-3">
          {participants.slice(0, 3).map((p, i) => (
            p !== host && (
              <div key={i} className="w-40 h-28 bg-zinc-900 rounded-xl overflow-hidden ring-2 ring-white/20">
                <video autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
                  {p.name}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantsPanel() {
  const participants = useParticipants();
  const local = useLocalParticipant();

  return (
    <ScrollArea className="h-full px-2">
      <div className="space-y-1 py-2">
        {participants.map((p) => (
          <ParticipantItem 
            key={p.identity} 
            participant={p} 
            isLocal={p.identity === local.localParticipant?.identity} 
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ChatPanel({ onNewMessage }: { onNewMessage: () => void }) {
  const [messages, setMessages] = useState<Array<{id: string; name: string; text: string; time: string}>>([]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      name: 'You',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setInput('');
    onNewMessage();
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-zinc-500 py-12">No messages yet. Say hello!</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className="bg-zinc-800/50 rounded-2xl p-3">
              <div className="flex justify-between text-xs mb-1 text-zinc-400">
                <span className="font-medium text-white">{m.name}</span>
                <span>{m.time}</span>
              </div>
              <p className="text-sm">{m.text}</p>
            </div>
          ))
        )}
      </ScrollArea>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  );
}

function ControlBar({ isTeacher, onLeave }: { isTeacher: boolean; onLeave: () => void }) {
  const local = useLocalParticipant();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const toggleMic = async () => {
    await local.localParticipant?.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  };

  const toggleCam = async () => {
    await local.localParticipant?.setCameraEnabled(!camOn);
    setCamOn(!camOn);
  };

  return (
    <div className="h-16 bg-zinc-900/95 border-t border-zinc-800 flex items-center justify-center gap-3 z-20">
      <Button
        variant={micOn ? "default" : "destructive"}
        size="lg"
        onClick={toggleMic}
        className="rounded-full"
      >
        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>

      <Button
        variant={camOn ? "default" : "destructive"}
        size="lg"
        onClick={toggleCam}
        className="rounded-full"
      >
        {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>

      {isTeacher && (
        <Button variant="outline" size="lg" className="rounded-full gap-2">
          <Monitor className="h-5 w-5" />
          Share Screen
        </Button>
      )}

      <Button 
        variant="destructive" 
        size="lg" 
        onClick={onLeave}
        className="rounded-full"
      >
        Leave
      </Button>
    </div>
  );
}
