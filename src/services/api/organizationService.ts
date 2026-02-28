import { supabase } from '@/integrations/supabase/client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  joined_at: string;
}

export const organizationService = {
  async listOrganizations(): Promise<Organization[]> {
    const { data, error } = await (supabase
      .from('organizations' as any)
      .select('*')
      .order('name') as any);
    if (error) throw error;
    return data ?? [];
  },

  async getOrganization(id: string): Promise<Organization | null> {
    const { data, error } = await (supabase
      .from('organizations' as any)
      .select('*')
      .eq('id', id)
      .maybeSingle() as any);
    if (error) throw error;
    return data;
  },

  async createOrganization(name: string, slug: string): Promise<Organization> {
    const { data, error } = await (supabase
      .from('organizations' as any)
      .insert({ name, slug })
      .select()
      .single() as any);
    if (error) throw error;
    return data;
  },

  async getUserOrganization(userId: string): Promise<Organization | null> {
    const { data, error } = await (supabase
      .from('organization_members' as any)
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle() as any);
    if (error) throw error;
    if (!data) return null;
    return this.getOrganization(data.organization_id);
  },

  async addMember(organizationId: string, userId: string): Promise<void> {
    const { error } = await (supabase
      .from('organization_members' as any)
      .insert({ organization_id: organizationId, user_id: userId }) as any);
    if (error) throw error;
  },

  async removeMember(organizationId: string, userId: string): Promise<void> {
    const { error } = await (supabase
      .from('organization_members' as any)
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId) as any);
    if (error) throw error;
  },

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await (supabase
      .from('organization_members' as any)
      .select('*')
      .eq('organization_id', organizationId) as any);
    if (error) throw error;
    return data ?? [];
  },
};
