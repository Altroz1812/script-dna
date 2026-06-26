import type { HandlerCtx, HandlerOutcome } from '../_shared/types.ts'

export async function handle(action: string, ctx: HandlerCtx, params: any): Promise<HandlerOutcome | Response> {
  let result: any
  let handled = true
  switch (action) {
      case 'list_organizations': {
        const { data: orgs } = await ctx.supabase.from('organizations').select('*').order('created_at', { ascending: false })
        const { data: members } = await ctx.supabase.from('organization_members').select('organization_id')
        const countMap: Record<string, number> = {}
        for (const m of members ?? []) countMap[m.organization_id] = (countMap[m.organization_id] || 0) + 1
        result = (orgs ?? []).map((o: any) => ({ ...o, member_count: countMap[o.id] || 0 }))
        break
      }
      case 'create_organization': {
        const { name, slug } = params
        const { data, error } = await ctx.supabase.from('organizations').insert({ name, slug }).select().single()
        if (error) throw error
        result = data
        break
      }
      case 'delete_organization': {
        const { id } = params
        await ctx.supabase.from('organization_members').delete().eq('organization_id', id)
        const { error } = await ctx.supabase.from('organizations').delete().eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'list_org_members': {
        const { organization_id } = params
        const { data: members } = await ctx.supabase.from('organization_members').select('*').eq('organization_id', organization_id)
        const userIds = (members ?? []).map((m: any) => m.user_id)
        let profiles: any[] = []
        if (userIds.length > 0) {
          const { data } = await ctx.supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
          profiles = data ?? []
        }
        const profileMap: Record<string, any> = {}
        for (const p of profiles) profileMap[p.user_id] = p
        result = (members ?? []).map((m: any) => ({ ...m, profile: profileMap[m.user_id] || null }))
        break
      }
      case 'add_org_member': {
        const { organization_id, user_id } = params
        const { error } = await ctx.supabase.from('organization_members').insert({ organization_id, user_id })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove_org_member': {
        const { organization_id, user_id } = params
        const { error } = await ctx.supabase.from('organization_members').delete().eq('organization_id', organization_id).eq('user_id', user_id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'set_user_organizations': {
        // Replace the full set of org memberships for a user.
        const { user_id, organization_ids } = params as { user_id: string; organization_ids: string[] }
        if (!user_id || !Array.isArray(organization_ids)) {
          throw new Error('user_id and organization_ids[] are required')
        }
        const { data: current } = await ctx.supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user_id)
        const currentIds = new Set((current ?? []).map((r: any) => r.organization_id))
        const nextIds = new Set(organization_ids)
        const toAdd = [...nextIds].filter((id) => !currentIds.has(id))
        const toRemove = [...currentIds].filter((id) => !nextIds.has(id))
        if (toRemove.length > 0) {
          const { error } = await ctx.supabase
            .from('organization_members')
            .delete()
            .eq('user_id', user_id)
            .in('organization_id', toRemove)
          if (error) throw error
        }
        if (toAdd.length > 0) {
          const rows = toAdd.map((organization_id) => ({ user_id, organization_id }))
          const { error } = await ctx.supabase.from('organization_members').insert(rows)
          if (error) throw error
        }
        result = { success: true, added: toAdd.length, removed: toRemove.length }
        break
      }
      case 'toggle_org_active': {
        const { id, is_active } = params
        const { error } = await ctx.supabase.from('organizations').update({ is_active }).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'update_org_branding': {
        const { id, branding } = params
        // Mirror the branding logo into the dedicated logo_url column so listing
        // endpoints and white-label headers can rely on a single source.
        const updates: Record<string, unknown> = { branding }
        if (branding && typeof branding === 'object' && 'logo_url' in branding) {
          updates.logo_url = (branding as any).logo_url || null
        }
        const { error } = await ctx.supabase.from('organizations').update(updates).eq('id', id)
        if (error) throw error
        result = { success: true }
        break
      }
    default:
      handled = false
  }
  return handled ? { handled: true, result } : { handled: false }
}
