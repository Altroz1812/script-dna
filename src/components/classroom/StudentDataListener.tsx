import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { toast } from '@/hooks/use-toast';

/**
 * Listens for data messages from the teacher (mute, disable camera, remove)
 * and applies them locally on the student's side.
 */
export function StudentDataListener() {
  const room = useRoomContext();

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        const myIdentity = room.localParticipant.identity;

        if (msg.type === 'chat') return; // handled by ClassroomChat
        if (msg.target !== myIdentity) return;

        switch (msg.action) {
          case 'mute_audio':
            room.localParticipant.setMicrophoneEnabled(false);
            toast({ title: 'Your microphone was muted by the teacher' });
            break;
          case 'disable_camera':
            room.localParticipant.setCameraEnabled(false);
            toast({ title: 'Your camera was disabled by the teacher' });
            break;
          case 'enable_audio':
            room.localParticipant
              .setMicrophoneEnabled(true)
              .then(() => toast({ title: 'Teacher enabled your microphone' }))
              .catch((e) =>
                toast({
                  title: 'Could not enable microphone',
                  description: e?.message || 'Check browser permissions',
                  variant: 'destructive',
                }),
              );
            break;
          case 'enable_camera':
            room.localParticipant
              .setCameraEnabled(true)
              .then(() => toast({ title: 'Teacher enabled your camera' }))
              .catch((e) =>
                toast({
                  title: 'Could not enable camera',
                  description: e?.message || 'Check browser permissions',
                  variant: 'destructive',
                }),
              );
            break;
          case 'remove':
            toast({
              title: 'You have been removed from the classroom',
              variant: 'destructive',
            });
            setTimeout(() => room.disconnect(), 1000);
            break;
        }
      } catch {
        // ignore non-JSON data messages
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return null;
}
