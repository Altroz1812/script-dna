import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Module-scope singleton. Reused across warm invocations of the same edge
// worker so we don't pay the createClient cost (and its internal HTTP
// session setup) on every request.
let _client: ReturnType<typeof createClient> | null = null

export function getServiceClient() {
  if (!_client) {
    _client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return _client
}