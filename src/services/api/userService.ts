import { supabase } from '@/integrations/supabase/client';
import type { AppRole, UserProfile } from '@/types/roles';

export const userService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await (supabase
      .from('profiles' as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as any);

    if (error) throw error;
    if (!data) return null;

    const role = await this.getUserRole(userId);

    return {
      id: data.user_id,
      email: data.email ?? '',
      displayName: data.display_name ?? '',
      avatarUrl: data.avatar_url ?? undefined,
      organizationId: data.organization_id ?? undefined,
      role,
    };
  },

  async getUserRole(userId: string): Promise<AppRole> {
    const { data, error } = await (supabase
      .from('user_roles' as any)
      .select('role')
      .eq('user_id', userId)
      .maybeSingle() as any);

    if (error) throw error;
    return (data?.role as AppRole) ?? 'student';
  },

  async updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>) {
    const { error } = await (supabase
      .from('profiles' as any)
      .update({
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
      })
      .eq('user_id', userId) as any);

    if (error) throw error;
  },
};
