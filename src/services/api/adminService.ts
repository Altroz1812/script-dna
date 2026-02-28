import { supabase } from '@/integrations/supabase/client';

export async function adminQuery(action: string, params: any = {}) {
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('admin-query', {
        body: { action, params },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}
