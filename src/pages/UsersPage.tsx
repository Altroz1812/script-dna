import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminQuery } from "@/services/api/adminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Users, Plus, UserX, UserCheck, KeyRound, Link2, MoreVertical } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/types/roles";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { ParentChildLinkDialog } from "@/components/admin/ParentChildLinkDialog";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { checkPasswordStrength } from "@/lib/security";
import { readActiveOrgFromStorage } from "@/contexts/ActiveOrgContext";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  organization_id: string | null;
  is_active?: boolean;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading } = useQuery<UserRow[]>({
    queryKey: ["admin_users"],
    queryFn: () => adminQuery("list_users") as Promise<UserRow[]>,
    staleTime: 2 * 60 * 1000,
  });

  const load = () => queryClient.invalidateQueries({ queryKey: ["admin_users"] });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");

  const [linkParent, setLinkParent] = useState<UserRow | null>(null);

  // Create user
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [creating, setCreating] = useState(false);

  // Reset password
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

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
    try {
      await adminQuery("update_user", { user_id: editUser.user_id, display_name: editName });
      toast.success("User updated");
      setEditUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Delete this user permanently?")) return;
    try {
      await adminQuery("delete_user", { user_id: userId });
      toast.success("User deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    const newActive = !(user.is_active !== false);
    try {
      await adminQuery("toggle_user_active", { user_id: user.user_id, is_active: newActive });
      toast.success(newActive ? "User reactivated" : "User deactivated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminQuery("change_role", { user_id: userId, role });
      toast.success("Role updated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword || resetPassword !== resetConfirm) return;
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (checkPasswordStrength(resetPassword).score < 2) {
      toast.error("Password is too weak");
      return;
    }

    setResetting(true);
    try {
      await adminQuery("admin_reset_password", {
        user_id: resetUser.user_id,
        new_password: resetPassword,
      });
      toast.success(`Password reset for ${resetUser.display_name || resetUser.email}`);
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
    if (!newEmail.trim() || !newPassword.trim()) {
      toast.error("Email and password are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreating(true);
    try {
      const activeOrgId = readActiveOrgFromStorage();
      const params: any = {
        email: newEmail.trim(),
        password: newPassword,
        display_name: newName.trim() || newEmail.split("@")[0],
        role: newRole,
      };

      if (activeOrgId && typeof activeOrgId === "string") {
        params.organization_id = activeOrgId;
      }

      await adminQuery("create_user", params);

      toast.success("User created successfully");
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

  return (
    <div className="p-4 space-y-5 pb-20">
      {/* Header + Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm">Manage user accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-5 w-5" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {readActiveOrgFromStorage() ? (
                <p className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  User will be assigned to current organization
                </p>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">No active organization selected</p>
              )}

              <div>
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
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

      {/* Search + Filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Roles" />
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

      {/* Users List - Cards */}
      {loading ? (
        <TableSkeleton columns={3} rows={6} />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((user) => (
              <Card key={user.user_id} className={user.is_active === false ? "opacity-75" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{user.display_name || "—"}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                    <Badge variant={user.is_active !== false ? "default" : "destructive"}>
                      {user.is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <Select value={user.role} onValueChange={(v) => handleRoleChange(user.user_id, v)}>
                        <SelectTrigger className="w-40 h-9 mt-1">
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
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditUser(user);
                        setEditName(user.display_name || "");
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>

                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleToggleActive(user)}>
                      {user.is_active !== false ? (
                        <>
                          <UserX className="mr-2 h-4 w-4" /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-2 h-4 w-4" /> Activate
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResetUser(user);
                        setResetPassword("");
                        setResetConfirm("");
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>

                    {user.role === "parent" && (
                      <Button variant="outline" size="sm" onClick={() => setLinkParent(user)}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(user.user_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
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
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetUser}
        onOpenChange={() => {
          setResetUser(null);
          setResetPassword("");
          setResetConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
              <PasswordStrengthMeter password={resetPassword} />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
            </div>
            <Button
              onClick={handleResetPassword}
              className="w-full"
              disabled={resetting || !resetPassword || resetPassword !== resetConfirm}
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ParentChildLinkDialog
        open={!!linkParent}
        onOpenChange={() => setLinkParent(null)}
        parentUserId={linkParent?.user_id}
        parentName={linkParent?.display_name || linkParent?.email || undefined}
      />
    </div>
  );
}
