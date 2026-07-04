import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Video, VideoOff, ScreenShare, Crown, User as UserIcon } from 'lucide-react';

function roleOf(metadata?: string): { role: string; isModerator: boolean } {
  if (!metadata) return { role: 'student', isModerator: false };
  try {
    const m = JSON.parse(metadata);
    const role = (m?.role || 'student').toString();
    return { role, isModerator: m?.bucket === 'moderator' };
  } catch {
    return { role: 'student', isModerator: false };
  }
}

export function ParticipantsPanel({ onClose }: { onClose: () => void }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const localId = room.localParticipant.identity;

  // Moderators first, then by name
  const sorted = [...participants].sort((a, b) => {
    const ra = roleOf(a.metadata).isModerator ? 0 : 1;
    const rb = roleOf(b.metadata).isModerator ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  return (
    <div className="h-full w-full flex flex-col bg-background border-l border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-sm font-semibold">Participants ({participants.length})</div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
        {sorted.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">No participants yet.</div>
        ) : (
          sorted.map((p) => {
            const { role, isModerator } = roleOf(p.metadata);
            const micPub = p.getTrackPublication?.(Track.Source.Microphone);
            const camPub = p.getTrackPublication?.(Track.Source.Camera);
            const screenPub = p.getTrackPublication?.(Track.Source.ScreenShare);
            const micOn = !!micPub && !micPub.isMuted;
            const camOn = !!camPub && !camPub.isMuted;
            const sharing = !!screenPub && !screenPub.isMuted;
            const isMe = p.identity === localId;
            return (
              <div key={p.identity} className="flex items-center gap-2 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {isModerator ? (
                    <Crown className="h-4 w-4 text-amber-500" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.name || p.identity}
                    {isMe && <span className="text-[10px] text-muted-foreground ml-1">(You)</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {isModerator ? role || 'moderator' : role || 'student'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sharing && <ScreenShare className="h-3.5 w-3.5 text-emerald-500" />}
                  {micOn ? (
                    <Mic className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {camOn ? (
                    <Video className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}