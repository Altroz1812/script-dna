import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

// Loose-typed service-role client. We don't generate `Database` types
// inside the edge function, so `.from()` returns `any` rows — matching
// the pre-refactor behavior.
export type ServiceClient = SupabaseClient<any, 'public', any>

export interface HandlerCtx {
  req: Request
  supabase: ServiceClient
  corsHeaders: typeof corsHeaders
  callerUserId: string | null
  callerRoles: string[]
  callerIsSuperadmin: boolean
  callerIsAdmin: boolean
  callerIsSupport: boolean
  callerIsTeacher: boolean
  callerOrgMemberships: string[]
  targetOrgId: string | null
}

export type HandlerOutcome = { handled: true; result: any } | { handled: false }

export type ActionHandler = (
  action: string,
  ctx: HandlerCtx,
  params: any,
) => Promise<HandlerOutcome | Response>