import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Globe2, Loader2, ArrowRight, Users, Plus } from 'lucide-react';
import { adminQuery } from '@/services/api/adminService';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MorphingBlob } from '@/components/ui/morphing-blob';

export default function SelectOrganizationPage() {
  const navigate = useNavigate();
  const { setActiveOrg, availableOrgs, orgsLoading } = useActiveOrg();
  const { profile, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useRBAC();

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) { navigate('/login', { replace: true }); return; }
    if (isSuperAdmin) {
      adminQuery('list_organizations', { __skip_org_filter: true })
        .then(setOrgs)
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    } else {
      // Non-SuperAdmin: pick only from their memberships
      if (orgsLoading) return;
      if (availableOrgs.length <= 1) {
        // Single-org user shouldn't see this page
        navigate('/dashboard', { replace: true });
        return;
      }
      setOrgs(availableOrgs.map(o => ({ id: o.id, name: o.name })));
      setLoading(false);
    }
  }, [authLoading, profile, isSuperAdmin, navigate, availableOrgs, orgsLoading]);

  const loadOrgs = () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    adminQuery('list_organizations', { __skip_org_filter: true })
      .then(setOrgs)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    const name = newOrgName.trim();
    const slug = newOrgSlug.trim();
    if (!name || !slug) { toast.error('Name and slug required'); return; }
    setCreating(true);
    try {
      await adminQuery('create_organization', { name, slug });
      toast.success('Organization created');
      setNewOrgName('');
      setNewOrgSlug('');
      setCreateOpen(false);
      loadOrgs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const pick = (id: string | null, name: string | null) => {
    setActiveOrg(id, name);
    toast.success(id ? `Switched to ${name}` : 'Switched to Global view');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <MorphingBlob className="w-[700px] h-[700px] -top-40 -left-40 opacity-40" color="hsl(265 90% 65% / 0.12)" />
      <MorphingBlob className="w-[500px] h-[500px] -bottom-32 -right-32 opacity-30" color="hsl(12 90% 65% / 0.1)" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">Choose an organization</h1>
          <p className="text-muted-foreground">
            Pick a tenant to scope all dashboards, students, batches and finances. You can switch anytime from the header.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Global tile — SuperAdmin only */}
            {isSuperAdmin && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card
                onClick={() => pick(null, 'Global view')}
                className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full"
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Globe2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Global view</h3>
                    <p className="text-sm text-muted-foreground">All organizations · platform-wide data</p>
                  </div>
                  <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            )}

            {/* Add Organisation tile — SuperAdmin only */}
            {isSuperAdmin && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <Card className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full border-dashed border-2">
                      <CardContent className="p-5 flex flex-col gap-3 h-full">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-primary/20 flex items-center justify-center">
                          <Plus className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">Add Organisation</h3>
                          <p className="text-sm text-muted-foreground">Create a new tenant for the platform</p>
                        </div>
                        <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform pointer-events-none">
                          Create <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="org-name">Name</Label>
                      <Input
                        id="org-name"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="e.g. AuraPen Bangalore"
                      />
                    </div>
                    <div>
                      <Label htmlFor="org-slug">Slug</Label>
                      <Input
                        id="org-slug"
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                        placeholder="e.g. aurapen-bangalore"
                      />
                    </div>
                    <Button onClick={handleCreate} disabled={creating} className="w-full">
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {orgs.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * (i + 1), duration: 0.3 }}
              >
                <Card
                  onClick={() => pick(o.id, o.name)}
                  className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full"
                >
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral/20 to-primary/20 flex items-center justify-center overflow-hidden">
                      {o.logo_url ? (
                        <img src={o.logo_url} alt={o.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-coral" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{o.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {o.member_count ?? 0} members
                        {o.is_active === false ? <span className="ml-2 text-destructive">· inactive</span> : null}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform">
                      Enter <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}