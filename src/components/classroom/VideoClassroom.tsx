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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTrackToggle,
  TrackToggle,
  useRoomContext,
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

// Simple participants list component
function ParticipantsList({ displayName }: { displayName: string }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // Separate host (teacher) from others
  const hostParticipant = participants.find((p) => p.isAgent || p.name?.includes("Teacher"));
  const otherParticipants = participants.filter((p) => p !== hostParticipant);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {hostParticipant && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(hostParticipant.name || "Teacher")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{hostParticipant.name || "Teacher"} 👑</p>
              </div>
            </div>
          </div>
        )}

        {localParticipant.localParticipant && (
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-xs">{getInitials(displayName || "You")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{displayName} (You)</p>
              </div>
            </div>
          </div>
        )}

        {otherParticipants.map((participant) => (
          <div key={participant.identity} className="p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-xs">
                  {getInitials(participant.name || "Student")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{participant.name || "Student"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Custom controls component
function CustomControls({ onLeave }: { onLeave: () => void }) {
  const { toggle: toggleMic, enabled: micEnabled } = useTrackToggle(Track.Source.Microphone);
  const { toggle: toggleCam, enabled: camEnabled } = useTrackToggle(Track.Source.Camera);

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 p-2 bg-background/95 backdrop-blur rounded-lg shadow-lg border">
      <Button variant={!micEnabled ? "destructive" : "secondary"} size="sm" onClick={toggleMic} className="gap-1">
        {!micEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

      <Button variant={!camEnabled ? "destructive" : "secondary"} size="sm" onClick={toggleCam} className="gap-1">
        {!camEnabled ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </Button>

      <Button variant="destructive" size="sm" onClick={onLeave}>
        Leave
      </Button>
    </div>
  );
}

// Custom video layout - host takes main space
function CustomVideoLayout() {
  const participants = useParticipants();
  const room = useRoomContext();

  // Find host (teacher)
  const hostParticipant = participants.find((p) => p.isAgent || p.name?.includes("Teacher")) || participants[0];

  return (
    <div className="relative w-full h-full bg-black">
      {/* Main video - always shows host */}
      {hostParticipant ? (
        <div className="w-full h-full">
          <VideoConference />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Waiting for host...</p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <CustomControls onLeave={() => window.dispatchEvent(new Event("leave-classroom"))} />
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
  const [showParticipants, setShowParticipants] = useState(true);
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

  // Listen for leave event from custom controls
  useEffect(() => {
    const handleLeave = () => onClose();
    window.addEventListener("leave-classroom", handleLeave);
    return () => window.removeEventListener("leave-classroom", handleLeave);
  }, [onClose]);

  const isLoading = connectionState === "fetching";
  const isFailed = connectionState === "failed";

  return (
    <div className="w-full h-full bg-background overflow-hidden flex flex-col">
      {/* Header bar - unchanged from original */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Live Classroom</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 relative"
            onClick={() => {
              setChatOpen((o) => !o);
              setUnread(0);
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {unread > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center"
                variant="destructive"
              >
                {unread}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowParticipants(!showParticipants)}
            title="Participants"
          >
            <Users className="h-4 w-4" />
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

      {/* Content area - modified for new layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main video area */}
        <div className="flex-1 relative">
          {waitingForTeacher && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Waiting for teacher to start…</h3>
                <p className="text-sm text-muted-foreground">
                  You'll be connected automatically once the class begins.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                Leave Waiting Room
              </Button>
            </div>
          )}

          {!waitingForTeacher && isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Connecting to classroom...</span>
            </div>
          )}

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

          {token && serverUrl && connectionState === "ready" && (
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              connect={true}
              video={true}
              audio={true}
              style={{ height: "100%", width: "100%" }}
              onConnected={handleLiveKitConnected}
              onError={handleLiveKitError}
              onDisconnected={onClose}
            >
              <CustomVideoLayout />
              <RoomAudioRenderer />
              {isTeacher && <TeacherControls />}
              {!isTeacher && <StudentDataListener />}
            </LiveKitRoom>
          )}
        </div>

        {/* Participants sidebar - collapsible */}
        {token && serverUrl && connectionState === "ready" && showParticipants && (
          <div className="w-64 border-l border-border bg-background flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="font-medium text-sm">Participants</h3>
            </div>
            <ParticipantsList displayName={displayName} />
          </div>
        )}

        {/* Chat panel - same as original */}
        {chatOpen && (
          <div className="w-80 shrink-0 border-l border-border">
            <ClassroomChat onClose={() => setChatOpen(false)} onNewMessage={() => setUnread((u) => u + 1)} />
          </div>
        )}
      </div>
    </div>
  );
}
