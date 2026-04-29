/**
 * UserManagementView.tsx
 * Author: Abdulaziz Albaiji
 *
 * Admin-only view for managing all users in the system.
 *
 * Features:
 *  - Summary stats cards (total, active, admins, team managers, consultants)
 *  - Searchable user table with role badges and status indicators
 *  - Clicking a user row navigates to their admin analytics profile
 *  - Add / Edit / Delete user via modal dialogs
 *  - Self-edit protection: admins cannot delete or change their own role
 *  - Team membership note (teams are managed from the Teams page)
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Mail, Shield, Edit, Trash2, Search } from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { usersApi, type UserListItem } from "../../services/api";
import { adminUserAnalyticsHref } from "../../utils/adminUserAnalytics";
import { useLanguage } from "../../context/useLanguage";

/** Available roles that can be assigned to a user via the Add/Edit modals. */
const ROLES = ["Admin", "Team Manager", "Consultant"];

/** Shared Tailwind class for the role <select> elements inside modals. */
const selectClass = "ligtas-input flex h-9 w-full items-center py-2 text-sm";

interface UserManagementViewProps {
  /** Email of the currently authenticated admin — used to prevent self-deletion. */
  currentUserEmail?: string;
}

export function UserManagementView({ currentUserEmail }: UserManagementViewProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserListItem | null>(null);
  const [formError, setFormError] = useState("");

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("Consultant");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");

  /** Refreshes the user list from the API; used after create/edit/delete actions. */
  const loadUsers = () => {
    usersApi.list().then(setUsers).catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    usersApi
      .list()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("failedToLoadUsers"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  /** Filters users by name or email matching the current search query. */
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /** Returns a styled Badge component for the given role string. */
  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      Admin: "border-primary bg-primary text-primary-foreground",
      "Team Manager": "border-secondary bg-secondary text-secondary-foreground",
      Consultant: "border-border bg-muted text-foreground",
    };
    return (
      <Badge className={`${styles[role] ?? "border-border bg-muted text-foreground"} border-2 font-bold`}>
        <Shield className="size-3 mr-1" />
        {role.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) =>
    status === "Active" ? (
      <Badge className="border-2 border-primary/40 bg-primary/15 font-bold text-foreground">
        {t("activeUpper")}
      </Badge>
    ) : (
      <Badge className="border-2 border-border bg-muted font-bold text-muted-foreground">
        {t("inactiveUpper")}
      </Badge>
    );

  /** Derives up to two initials from a full name for the avatar fallback. */
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!addName.trim()) {
      setFormError(t("nameIsRequired"));
      return;
    }
    if (!addEmail.trim()) {
      setFormError(t("emailIsRequired"));
      return;
    }
    if (!addPassword) {
      setFormError(t("passwordIsRequired"));
      return;
    }

    try {
      await usersApi.create({
        name: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
      });
      setAddOpen(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("Consultant");
      loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("failedToAddUser"));
    }
  };

  /** Pre-fills the edit modal state with the selected user's current values. */
  const openEdit = (user: UserListItem) => {
    setEditUser(user);
    setEditName(String(user.name ?? ""));
    setEditEmail(String(user.email ?? ""));
    setEditRole(String(user.role ?? "Consultant"));
    setFormError("");
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormError("");

    if (!editName.trim()) {
      setFormError(t("nameIsRequired"));
      return;
    }

    try {
      const payload: { email?: string; role?: string; name?: string } = {};

      if (editName.trim() !== editUser.name) payload.name = editName.trim();
      if (editEmail.trim() !== editUser.email) payload.email = editEmail.trim();
      if (editRole !== editUser.role) payload.role = editRole;

      await usersApi.update(editUser.id, payload);
      setEditUser(null);
      loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("failedToUpdateUser"));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      await usersApi.delete(deleteUser.id);
      setDeleteUser(null);
      loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("failedToDeleteUser"));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-muted-foreground">{t("loadingUsers")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-foreground">{t("userManagement")}</h1>
          <p className="text-lg text-muted-foreground">{t("manageUsersRolesPermissions")}</p>
        </div>
        <Button
          className="h-12 gap-2 bg-primary px-6 font-semibold text-primary-foreground hover:opacity-90"
          onClick={() => {
            setAddOpen(true);
            setFormError("");
          }}
        >
          <Plus className="size-5" />
          {t("addNewUser")}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-6 ligtas-surface-card rounded-xl">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Users className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("totalUsers")}</p>
              <p className="text-3xl font-bold text-foreground">{users.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 ligtas-surface-card rounded-xl">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Users className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("activeUsers")}</p>
              <p className="text-3xl font-bold text-foreground">
                {users.filter((u) => u.status === "Active").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 ligtas-surface-card rounded-xl">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("admins")}</p>
              <p className="text-3xl font-bold text-foreground">
                {users.filter((u) => u.role === "Admin").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 ligtas-surface-card rounded-xl">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("teamManagers")}</p>
              <p className="text-3xl font-bold text-foreground">
                {users.filter((u) => u.role === "Team Manager").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 ligtas-surface-card rounded-xl">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("consultants")}</p>
              <p className="text-3xl font-bold text-foreground">
                {users.filter((u) => u.role === "Consultant").length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="ligtas-surface-card mb-6 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            placeholder={t("searchByNameOrEmail")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ligtas-input h-12 border-2 pl-10"
          />
        </div>
      </Card>

      <Card className="ligtas-surface-card overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border bg-muted/40">
              <TableHead className="font-bold text-foreground">{t("user")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("email")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("role")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("team")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("status")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("reports")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("lastActive")}</TableHead>
              <TableHead className="text-right font-bold text-foreground">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {t("noUsersFound")}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  onClick={() => navigate(adminUserAnalyticsHref(user.id))}
                  className="cursor-pointer border-b border-border hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="border-2 border-border">
                        <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-foreground">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-4" />
                      <span>{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-muted-foreground">{user.teamName ?? t("unassigned")}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="font-bold text-foreground">{user.reportsCount}</TableCell>
                  <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(user);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                      {currentUserEmail &&
                      user.email.toLowerCase() === currentUserEmail.toLowerCase() ? (
                        <Button variant="ghost" size="sm" className="opacity-50 cursor-not-allowed" disabled>
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-red-600 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUser(user);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Transition show={addOpen} as={React.Fragment}>
        <Dialog onClose={() => setAddOpen(false)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="my-8 w-full max-w-md shrink-0 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
                <Dialog.Title className="mb-4 text-xl font-bold">{t("addNewUser")}</Dialog.Title>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-name" className="block">
                      {t("fullName")}
                    </Label>
                    <Input
                      id="add-name"
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="mt-1"
                      placeholder={t("enterFullName")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-email" className="block">
                      {t("email")}
                    </Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      className="mt-1"
                      placeholder="user@ligtas.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-password" className="block">
                      {t("password")}
                    </Label>
                    <Input
                      id="add-password"
                      type="password"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                      className="mt-1"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-role" className="block">
                      {t("role")}
                    </Label>
                    <select
                      id="add-role"
                      value={addRole || "Consultant"}
                      onChange={(e) => setAddRole(e.target.value)}
                      className={selectClass}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("teamMembershipManagedFromTeamsPage")}</p>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:opacity-90">
                      {t("addUser")}
                    </Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!editUser} as={React.Fragment}>
        <Dialog onClose={() => setEditUser(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
            <Dialog.Panel className="my-8 w-full max-w-md shrink-0 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
              <Dialog.Title className="mb-4 text-xl font-bold">{t("editUser")}</Dialog.Title>
              {editUser && (
                <form onSubmit={handleEditUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="block">
                      {t("fullName")}
                    </Label>
                    <Input
                      id="edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email" className="block">
                      {t("email")}
                    </Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-role" className="block">
                      {t("role")}
                    </Label>
                    {currentUserEmail &&
                    editUser?.email?.toLowerCase() === currentUserEmail.toLowerCase() ? (
                      <div className="flex items-center gap-2 rounded-md border-2 border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <Shield className="size-4 shrink-0" />
                        <span>{editRole || "Admin"} — {t("youCannotChangeYourOwnRole")}</span>
                      </div>
                    ) : (
                      <select
                        id="edit-role"
                        value={editRole || "Consultant"}
                        onChange={(e) => setEditRole(e.target.value)}
                        className={selectClass}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}{r === "Team Manager" ? ` (${t("adminCanPromote")})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{t("teamMembershipManagedFromTeamsPage")}</p>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:opacity-90">
                      {t("save")}
                    </Button>
                  </div>
                </form>
              )}
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!deleteUser} as={React.Fragment}>
        <Dialog onClose={() => setDeleteUser(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
              <Dialog.Title className="mb-2 text-xl font-bold">{t("deleteUser")}</Dialog.Title>
              {deleteUser && (
                <>
                  <p className="mb-4 text-muted-foreground">
                    {t("areYouSureDeleteUser")} <strong>{deleteUser.email}</strong>? {t("thisActionCannotBeUndone")}
                  </p>
                  {formError && <p className="mb-4 text-sm text-destructive">{formError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDeleteUser(null)}>
                      {t("cancel")}
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => handleDeleteUser()}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </>
              )}
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}