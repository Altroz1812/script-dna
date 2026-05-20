import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Minimize2,
  Loader2,
  MessageSquare,
  WifiOff,
  AlertTriangle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomInfo,
  useTrackToggle,
  TrackToggle,
  ParticipantTile,
  useIsConnected,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { TeacherControls } from "./TeacherControls";
import { StudentDataListener } from "./StudentDataListener";
import { ClassroomChat } from "./ClassroomChat";
import { Track } from "livekit-client";

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

type ConnectionState = "idle" | "fetching" | "ready" | "failed";

// Participant Card Component
function ParticipantCard({ participant, isLocal, isHost }: { participant: any; isLocal: boolean; isHost: boolean }) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!participant) return;

    const videoTrack = participant.getTrack(Track.Source.Camera);
    const audioTrack = participant.getTrack(Track.Source.Microphone);

    setIsVideoEnabled(videoTrack?.isEnabled ?? false);
    setIsAudioEnabled(audioTrack?.isEnabled ?? false);

    const handleTrackUpdate = () => {
      setIsVideoEnabled(videoTrack?.isEnabled ?? false);
      setIsAudioEnabled(audioTrack?.isEnabled ?? false);
    };

    const handleSpeakingUpdate = () => {
      setIsSpeaking(participant.isSpeaking || false);
    };

    participant.on("trackMuted", handleTrackUpdate);
    participant.on("trackUnmuted", handleTrackUpdate);
    participant.on("speakingChanged", handleSpeakingUpdate);

    return () => {
      participant.off("trackMuted", handleTrackUpdate);
      participant.off("trackUnmuted", handleTrackUpdate);
      participant.off("speakingChanged", handleSpeakingUpdate);
    };
  }, [participant]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={`p-3 rounded-lg transition-all ${isSpeaking ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/30"}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(participant.name || "User")}
            </AvatarFallback>
          </Avatar>
          {isHost && (
            <div className="absolute -top-1 -right-1">
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                👑
              </Badge>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {participant.name || "Anonymous"}
            {isLocal && " (You)"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {isAudioEnabled ? <Mic className="h-3 w-3 text-green-500" /> : <MicOff className="h-3 w-3 text-red-500" />}
            {isVideoEnabled ? (
              <Video className="h-3 w-3 text-green-500" />
            ) : (
              <VideoOff className="h-3 w-3 text-red-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Participants Sidebar Component
function ParticipantsSidebar({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const isConnected = useIsConnected();

  if (!isConnected) return null;

  // Filter participants - host/teacher first, then others
  const allParticipants = Array.from(participants.values());
  const hostParticipant = allParticipants.find(
    (p) => p.metadata?.includes("teacher") || p.name?.toLowerCase().includes("teacher"),
  );
  const otherParticipants = allParticipants.filter(
    (p) => p !== hostParticipant && p.identity !== localParticipant.localParticipant?.identity,
  );

  const sortedParticipants = [
    ...(hostParticipant ? [{ participant: hostParticipant, isHost: true, isLocal: false }] : []),
    ...(localParticipant.localParticipant
      ? [{ participant: localParticipant.localParticipant, isHost: false, isLocal: true }]
      : []),
    ...otherParticipants.map((p) => ({ participant: p, isHost: false, isLocal: false })),
  ];

  return (
    <div
      className={`bg-background border-l border-border transition-all duration-300 flex flex-col ${
        isExpanded ? "w-80" : "w-12"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b border-border"
      >
        {isExpanded ? (
          <>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Participants</span>
              <Badge variant="secondary" className="text-xs">
                {participants.length}
              </Badge>
            </div>
            <ChevronDown className="h-4 w-4" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Users className="h-4 w-4" />
            <Badge variant="secondary" className="text-[10px] px-1">
              {participants.length}
            </Badge>
          </div>
        )}
      </button>

      {isExpanded && (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {sortedParticipants.map(({ participant, isHost, isLocal }) => (
              <ParticipantCard key={participant.identity} participant={participant} isLocal={isLocal} isHost={isHost} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Main Video Layout Component
function VideoLayout({ isTeacher }: { isTeacher?: boolean }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const isConnected = useIsConnected();

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Find host (teacher) - prioritize participants with teacher role or first participant
  const hostParticipant =
    Array.from(participants.values()).find(
      (p) => p.metadata?.includes("teacher") || p.name?.toLowerCase().includes("teacher"),
    ) || Array.from(participants.values())[0];

  const showParticipantVideos = isTeacher; // Only teacher/admin can see participant videos
  const otherParticipants = Array.from(participants.values()).filter((p) => p !== hostParticipant);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Main Host Video */}
      <div className="flex-1 bg-black/5 dark:bg-black/20 relative min-h-0">
        {hostParticipant ? (
          <div className="h-full w-full">
            <ParticipantTile participant={hostParticipant} className="h-full w-full" />
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <p className="text-white text-sm font-medium">
                {hostParticipant.name || "Teacher"}
                {(hostParticipant.metadata?.includes("teacher") ||
                  hostParticipant.name?.toLowerCase().includes("teacher")) &&
                  " (Host)"}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-primary/50" />
              </div>
              <p className="text-muted-foreground">Waiting for host to connect...</p>
            </div>
          </div>
        )}
      </div>

      {/* Participant Videos Strip (only for teacher) */}
      {showParticipantVideos && otherParticipants.length > 0 && (
        <div className="h-32 border-t border-border bg-muted/20 p-2">
          <div className="flex gap-2 overflow-x-auto h-full">
            {otherParticipants.map((participant) => (
              <div
                key={participant.identity}
                className="w-40 h-full flex-shrink-0 relative rounded-lg overflow-hidden bg-black/10"
              >
                <ParticipantTile participant={participant} className="w-full h-full" />
                <div className="absolute bottom-1 left-1 right-1 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
                  <p className="text-white text-xs truncate">{participant.name || "Student"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Controls Component with actual LiveKit controls
function ClassroomControls({ onLeave }: { onLeave: () => void }) {
  const { toggle: toggleMic, enabled: micEnabled } = useTrackToggle(Track.Source.Microphone);
  const { toggle: toggleCam, enabled: camEnabled } = useTrackToggle(Track.Source.Camera);

  return (
    <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-center gap-2 p-3">
        <Button variant={!micEnabled ? "destructive" : "secondary"} size="sm" onClick={toggleMic} className="gap-2">
          {!micEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="hidden sm:inline">{!micEnabled ? "Unmute" : "Mute"}</span>
        </Button>

        <Button variant={!camEnabled ? "destructive" : "secondary"} size="sm" onClick={toggleCam} className="gap-2">
          {!camEnabled ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          <span className="hidden sm:inline">{!camEnabled ? "Start Video" : "Stop Video"}</span>
        </Button>

        <Button variant="destructive" size="sm" onClick={onLeave} className="gap-2">
          <span className="hidden sm:inline">Leave</span>
          <span className="sm:hidden">🚪</span>
        </Button>
      </div>
    </div>
  );
}

export function VideoClassroom({
  roomName,
  displayName,
  isTeacher,
  classStatus,
  classId,
  onClose,
  onMinimize,
  onClassStarted,
}: VideoClassroomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"unreachable" | "config" | "generic">("generic");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [waitingForTeacher, setWaitingForTeacher] = useState(!isTeacher && classStatus === "scheduled");
  const [participantsExpanded, setParticipantsExpanded] = useState(true);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const waitingPollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchToken = useCallback(async () => {
    setConnectionState("fetching");
    setError(null);
    setToken(null);
    setServerUrl(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
        body: { roomName, participantName: displayName, isTeacher: !!isTeacher },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) {
        if (data.error.includes("not configured") || data.error.includes("invalid")) {
          setErrorType("config");
        }
        throw new Error(data.error);
      }

      setToken(data.token);
      setServerUrl(data.url);
      setConnectionState("ready");

      // Safety timeout — if LiveKitRoom doesn't connect within 15s, show error
      connectionTimeoutRef.current = setTimeout(() => {
        setErrorType("unreachable");
        setError("Connection timed out. The video server did not respond in time.");
        setConnectionState("failed");
        setToken(null);
        setServerUrl(null);
      }, 15000);
    } catch (err: any) {
      if (!error) {
        setErrorType("generic");
        setError(err.message || "Failed to connect to classroom");
      }
      setConnectionState("failed");
    }
  }, [roomName, displayName, isTeacher]);

  // Poll for class status change when student is in waiting room
  useEffect(() => {
    if (!waitingForTeacher || !classId) return;

    waitingPollRef.current = setInterval(async () => {
      const { data } = await supabase.from("live_classes").select("status, meeting_url").eq("id", classId).single();

      if (data && data.status === "live") {
        setWaitingForTeacher(false);
        onClassStarted?.();
        // Now connect
        fetchToken();
      }
    }, 3000);

    return () => {
      if (waitingPollRef.current) clearInterval(waitingPollRef.current);
    };
  }, [waitingForTeacher, classId, fetchToken, onClassStarted]);

  useEffect(() => {
    if (!waitingForTeacher) {
      fetchToken();
    }
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, [fetchToken, waitingForTeacher]);

  const handleLiveKitConnected = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
  }, []);

  const handleLiveKitError = useCallback((err: Error) => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    setErrorType("unreachable");
    setError(err.message || "Lost connection to video server.");
    setConnectionState("failed");
    setToken(null);
    setServerUrl(null);
  }, []);

  const isLoading = connectionState === "fetching";
  const isFailed = connectionState === "failed";

  return (
    <div className="w-full h-full bg-background overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Live Classroom</span>
          {isTeacher && (
            <Badge variant="secondary" className="text-xs">
              Teacher
            </Badge>
          )}
          {waitingForTeacher && (
            <Badge variant="outline" className="text-xs">
              Waiting for teacher...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 relative"
            onClick={() => {
              setChatOpen(!chatOpen);
              if (!chatOpen) setUnread(0);
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {unread > 0 && !chatOpen && (
              <Badge
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center"
                variant="destructive"
              >
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

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left side - Video Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Waiting for teacher state */}
          {waitingForTeacher && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Waiting for teacher to start...</h3>
                <p className="text-sm text-muted-foreground">
                  You'll be connected automatically once the class begins.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                Leave Waiting Room
              </Button>
            </div>
          )}

          {/* Loading state */}
          {!waitingForTeacher && isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Connecting to classroom...</span>
            </div>
          )}

          {/* Error state */}
          {!waitingForTeacher && isFailed && (
            <div className="flex items-center justify-center h-full p-6">
              <Alert variant="destructive" className="max-w-md">
                {errorType === "unreachable" ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <AlertTitle>
                  {errorType === "unreachable"
                    ? "Video server unreachable"
                    : errorType === "config"
                      ? "Configuration error"
                      : "Connection failed"}
                </AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-3">
                    {errorType === "unreachable"
                      ? "The video server is not responding. This may be due to server maintenance or an incorrect server URL. Please try again later or contact your administrator."
                      : errorType === "config"
                        ? "The video service is not properly configured. Please contact your administrator to check the server settings."
                        : error || "An unexpected error occurred while connecting to the classroom."}
                  </p>
                  {errorType === "unreachable" && (
                    <p className="text-xs text-muted-foreground mb-3">Server URL may be inactive or unreachable.</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={fetchToken}>
                      Retry
                    </Button>
                    <Button size="sm" variant="outline" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* LiveKit Room - Connected state */}
          {token && serverUrl && connectionState === "ready" && !waitingForTeacher && (
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              connect={true}
              video={true}
              audio={true}
              className="flex-1 flex flex-col overflow-hidden"
              onConnected={handleLiveKitConnected}
              onError={handleLiveKitError}
              onDisconnected={onClose}
            >
              <VideoLayout isTeacher={isTeacher} />
              <ClassroomControls onLeave={onClose} />
              <RoomAudioRenderer />
              {/* Keep original teacher/student components */}
              {isTeacher && <TeacherControls />}
              {!isTeacher && <StudentDataListener />}
            </LiveKitRoom>
          )}
        </div>

        {/* Right side - Participants Sidebar - Only show when connected */}
        {token && serverUrl && connectionState === "ready" && !waitingForTeacher && (
          <ParticipantsSidebar
            isExpanded={participantsExpanded}
            onToggle={() => setParticipantsExpanded(!participantsExpanded)}
          />
        )}

        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-80 shrink-0 border-l border-border bg-background">
            <ClassroomChat onClose={() => setChatOpen(false)} onNewMessage={() => setUnread((u) => u + 1)} />
          </div>
        )}
      </div>
    </div>
  );
}
