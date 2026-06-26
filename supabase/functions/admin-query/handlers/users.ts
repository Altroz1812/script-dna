import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_users': {
        let profilesQ: any = ctx.supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (ctx.targetOrgId) profilesQ = profilesQ.eq('organization_id', ctx.targetOrgId)
        const { data: profiles } = await profilesQ
        const { data: roles } = await ctx.supabase.from('user_roles').select('user_id, role')
        const roleMap: Record<string, string> = {}
        for (const r of roles ?? []) roleMap[r.user_id] = r.role
        const { data: memberships } = await ctx.supabase.from('organization_members').select('user_id, organization_id')
        const orgMap: Record<string, string[]> = {}
        for (const m of memberships ?? []) {
          if (!orgMap[m.user_id]) orgMap[m.user_id] = []
          orgMap[m.user_id].push(m.organization_id)
        }
        result = (profiles ?? []).map((p: any) => ({
          ...p,
          role: roleMap[p.user_id] || 'student',
          organization_ids: orgMap[p.user_id] || [],
        }))
        break
      }
      case 'update_user': {
        const { user_id, display_name } = params
        const { error } = await ctx.supabase.from('profiles').update({ display_name }).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete_user': {
        const { user_id } = params
        await ctx.supabase.from('profiles').delete().eq('user_id', user_id)
        await ctx.supabase.from('user_roles').delete().eq('user_id', user_id)
        result = { success: true }
        break
      }
      case 'change_role': {
        const { user_id, role } = params
        const { data: existing } = await ctx.supabase.from('user_roles').select('id').eq('user_id', user_id).maybeSingle()
        if (existing) {
          await ctx.supabase.from('user_roles').update({ role }).eq('user_id', user_id)
        } else {
          await ctx.supabase.from('user_roles').insert({ user_id, role })
        }
        result = { success: true }
        break
      }
      case 'toggle_user_active': {
        const { user_id, is_active } = params
        const { error } = await ctx.supabase.from('profiles').update({ is_active }).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'create_user': {
        const { email, password, display_name, role } = params
        // Auto-map to caller's active org when not explicitly provided.
        // SuperAdmins acting globally (no ctx.targetOrgId) skip auto-mapping.
        const organization_id = params.organization_id ?? ctx.targetOrgId ?? null
        const { data: authData, error: authError } = await ctx.supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name },
        })
        if (authError) throw authError
        const newUserId = authData.user.id
        // Profile is created by trigger, update display_name
        await ctx.supabase.from('profiles').update({ display_name, organization_id }).eq('user_id', newUserId)
        // Set role
        if (role && role !== 'student') {
          await ctx.supabase.from('user_roles').update({ role }).eq('user_id', newUserId)
        }
        // Add to org if specified
        if (organization_id) {
          await ctx.supabase.from('organization_members').insert({ organization_id, user_id: newUserId })
        }
        result = { success: true, user_id: newUserId }
        break
      }
      case 'admin_reset_password': {
        const { user_id, new_password } = params
        if (!user_id || !new_password) throw new Error('user_id and new_password are required')
        if (new_password.length < 8) throw new Error('Password must be at least 8 characters')
        const { error: resetError } = await ctx.supabase.auth.admin.updateUserById(user_id, {
          password: new_password,
        })
        if (resetError) throw resetError
        result = { success: true }
        break
      }
      case 'check_email_exists': {
        const { email } = params
        const { data, error } = await ctx.supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (error) throw error
        result = { exists: !!data }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
