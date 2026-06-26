import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mic, MicOff, Video, VideoOff, UserX, Shield, Users, Check } from 'lucide-react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TeacherControls() {
  const room = useRoomContext();
  const participants = useParticipants();
  const remoteParticipants = participants.filter(
    (p) => p.identity !== room.localParticipant.identity
  );

  // Per-identity granted publish sources (mic / camera independent).
  // Note: this is teacher-side bookkeeping; LiveKit is the source of truth.
  const [grants, setGrants] = useState<Record<string, { mic: boolean; cam: boolean }>>({});

  const getGrant = (id: string) => grants[id] ?? { mic: false, cam: false };

  const applyGrant = useCallback(
    async (identity: string, next: { mic: boolean; cam: boolean }) => {
      const sources: string[] = [];
      if (next.mic) sources.push('microphone');
      if (next.cam) sources.push('camera');
      // Always allow screen share alongside any granted publish so teachers
      // can selectively allow students to share without re-granting later.
      if (next.mic || next.cam) sources.push('screen_share', 'screen_share_audio');
      const ok = await updatePermission(identity, {
        canPublish: next.mic || next.cam,
        sources,
      });
      if (ok) setGrants((g) => ({ ...g, [identity]: next }));
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.name],
  );

  const updatePermission = async (
    identity: string,
    opts: { canPublish: boolean; sources: string[] },
  ) => {
    const { data, error } = await supabase.functions.invoke('livekit-update-participant', {
      body: {
        roomName: room.name,
        identity,
        canPublish: opts.canPublish,
        canPublishSources: opts.sources,
        canPublishData: true,
        canSubscribe: true,
      },
    });
    if (error || (data && data.error)) {
      toast({
        title: 'Failed to update permissions',
        description: error?.message || data?.error,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const signal = (action: string, target: string) => {
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ action, target })),
      { reliable: true },
    );
  };

  const grantMic = async (identity: string) => {
    const cur = getGrant(identity);
    const ok = await applyGrant(identity, { ...cur, mic: true });
    if (ok) {
      signal('enable_audio', identity);
      toast({ title: 'Microphone allowed', description: identity });
    }
  };

  const revokeMic = async (identity: string) => {
    const cur = getGrant(identity);
    const ok = await applyGrant(identity, { ...cur, mic: false });
    if (ok) {
      signal('mute_audio', identity);
      toast({ title: 'Microphone revoked', description: identity });
    }
  };

  const grantCamera = async (identity: string) => {
    const cur = getGrant(identity);
    const ok = await applyGrant(identity, { ...cur, cam: true });
    if (ok) {
      signal('enable_camera', identity);
      toast({ title: 'Camera allowed', description: identity });
    }
  };

  const revokeCamera = async (identity: string) => {
    const cur = getGrant(identity);
    const ok = await applyGrant(identity, { ...cur, cam: false });
    if (ok) {
      signal('disable_camera', identity);
      toast({ title: 'Camera revoked', description: identity });
    }
  };

  const muteAllMics = async () => {
    for (const p of remoteParticipants) {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ action: 'mute_audio', target: p.identity })),
        { reliable: true }
      );
    }
    toast({
      title: 'Muted all participants',
      description: `Sent mute request to ${remoteParticipants.length} participant(s)`,
    });
  };

  const disableAllCameras = async () => {
    for (const p of remoteParticipants) {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ action: 'disable_camera', target: p.identity })),
        { reliable: true }
      );
    }
    toast({
      title: 'Cameras disabled',
      description: `Sent disable camera request to ${remoteParticipants.length} participant(s)`,
    });
  };

  const revokeAll = async (identity: string) => {
    const ok = await applyGrant(identity, { mic: false, cam: false });
    if (ok) {
      signal('mute_audio', identity);
      signal('disable_camera', identity);
      toast({ title: 'All publish permissions revoked', description: identity });
    }
  };

  const removeParticipant = (identity: string) => {
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ action: 'remove', target: identity })),
      { reliable: true }
    );
    toast({
      title: 'Remove request sent',
      description: 'The participant will be disconnected.',
      variant: 'destructive',
    });
  };

  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {/* Bulk actions */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
        onClick={muteAllMics}
        title="Mute all participants"
      >
        <MicOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Mute All</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
        onClick={disableAllCameras}
        title="Disable all cameras"
      >
        <VideoOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cams Off</span>
      </Button>

      {/* Per-participant dropdown */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Manage</span> ({remoteParticipants.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="w-64 max-h-[70vh] overflow-y-auto z-[200]"
        >
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Participant Controls
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {remoteParticipants.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No other participants
            </div>
          ) : (
            remoteParticipants.map((p) => {
              const g = getGrant(p.identity);
              return (
                <div key={p.identity}>
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground py-1 flex items-center justify-between gap-2">
                    <span className="truncate">{p.name || p.identity}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {g.mic && <Mic className="h-3 w-3 text-emerald-500" />}
                      {g.cam && <Video className="h-3 w-3 text-emerald-500" />}
                    </span>
                  </DropdownMenuLabel>
                  {g.mic ? (
                    <DropdownMenuItem onClick={() => revokeMic(p.identity)} className="gap-2 text-xs">
                      <MicOff className="h-3.5 w-3.5" /> Revoke Mic
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => grantMic(p.identity)} className="gap-2 text-xs">
                      <Mic className="h-3.5 w-3.5" /> Grant Mic
                    </DropdownMenuItem>
                  )}
                  {g.cam ? (
                    <DropdownMenuItem onClick={() => revokeCamera(p.identity)} className="gap-2 text-xs">
                      <VideoOff className="h-3.5 w-3.5" /> Revoke Camera
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => grantCamera(p.identity)} className="gap-2 text-xs">
                      <Video className="h-3.5 w-3.5" /> Grant Camera
                    </DropdownMenuItem>
                  )}
                  {(g.mic || g.cam) && (
                    <DropdownMenuItem onClick={() => revokeAll(p.identity)} className="gap-2 text-xs">
                      <Check className="h-3.5 w-3.5" /> Revoke All Publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => removeParticipant(p.identity)}
                    className="gap-2 text-xs text-destructive focus:text-destructive"
                  >
                    <UserX className="h-3.5 w-3.5" /> Remove
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
