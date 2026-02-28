import { supabase } from '@/integrations/supabase/client';

export async function adminQuery(action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke('admin-query', {
    body: { action, params },
  });
  if (error) throw error;
  return data;
}
