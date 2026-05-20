import { adminQuery } from '@/services/api/adminService';
import { toast } from 'sonner';

export async function startLiveClass(params: {
  classId: string;
  startedBy?: string | null;
  isAdmin?: boolean;
}): Promise<string> {
  const roomName = `class-${params.classId.slice(0, 8)}`;
  const updatePayload: any = { id: params.classId, status: 'live', meeting_url: roomName };
  if (params.isAdmin && params.startedBy) updatePayload.started_by = params.startedBy;
  try {
    await adminQuery('update_live_class', updatePayload);
    return roomName;
  } catch (e: any) {
    toast.error(e.message || 'Failed to start class');
    throw e;
  }
}