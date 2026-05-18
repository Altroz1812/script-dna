import { useEffect, useState } from "react";
import { adminQuery } from "@/services/api/adminService";
import { useOrganization } from "@/hooks/useOrganization"; // Add this
import { useAuth } from "@/hooks/useAuth"; // Add this
// ... other imports

export default function UsersPage() {
  const { currentOrganization } = useOrganization(); // Get current org context
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [linkParent, setLinkParent] = useState<UserRow | null>(null);

  // Create user state
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("student");
  const [creating, setCreating] = useState(false);

  // Admin reset password state
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  // Load users with organization context
  const load = () => {
    if (!currentOrganization?.organization_id) {
      toast.error("No organization selected");
      return;
    }

    setLoading(true);
    adminQuery("list_users", {
      organization_id: currentOrganization.organization_id,
    })
      .then(setUsers)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (currentOrganization?.organization_id) {
      load();
    }
  }, [currentOrganization?.organization_id]);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleUpdate = async () => {
    if (!editUser) return;

    // Security check: Ensure user belongs to current organization
    if (editUser.organization_id !== currentOrganization?.organization_id) {
      toast.error("Cannot edit users from other organizations");
      return;
    }

    try {
      await adminQuery("update_user", {
        user_id: editUser.user_id,
        display_name: editName,
        organization_id: currentOrganization?.organization_id, // Pass for verification
      });
      toast.success("User updated");
      setEditUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (user?.organization_id !== currentOrganization?.organization_id) {
      toast.error("Cannot delete users from other organizations");
      return;
    }

    if (!confirm(`Delete ${user?.display_name || user?.email} permanently? This action cannot be undone.`)) return;

    try {
      await adminQuery("delete_user", {
        user_id: userId,
        organization_id: currentOrganization?.organization_id,
      });
      toast.success("User deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    // Check organization permission
    if (user.organization_id !== currentOrganization?.organization_id) {
      toast.error("Cannot modify users from other organizations");
      return;
    }

    // Prevent self-deactivation
    if (user.user_id === currentUser?.id && user.is_active !== false) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    const newActive = !(user.is_active !== false);
    try {
      await adminQuery("toggle_user_active", {
        user_id: user.user_id,
        is_active: newActive,
        organization_id: currentOrganization?.organization_id,
      });
      toast.success(newActive ? "User reactivated" : "User deactivated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    const user = users.find((u) => u.user_id === userId);

    // Check organization permission
    if (user?.organization_id !== currentOrganization?.organization_id) {
      toast.error("Cannot modify users from other organizations");
      return;
    }

    // Prevent changing own role if you're not super admin
    if (user?.user_id === currentUser?.id && currentUser?.role !== "super_admin") {
      toast.error("You cannot change your own role");
      return;
    }

    try {
      await adminQuery("change_role", {
        user_id: userId,
        role,
        organization_id: currentOrganization?.organization_id,
      });
      toast.success("Role updated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;

    // Check organization permission
    if (resetUser.organization_id !== currentOrganization?.organization_id) {
      toast.error("Cannot reset passwords for users from other organizations");
      return;
    }

    if (!resetPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (resetPassword !== resetConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    const strength = checkPasswordStrength(resetPassword);
    if (strength.score < 2) {
      toast.error("Password is too weak. Please use a stronger password.");
      return;
    }
    setResetting(true);
    try {
      await adminQuery("admin_reset_password", {
        user_id: resetUser.user_id,
        new_password: resetPassword,
        organization_id: currentOrganization?.organization_id,
      });
      toast.success(`Password reset successfully for ${resetUser.display_name || resetUser.email}`);
      setResetUser(null);
      setResetPassword("");
      setResetConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleCreateUser = async () => {
    if (!currentOrganization?.organization_id) {
      toast.error("No organization selected");
      return;
    }

    if (!newEmail.trim() || !newPassword.trim()) {
      toast.error("Email and password required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreating(true);
    try {
      await adminQuery("create_user", {
        email: newEmail.trim(),
        password: newPassword,
        display_name: newName.trim() || newEmail.split("@")[0],
        role: newRole,
        organization_id: currentOrganization.organization_id, // Explicitly assign to current org
        created_by: currentUser?.id, // Audit trail
      });
      toast.success("User created");
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("student");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Show error if no organization context
  if (!currentOrganization) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Organization Selected</h2>
            <p className="text-muted-foreground">Please select an organization to manage users.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm">Manage users in {currentOrganization.name}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton columns={5} rows={6} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.user_id} className={u.is_active === false ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active !== false ? "default" : "destructive"}>
                          {u.is_active !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => {
                              setEditUser(u);
                              setEditName(u.display_name || "");
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={u.is_active !== false ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.is_active !== false ? (
                              <UserX className="h-4 w-4 text-amber-500" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset Password"
                            onClick={() => {
                              setResetUser(u);
                              setResetPassword("");
                              setResetConfirm("");
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {u.role === "parent" && (
                            <Button variant="ghost" size="icon" title="Link Children" onClick={() => setLinkParent(u)}>
                              <Link2 className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(u.user_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!editUser}
        onOpenChange={(v) => {
          if (!v) setEditUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <Button onClick={handleUpdate} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Reset Password Dialog */}
      <Dialog
        open={!!resetUser}
        onOpenChange={(v) => {
          if (!v) {
            setResetUser(null);
            setResetPassword("");
            setResetConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetUser?.display_name || resetUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
              <PasswordStrengthMeter password={resetPassword} />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
              {resetConfirm && resetPassword !== resetConfirm && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
            </div>
            <Button
              onClick={handleResetPassword}
              className="w-full"
              disabled={resetting || !resetPassword || !resetConfirm}
            >
              {resetting ? "Resetting…" : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ParentChildLinkDialog
        open={!!linkParent}
        onOpenChange={(v) => {
          if (!v) setLinkParent(null);
        }}
        parentUserId={linkParent?.user_id}
        parentName={linkParent?.display_name || linkParent?.email || undefined}
      />
    </div>
  );
}
