/**
 * TeamsView.tsx
 * Author: Abdulaziz Albaiji
 *
 * Admin view for creating and managing all teams in the system.
 *
 * Layout:
 *  - Header with summary stats (team count, assigned managers, total members)
 *  - Team directory grid — clicking a card selects that team for editing
 *  - Team workspace panel (rename, assign manager, add/remove consultants, delete)
 *  - Create Team modal dialog
 *
 * Data is loaded from the teamsApi and usersApi.  After any mutating operation
 * (create, update, add/remove member, delete) the data is re-fetched so the
 * UI stays in sync with the server.
 *
 * Manager and member pickers use a custom searchable dropdown; clicks outside
 * the picker are detected via a global mousedown listener and close the dropdown.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FolderKanban, Loader2, Plus, Shield, Trash2, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { teamsApi, usersApi, type TeamDetail, type TeamListItem, type UserListItem } from "../../services/api";
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useLanguage } from "../../context/useLanguage";

export function TeamsView() {
  const { t } = useLanguage();
  const managerPickerRef = useRef<HTMLDivElement | null>(null);
  const memberPickerRef = useRef<HTMLDivElement | null>(null);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [editedName, setEditedName] = useState("");

  /**
   * Fetches all teams and all users in parallel, then selects the preferred team
   * (or the first team in the list) so the detail panel is always populated.
   *
   * @param preferredTeamId - Keep this team selected after a refresh (e.g. after create/update).
   */
  async function loadBaseData(preferredTeamId?: string) {
    setLoading(true);
    setError(null);

    try {
      const [nextTeams, nextUsers] = await Promise.all([teamsApi.list(), usersApi.list()]);
      setTeams(nextTeams);
      setUsers(nextUsers);

      // Prefer the specified team; fall back to the first team in the list.
      const nextSelectedTeamId =
        preferredTeamId && nextTeams.some((team) => team.id === preferredTeamId)
          ? preferredTeamId
          : nextTeams[0]?.id ?? null;

      setSelectedTeamId(nextSelectedTeamId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadTeams"));
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedTeam(teamId: string | null) {
    if (!teamId) {
      setSelectedTeam(null);
      setEditedName("");
      setManagerUserId("");
      setManagerSearch("");
      setManagerPickerOpen(false);
      setMemberUserId("");
      setMemberSearch("");
      setMemberPickerOpen(false);
      return;
    }

    setDetailLoading(true);
    try {
      const team = await teamsApi.get(teamId);
      setSelectedTeam(team);
      setEditedName(team.name);
      setManagerUserId(team.manager?.id ?? "");
      setManagerSearch("");
      setManagerPickerOpen(false);
      setMemberSearch("");
      setMemberPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadTeamDetails"));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    void loadSelectedTeam(selectedTeamId);
  }, [selectedTeamId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (managerPickerRef.current && !managerPickerRef.current.contains(target)) {
        setManagerPickerOpen(false);
      }

      if (memberPickerRef.current && !memberPickerRef.current.contains(target)) {
        setMemberPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  /** All users with the "Team Manager" role, used to populate the manager picker. */
  const teamManagers = useMemo(
    () => users.filter((user) => user.role === "Team Manager"),
    [users],
  );

  /** Team managers filtered by the manager search input for the picker dropdown. */
  const filteredManagers = useMemo(() => {
    const normalizedSearch = managerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return teamManagers;
    }

    return teamManagers.filter((user) =>
      [user.name, user.email].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [managerSearch, teamManagers]);

  /**
   * Consultants who are not yet assigned to the selected team.
   * Excludes current team members so they cannot be added twice.
   */
  const availableConsultants = useMemo(() => {
    if (!selectedTeam) {
      return [];
    }

    return users
      .filter((user) => user.role === "Consultant")
      .filter((user) => user.teamId !== selectedTeam.id)
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [selectedTeam, users]);

  /** Available consultants filtered by the member search input for the picker dropdown. */
  const filteredConsultants = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return availableConsultants;
    }

    return availableConsultants.filter((user) =>
      [user.name, user.email, user.teamName ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [availableConsultants, memberSearch]);

  async function handleCreateTeam(event: React.FormEvent) {
    event.preventDefault();

    try {
      const created = await teamsApi.create({ name: createName });
      setCreateOpen(false);
      setCreateName("");
      toast.success(t("teamCreated"));
      await loadBaseData(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToCreateTeam"));
    }
  }

  async function handleSaveTeam() {
    if (!selectedTeam) {
      return;
    }

    try {
      const updated = await teamsApi.update(selectedTeam.id, {
        name: editedName,
        managerUserId: managerUserId ? Number(managerUserId) : null,
      });
      setSelectedTeam(updated);
      toast.success(t("teamUpdated"));
      await loadBaseData(updated.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdateTeam"));
    }
  }

  async function handleAddMember() {
    if (!selectedTeam || !memberUserId) {
      return;
    }

    try {
      const updated = await teamsApi.addMember(selectedTeam.id, Number(memberUserId));
      setSelectedTeam(updated);
      setMemberUserId("");
      setMemberSearch("");
      setMemberPickerOpen(false);
      toast.success(t("teamMemberUpdated"));
      await loadBaseData(updated.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdateTeamMember"));
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeam) {
      return;
    }

    try {
      const updated = await teamsApi.removeMember(selectedTeam.id, userId);
      setSelectedTeam(updated);
      toast.success(t("teamMemberRemoved"));
      await loadBaseData(updated.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToRemoveTeamMember"));
    }
  }

  async function handleDeleteTeam() {
    if (!selectedTeam) {
      return;
    }

    const confirmed = window.confirm(
      t("deleteTeamConfirmation").replace("{teamName}", selectedTeam.name),
    );

    if (!confirmed) {
      return;
    }

    try {
      await teamsApi.delete(selectedTeam.id);
      toast.success(t("teamDeleted"));
      await loadBaseData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToDeleteTeam"));
    }
  }

  if (loading) {
    return (
      <div className="min-h-full p-8 flex items-center justify-center">
        <p className="text-gray-600">{t("loadingTeams")}</p>
      </div>
    );
  }

  /**
   * A team can only be deleted when it has no manager and no members.
   * This guard prevents orphaned member records in the database.
   */
  const canDeleteSelectedTeam = Boolean(
    selectedTeam && selectedTeam.manager == null && selectedTeam.members.length === 0,
  );
  /** Total number of consultants assigned across all teams — shown in the summary bar. */
  const totalMembers = teams.reduce((sum, team) => sum + team.memberCount, 0);
  /** Number of teams that currently have a manager assigned. */
  const assignedManagers = teams.filter((team) => team.manager != null).length;

  if (error) {
    return (
      <div className="min-h-full p-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300">
              {t("teamAdministration")}
            </p>
            <h1 className="text-5xl font-black tracking-tight text-gray-900 dark:text-white">{t("teams")}</h1>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400 md:text-lg">
              {t("teamsDescription")}
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-[132px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/80">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("teams")}</p>
                <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{teams.length}</p>
              </div>
              <div className="min-w-[132px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/80">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("managers")}</p>
                <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{assignedManagers}</p>
              </div>
              <div className="min-w-[132px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/80">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("members")}</p>
                <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{totalMembers}</p>
              </div>
            </div>
            <Button
              className="h-12 gap-2 px-6 font-semibold"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-5" />
              {t("createTeam")}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/80">
            <div className="flex items-start gap-3">
              <div className="ligtas-icon-tile-lg rounded-2xl">
                <FolderKanban className="size-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("directory")}</p>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t("selectATeam")}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {t("selectATeamDescription")}
                </p>
              </div>
            </div>
          </div>
          {teams.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">
              {t("noTeamsYet")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`h-full min-h-[124px] rounded-2xl border p-4 text-left transition-colors ${
                    selectedTeamId === team.id
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-card-foreground hover:border-muted-foreground/30 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-lg font-black ${
                          selectedTeamId === team.id ? "text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {team.name}
                      </p>
                      <p
                        className={`mt-2 truncate text-sm ${
                          selectedTeamId === team.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {team.manager?.email ?? t("unassignedManager")}
                      </p>
                    </div>
                    <div
                      className={`w-20 flex-shrink-0 rounded-xl px-3 py-2 text-center ${
                        selectedTeamId === team.id
                          ? "bg-primary-foreground/15"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          selectedTeamId === team.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t("members")}
                      </p>
                      <p
                        className={`mt-1 text-2xl font-black ${
                          selectedTeamId === team.id ? "text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {team.memberCount}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          {!selectedTeamId ? (
            <p className="text-gray-500 dark:text-gray-400">{t("selectTeamToManage")}</p>
          ) : detailLoading || !selectedTeam ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-gray-200 bg-gray-50 text-center dark:border-gray-600 dark:bg-gray-800/50">
              <Loader2 className="size-10 animate-spin text-gray-400" />
              <p className="mt-4 text-base font-semibold text-gray-700 dark:text-gray-200">{t("loadingTeamWorkspace")}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("fetchingManagerMembersSettings")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("workspace")}</p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{selectedTeam.name}</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {t("workspaceDescription")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{t("currentManager")}</p>
                    <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                      {selectedTeam.manager?.id ? (
                        <AdminUserProfileLink
                          userId={selectedTeam.manager.id}
                          isAdmin
                          className="text-lg font-bold text-primary underline-offset-2 hover:underline dark:text-primary"
                        >
                          {selectedTeam.manager.name}
                        </AdminUserProfileLink>
                      ) : (
                        (selectedTeam.manager?.name ?? t("unassigned"))
                      )}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedTeam.manager?.id ? (
                        <AdminUserProfileLink
                          userId={selectedTeam.manager.id}
                          isAdmin
                          className="text-sm text-primary underline-offset-2 hover:underline dark:text-primary"
                        >
                          {selectedTeam.manager.email}
                        </AdminUserProfileLink>
                      ) : (
                        (selectedTeam.manager?.email ?? t("noManagerAssigned"))
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5 border-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
                  <div className="flex items-center gap-3">
                    <div className="ligtas-icon-tile-lg rounded-lg">
                      <UsersRound className="size-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t("teamMembers")}</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedTeam.members.length}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 border-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
                  <div className="flex items-center gap-3">
                    <div className="ligtas-icon-tile-lg rounded-lg">
                      <Shield className="size-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t("manager")}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedTeam.manager?.id ? (
                          <AdminUserProfileLink
                            userId={selectedTeam.manager.id}
                            isAdmin
                            className="text-lg font-bold text-primary underline-offset-2 hover:underline dark:text-primary"
                          >
                            {selectedTeam.manager.name}
                          </AdminUserProfileLink>
                        ) : (
                          (selectedTeam.manager?.name ?? t("unassigned"))
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">{t("teamName")}</Label>
                  <Input
                    id="team-name"
                    value={editedName}
                    onChange={(event) => setEditedName(event.target.value)}
                    placeholder={t("enterTeamName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-manager-search">{t("teamManager")}</Label>
                  <div ref={managerPickerRef} className="space-y-2">
                    <Input
                      id="team-manager-search"
                      value={managerSearch}
                      onChange={(event) => setManagerSearch(event.target.value)}
                      onFocus={() => setManagerPickerOpen(true)}
                      placeholder={t("searchTeamManagers")}
                    />
                    {(managerPickerOpen || managerSearch.trim()) && (
                      <div className="rounded-md border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            className={`w-full border-b border-gray-200 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 ${
                              managerUserId === "" ? "bg-gray-100 dark:bg-gray-800" : ""
                            }`}
                            onClick={() => {
                              setManagerUserId("");
                              setManagerPickerOpen(false);
                            }}
                          >
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{t("noTeamManager")}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t("leaveTeamWithoutManager")}</div>
                          </button>
                          {filteredManagers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className={`w-full border-b border-gray-200 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 ${
                                managerUserId === user.id ? "bg-gray-100 dark:bg-gray-800" : ""
                              }`}
                              onClick={() => {
                                setManagerUserId(user.id);
                                setManagerPickerOpen(false);
                              }}
                            >
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {managerUserId
                      ? `${t("selected")}: ${teamManagers.find((user) => user.id === managerUserId)?.email ?? t("teamManagerLower")}`
                      : `${t("selected")}: ${t("noTeamManager")}`}
                  </p>
                </div>
                <Button onClick={() => void handleSaveTeam()}>{t("saveTeamChanges")}</Button>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800/50">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("deleteTeam")}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t("deleteTeamRules")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canDeleteSelectedTeam}
                      onClick={() => void handleDeleteTeam()}
                      className="inline-flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="size-4" />
                      {t("deleteTeam")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-5 text-gray-900 dark:text-white" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("moveConsultantIntoTeam")}</h2>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="consultant-search">{t("searchConsultants")}</Label>
                    <div ref={memberPickerRef} className="space-y-2">
                      <Input
                        id="consultant-search"
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        onFocus={() => setMemberPickerOpen(true)}
                        placeholder={t("searchByNameEmailOrTeam")}
                      />
                      {(memberPickerOpen || memberSearch.trim()) && (
                        <div className="rounded-md border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                          <div className="max-h-56 overflow-y-auto">
                            {filteredConsultants.length === 0 ? (
                              <p className="px-3 py-4 text-sm text-gray-500">
                                {memberSearch.trim()
                                  ? t("noConsultantsMatchSearch")
                                  : t("noConsultantsAvailableToMove")}
                              </p>
                            ) : (
                              filteredConsultants.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  className={`w-full border-b border-gray-200 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 ${
                                    memberUserId === user.id ? "bg-gray-100 dark:bg-gray-800" : ""
                                  }`}
                                  onClick={() => {
                                    setMemberUserId(user.id);
                                    setMemberPickerOpen(false);
                                  }}
                                >
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500">
                                    {user.teamName ? t("currentlyInTeam").replace("{teamName}", user.teamName) : t("currentlyUnassigned")}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {memberUserId
                        ? `${t("selected")}: ${filteredConsultants.find((user) => user.id === memberUserId)?.email ?? availableConsultants.find((user) => user.id === memberUserId)?.email ?? t("consultant")}`
                        : t("selectConsultantFromList")}
                    </p>
                    <Button disabled={!memberUserId} onClick={() => void handleAddMember()}>
                      {t("addOrMoveMember")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserMinus className="size-5 text-gray-900 dark:text-white" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("teamMembers")}</h2>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800/80 dark:border-gray-600">
                      <TableHead className="font-bold text-gray-900 dark:text-gray-100">{t("member")}</TableHead>
                      <TableHead className="font-bold text-gray-900 dark:text-gray-100">{t("role")}</TableHead>
                      <TableHead className="font-bold text-gray-900 dark:text-gray-100">{t("reports")}</TableHead>
                      <TableHead className="text-right font-bold text-gray-900 dark:text-gray-100">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTeam.members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                          {t("noConsultantsAssigned")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedTeam.members.map((member) => (
                        <TableRow key={member.id} className="border-b border-gray-200 dark:border-gray-600">
                          <TableCell>
                            <div className="font-bold text-gray-900 dark:text-gray-100">
                              <AdminUserProfileLink
                                userId={member.id}
                                isAdmin
                                className="font-bold text-primary underline-offset-2 hover:underline dark:text-primary"
                              >
                                {member.name}
                              </AdminUserProfileLink>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <AdminUserProfileLink
                                userId={member.id}
                                isAdmin
                                className="text-sm text-primary underline-offset-2 hover:underline dark:text-primary"
                              >
                                {member.email}
                              </AdminUserProfileLink>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-900 dark:text-gray-200">{member.role}</TableCell>
                          <TableCell className="text-gray-900 dark:text-gray-200">{member.reportsCount}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              onClick={() => void handleRemoveMember(member.id)}
                            >
                              {t("remove")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Transition show={createOpen} as="div">
        <Dialog onClose={() => setCreateOpen(false)} className="relative z-50">
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
              <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-xl shadow-xl max-w-md w-full p-6">
                <Dialog.Title className="text-xl font-bold mb-4">{t("createTeam")}</Dialog.Title>
                <form onSubmit={(event) => void handleCreateTeam(event)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-team-name">{t("teamName")}</Label>
                    <Input
                      id="create-team-name"
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder={t("operationsTeam")}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit">
                      {t("createTeam")}
                    </Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}