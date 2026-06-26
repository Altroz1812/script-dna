import { useLocalParticipant } from '@livekit/components-react';
import { ControlBar } from '@livekit/components-react';
import { TeacherControls } from './TeacherControls';
import { useParticipantRole } from '@/hooks/useParticipantRole';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRoomContext } from '@livekit/components-react';

/**
 * Renders control bar + moderation tools only for moderators (teacher/admin/superadmin/support).
 * Viewers (student/parent) get a minimal "Leave" button.
 * Decision is driven by the role embedded in the LiveKit JWT metadata — no extra API call.
 */
export function RoleAwareControls({ onLeave }: { onLeave?: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const { bucket } = useParticipantRole(localParticipant);

  const isModerator = bucket === 'moderator';

  const leave = () => {
    room.disconnect();
    onLeave?.();
  };

  if (!isModerator) {
    return (
      <div className="flex flex-col border-t border-border bg-muted/30">
        <ControlBar
          controls={{
            microphone: true,
            camera: true,
            screenShare: false,
            chat: false,
            leave: false,
            settings: false,
          }}
          variation="minimal"
        />
        <div className="flex items-center justify-center p-2">
          <Button size="sm" variant="destructive" onClick={leave} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            Leave Class
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-t border-border bg-muted/30 overflow-x-auto">
        <TeacherControls />
      </div>
      <ControlBar
        controls={{
          microphone: true,
          camera: true,
          screenShare: true,
          chat: false,
          leave: true,
          settings: false,
        }}
        variation="minimal"
      />
    </div>
  );
}