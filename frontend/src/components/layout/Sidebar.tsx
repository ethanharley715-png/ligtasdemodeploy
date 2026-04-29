import {
  LayoutDashboard,
  Upload,
  FileCheck,
  History,
  BarChart3,
  TrendingUp,
  Brain,
  Bug,
  ShieldAlert,
  Users,
  Settings,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "../../context/useLanguage";

interface SidebarProps {
  readonly activeView: string;
  readonly onViewChange: (view: string) => void;
  readonly userRole: "admin" | "team_manager" | "consultant";
}

const navItems: {
  id: string;
  labelKey:
    | "dashboard"
    | "upload"
    | "qcResults"
    | "reportHistory"
    | "qcTrendDashboard"
    | "teamAnalytics"
    | "aiLearning"
    | "teams"
    | "team"
    | "userManagement"
    | "securityEvents"
    | "settings"
    | "qcDebug";
  icon: React.ComponentType<{ className?: string }>;
  roles: ("admin" | "team_manager" | "consultant")[];
}[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard, roles: ["admin", "team_manager", "consultant"] },
  { id: "upload", labelKey: "upload", icon: Upload, roles: ["admin", "team_manager", "consultant"] },
  { id: "results", labelKey: "qcResults", icon: FileCheck, roles: ["admin", "team_manager", "consultant"] },
  { id: "history", labelKey: "reportHistory", icon: History, roles: ["admin", "team_manager", "consultant"] },
  { id: "analytics", labelKey: "qcTrendDashboard", icon: BarChart3, roles: ["admin"] },
  { id: "team-analytics", labelKey: "teamAnalytics", icon: TrendingUp, roles: ["admin", "team_manager"] },
  { id: "ai-learning", labelKey: "aiLearning", icon: Brain, roles: ["admin", "team_manager"] },
  { id: "teams", labelKey: "teams", icon: Users, roles: ["admin"] },
  { id: "team", labelKey: "team", icon: UsersRound, roles: ["team_manager"] },
  { id: "users", labelKey: "userManagement", icon: Users, roles: ["admin"] },
  { id: "security-events", labelKey: "securityEvents", icon: ShieldAlert, roles: ["admin"] },
  { id: "settings", labelKey: "settings", icon: Settings, roles: ["admin", "team_manager", "consultant"] },
  { id: "qc-debug", labelKey: "qcDebug", icon: Bug, roles: ["admin"] },
];

export function Sidebar({ activeView, onViewChange, userRole }: SidebarProps) {
  const { t } = useLanguage();

  return (
    <aside className="w-64 shrink-0 border-r-2 border-border bg-card text-card-foreground">
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          if (!item.roles.includes(userRole)) return null;

          const Icon = item.icon;
          const isActive = activeView === item.id;
          const label =
            item.id === "team-analytics" && userRole === "team_manager"
              ? t("myTeamAnalytics")
              : t(item.labelKey);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-5 flex-shrink-0" />
              <span className="truncate whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}