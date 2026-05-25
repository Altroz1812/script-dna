import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminQuery } from "@/services/api/adminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Users, Plus, UserX, UserCheck, KeyRound, Link2 } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/types/roles";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { ParentChildLinkDialog } from "@/components/admin/ParentChildLinkDialog";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { checkPasswordStrength } from "@/lib/security";

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
    if (!resetUser) return;
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
      await adminQuery("admin_reset_password", { user_id: resetUser.user_id, new_password: resetPassword });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm">Manage all user accounts</p>
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
