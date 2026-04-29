/**
 * TeamView.tsx
 * Author: Abdulaziz Albaiji
 *
 * Dashboard view for Team Managers showing their assigned team and its members.
 *
 * Features:
 *  - Summary cards: team name and member count
 *  - Manager info card (name + email)
 *  - Scrollable member table with avatars, roles, and report counts
 *  - Graceful states for loading, error, and "not assigned to a team" scenarios
 *
 * Data is fetched from teamsApi.me() which returns the team managed by the
 * currently authenticated user.  No create/edit/delete functionality is exposed
 * here — those actions live in the admin TeamsView.
 */
import { useEffect, useState } from "react";
import { UsersRound, Mail, Shield, FileText } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { teamsApi, type TeamDetail } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";

export function TeamView() {
  const { t } = useLanguage();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    teamsApi
      .me()
      .then((data) => {
        if (!cancelled) {
          setTeam(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("failedToLoadTeam"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  /** Derives up to two uppercase initials from a full name for the avatar fallback. */
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-muted-foreground">{t("loadingTeam")}</p>
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

  if (!team) {
    return (
      <div className="min-h-full p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">{t("myTeam")}</h1>
          <p className="text-lg text-muted-foreground">{t("viewManagedTeamAndMembers")}</p>
        </div>
        <Card className="ligtas-surface-card rounded-xl p-8">
          <p className="text-muted-foreground">{t("notAssignedToManageTeam")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-foreground">{t("myTeam")}</h1>
        <p className="text-lg text-muted-foreground">{t("viewManagedTeamAndMembers")}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="ligtas-surface-card rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <UsersRound className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("team")}</p>
              <p className="text-3xl font-bold text-foreground">{team.name}</p>
            </div>
          </div>
        </Card>

        <Card className="ligtas-surface-card rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="ligtas-icon-tile-lg">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("members")}</p>
              <p className="text-3xl font-bold text-foreground">{team.members.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="ligtas-surface-card mb-6 rounded-xl p-6">
        <p className="mb-1 text-sm font-semibold text-muted-foreground">{t("teamManager")}</p>
        <p className="text-xl font-bold text-foreground">{team.manager?.name ?? t("unassigned")}</p>
        <p className="text-muted-foreground">{team.manager?.email ?? t("noTeamManagerAssigned")}</p>
      </Card>

      <Card className="ligtas-surface-card overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border bg-muted/40">
              <TableHead className="font-bold text-foreground">{t("member")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("email")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("role")}</TableHead>
              <TableHead className="font-bold text-foreground">{t("reports")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("noConsultantsAssigned")}
                </TableCell>
              </TableRow>
            ) : (
              team.members.map((member) => (
                <TableRow
                  key={member.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="border-2 border-border">
                        <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-foreground">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-4" />
                      <span>{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="border-2 border-border bg-muted font-bold text-foreground">
                      <Shield className="mr-1 size-3" />
                      {member.role.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4" />
                      {member.reportsCount}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
