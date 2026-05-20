import { useEffect, useState } from 'react';
import type { Participant } from 'livekit-client';

export interface ParticipantRole {
  role: string;
  bucket: 'moderator' | 'viewer';
}

function parse(p: Participant | undefined): ParticipantRole {
  if (!p) return { role: 'student', bucket: 'viewer' };
  // Prefer metadata embedded in the JWT (server-derived, trusted)
  if (p.metadata) {
    try {
      const m = JSON.parse(p.metadata);
      if (m && typeof m === 'object' && (m.bucket === 'moderator' || m.bucket === 'viewer')) {
        return { role: m.role ?? 'student', bucket: m.bucket };
      }
    } catch {
      // ignore
    }
  }
  // Fallback: derive from LiveKit permission grants
  const canPublish = !!p.permissions?.canPublish;
  return { role: canPublish ? 'teacher' : 'student', bucket: canPublish ? 'moderator' : 'viewer' };
}

/**
 * Reads role/bucket from a participant's LiveKit metadata (set server-side in the JWT).
 * Updates when metadata changes during the session.
 */
export function useParticipantRole(participant: Participant | undefined): ParticipantRole {
  const [info, setInfo] = useState<ParticipantRole>(() => parse(participant));

  useEffect(() => {
    if (!participant) return;
    setInfo(parse(participant));
    const handler = () => setInfo(parse(participant));
    participant.on('participantMetadataChanged' as any, handler);
    participant.on('participantPermissionsChanged' as any, handler);
    return () => {
      participant.off('participantMetadataChanged' as any, handler);
      participant.off('participantPermissionsChanged' as any, handler);
    };
  }, [participant]);

  return info;
}