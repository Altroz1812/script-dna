import type { getServiceClient } from './supabase.ts'
import { corsHeaders } from './cors.ts'

export type ServiceClient = ReturnType<typeof getServiceClient>

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