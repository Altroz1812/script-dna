import { adminQuery } from '@/services/api/adminService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function startLiveClass(params: {
  classId: string;
  startedBy?: string | null;
  isAdmin?: boolean;
}): Promise<string> {
  // Resolve the batch's permanent meeting room so every session reuses the same link.
  let roomName: string | null = null;
  try {
    const { data: lc } = await supabase
      .from('live_classes')
      .select('meeting_url, batch_id, batches:batch_id(meeting_room)')
      .eq('id', params.classId)
      .maybeSingle();
    roomName =
      (lc as any)?.batches?.meeting_room ||
      lc?.meeting_url ||
      `batch-${(lc?.batch_id || params.classId).toString().slice(0, 8)}`;
  } catch (_) {
    roomName = `batch-${params.classId.slice(0, 8)}`;
  }

  const updatePayload: any = { id: params.classId, status: 'live', meeting_url: roomName };
  if (params.isAdmin && params.startedBy) updatePayload.started_by = params.startedBy;
  try {
    await adminQuery('update_live_class', updatePayload);
    return roomName!;
  } catch (e: any) {
    toast.error(e.message || 'Failed to start class');
    throw e;
  }
}