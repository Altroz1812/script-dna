import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MicOff, VideoOff, UserX, Shield, Users } from 'lucide-react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { toast } from '@/hooks/use-toast';

export function TeacherControls() {
  const room = useRoomContext();
  const participants = useParticipants();
  const remoteParticipants = participants.filter(
    (p) => p.identity !== room.localParticipant.identity
  ) as RemoteParticipant[];

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

  const muteParticipant = (identity: string) => {
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ action: 'mute_audio', target: identity })),
      { reliable: true }
    );
    toast({ title: `Mute request sent to participant` });
  };

  const disableCamera = (identity: string) => {
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ action: 'disable_camera', target: identity })),
      { reliable: true }
    );
    toast({ title: `Disable camera request sent` });
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
    <div className="flex items-center gap-1">
      {/* Bulk actions */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onClick={muteAllMics}
        title="Mute all participants"
      >
        <MicOff className="h-3.5 w-3.5" />
        Mute All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onClick={disableAllCameras}
        title="Disable all cameras"
      >
        <VideoOff className="h-3.5 w-3.5" />
        Cams Off
      </Button>

      {/* Per-participant dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            Manage ({remoteParticipants.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
