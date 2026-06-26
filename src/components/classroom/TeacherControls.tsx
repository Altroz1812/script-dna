import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mic, MicOff, Video, VideoOff, UserX, Shield, Users } from 'lucide-react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TeacherControls() {
  const room = useRoomContext();
  const participants = useParticipants();
  const remoteParticipants = participants.filter(
    (p) => p.identity !== room.localParticipant.identity
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

  const enableMic = async (identity: string) => {
    const ok = await updatePermission(identity, {
      canPublish: true,
      sources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
    });
    if (ok) {
      signal('enable_audio', identity);
      toast({ title: 'Microphone enabled for participant' });
    }
  };

  const enableCamera = async (identity: string) => {
    const ok = await updatePermission(identity, {
      canPublish: true,
      sources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
    });
    if (ok) {
      signal('enable_camera', identity);
      toast({ title: 'Camera enabled for participant' });
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

  const muteParticipant = async (identity: string) => {
    signal('mute_audio', identity);
    await updatePermission(identity, { canPublish: false, sources: [] });
    toast({ title: 'Participant muted' });
  };

  const disableCamera = async (identity: string) => {
    signal('disable_camera', identity);
    await updatePermission(identity, { canPublish: false, sources: [] });
    toast({ title: 'Participant camera disabled' });
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
            remoteParticipants.map((p) => (
              <div key={p.identity}>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground py-1">
                  {p.name || p.identity}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => enableMic(p.identity)} className="gap-2 text-xs">
                  <Mic className="h-3.5 w-3.5" /> Enable Mic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => enableCamera(p.identity)} className="gap-2 text-xs">
                  <Video className="h-3.5 w-3.5" /> Enable Camera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => muteParticipant(p.identity)} className="gap-2 text-xs">
                  <MicOff className="h-3.5 w-3.5" /> Mute
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => disableCamera(p.identity)} className="gap-2 text-xs">
                  <VideoOff className="h-3.5 w-3.5" /> Disable Camera
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => removeParticipant(p.identity)}
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <UserX className="h-3.5 w-3.5" /> Remove
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
