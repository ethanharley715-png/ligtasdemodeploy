/**
 * SettingsView.tsx
 * Author: Abdulaziz Albaiji
 *
 * System-wide settings page with role-based tab visibility:
 *
 *  Tabs visible to all roles:
 *    - Notifications  : per-user email alert preferences
 *    - User Defaults  : dark mode, colour-blind mode, text size, default dashboard
 *
 *  Tabs visible to Admin and Team Manager only:
 *    - Security       : session timeout duration and password complexity policy
 *    - Data & Backup  : manual backup trigger, auto-backup schedule, bulk export (CSV/ZIP)
 *
 *  Tab visible to Admin only (feature-flagged off by SHOW_QC_SETTINGS_TAB):
 *    - QC Rules       : toggle individual QC checks, severity thresholds, file limits
 *
 * All settings are persisted to localStorage using versioned keys so they
 * survive page reloads without a backend round-trip.
 * The "Save Changes" button is only enabled when there are unsaved changes (isDirty).
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Archive,
  Bell,
  CalendarClock,
  Database,
  Download,
  FileText,
  Lock,
  Shield,
  Timer,
  UserCircle,
  Moon,
  Glasses,
  Type,
  LayoutDashboard,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { adminApi, teamsApi } from "../../services/api.ts";
import {
  applyDisplayPrefsToDocument,
  applyUserDisplayPreferencesToDocument,
  loadUserDisplayPreferences,
  saveUserDisplayPreferences,
  type DefaultDashboardViewOption,
  type TextSizeOption,
  type UserDisplayPreferences,
} from "../../utils/userDisplayPreferences";
import { useLanguage } from "../../context/useLanguage";

interface SettingsViewProps {
  readonly userRole: "admin" | "team_manager" | "consultant";
  readonly userEmail: string;
}

type SettingsTab = "qc-rules" | "notifications" | "security" | "data-backup" | "user-defaults";

type SectionId =
  | "qc-rules"
  | "severity"
  | "file-processing"
  | "custom-keywords"
  | "session-timeout"
  | "password-policy"
  | "manual-backup"
  | "auto-backup-schedule"
  | "data-export";

/** localStorage key for persisting the main settings object. */
const STORAGE_KEY = "ligtas-system-settings-v1";
/** localStorage key for persisting email notification toggle preferences. */
const NOTIFICATION_EMAIL_KEY = "ligtas-notification-email-v1";

/** Feature flag: set to true to show the QC Settings tab (currently disabled). */
const SHOW_QC_SETTINGS_TAB = false;
/** Feature flag: set to true to show individual QC rule toggles within the QC tab. */
const SHOW_QC_RULES = false;

type EmailNotificationKey =
  | "reportCompletion"
  | "failedQc"
  | "weeklySummary"
  | "newUserReg";

const DEFAULT_EMAIL_NOTIFICATIONS: Record<EmailNotificationKey, boolean> = {
  reportCompletion: true,
  failedQc: true,
  weeklySummary: true,
  newUserReg: true,
};

type QCRuleKey =
  | "squareBracket"
  | "guidanceText"
  | "buildingContradictions"
  | "requiredFields"
  | "limitationAction";

const DEFAULT_QC_TOGGLES: Record<QCRuleKey, boolean> = {
  squareBracket: true,
  guidanceText: true,
  buildingContradictions: true,
  requiredFields: true,
  limitationAction: true,
};

const HIGH_SEVERITY_OPTIONS = [
  { value: "any-high-fail", labelKey: "anyHighSeverityIssueFailed" },
  { value: "two-high-fail", labelKey: "twoHighSeverityIssuesFailed" },
  { value: "manual-only", labelKey: "manualReviewOnlyNoAutofail" },
] as const;

const MEDIUM_SEVERITY_OPTIONS = [
  { value: "five-medium-warning", labelKey: "fiveMediumIssuesWarning" },
  { value: "three-medium-warning", labelKey: "threeMediumIssuesWarning" },
  { value: "ignore-medium", labelKey: "ignoreMediumSeverityPassFail" },
] as const;

const DEFAULT_PLACEHOLDER_PATTERNS = `[X]
[insert here]
[delete]
[TBD]`;

const DEFAULT_GUIDANCE_PATTERNS = `*** delete ***
delete as appropriate
insert [X] here`;

interface PersistedShape {
  qcToggles: Record<QCRuleKey, boolean>;
  highSeverity: string;
  mediumSeverity: string;
  maxFileSize: string;
  acceptedFileTypes: string;
  reportRetention: string;
  placeholderPatterns: string;
  guidancePatterns: string;
  sessionTimeoutMinutes: string;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  backupSchedule: string;
  childSections: SectionId[];
  hiddenSections: SectionId[];
}

const DEFAULT_PERSISTED: PersistedShape = {
  qcToggles: { ...DEFAULT_QC_TOGGLES },
  highSeverity: "any-high-fail",
  mediumSeverity: "five-medium-warning",
  maxFileSize: "50 MB",
  acceptedFileTypes: "PDF only",
  reportRetention: "90 days",
  placeholderPatterns: DEFAULT_PLACEHOLDER_PATTERNS,
  guidancePatterns: DEFAULT_GUIDANCE_PATTERNS,
  sessionTimeoutMinutes: "30",
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: true,
  backupSchedule: "weekly",
  childSections: [],
  hiddenSections: [],
};

const BACKUP_SCHEDULE_OPTIONS = [
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
  { value: "monthly", labelKey: "monthly" },
] as const;

const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", labelKey: "fifteenMinutes" },
  { value: "30", labelKey: "thirtyMinutes" },
  { value: "60", labelKey: "oneHour" },
  { value: "120", labelKey: "twoHours" },
  { value: "240", labelKey: "fourHours" },
  { value: "480", labelKey: "eightHours" },
  { value: "never", labelKey: "neverStaySignedIn" },
] as const;

/** Loads email notification preferences from localStorage, merging with defaults. */
function loadNotificationEmail(): Record<EmailNotificationKey, boolean> {
  try {
    if (typeof localStorage === "undefined") return { ...DEFAULT_EMAIL_NOTIFICATIONS };
    const raw = localStorage.getItem(NOTIFICATION_EMAIL_KEY);
    if (!raw) return { ...DEFAULT_EMAIL_NOTIFICATIONS };
    const parsed = JSON.parse(raw) as Partial<Record<EmailNotificationKey, boolean>>;
    return {
      ...DEFAULT_EMAIL_NOTIFICATIONS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_EMAIL_NOTIFICATIONS };
  }
}

/** Persists email notification preferences to localStorage. */
function saveNotificationEmailPrefs(v: Record<EmailNotificationKey, boolean>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(NOTIFICATION_EMAIL_KEY, JSON.stringify(v));
}

/**
 * Loads the main settings object from localStorage, merging saved values with
 * defaults so new fields added in future versions are always initialised safely.
 * Invalid enum values (e.g. an old session timeout) are reset to defaults.
 */
function loadPersisted(): PersistedShape {
  try {
    if (typeof localStorage === "undefined") return { ...DEFAULT_PERSISTED, qcToggles: { ...DEFAULT_QC_TOGGLES } };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSISTED, qcToggles: { ...DEFAULT_QC_TOGGLES } };
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    const merged: PersistedShape = {
      ...DEFAULT_PERSISTED,
      ...parsed,
      qcToggles: { ...DEFAULT_QC_TOGGLES, ...parsed.qcToggles },
      childSections: Array.isArray(parsed.childSections) ? parsed.childSections : [],
      hiddenSections: Array.isArray(parsed.hiddenSections) ? parsed.hiddenSections : [],
    };
    if (typeof merged.sessionTimeoutMinutes !== "string" || !merged.sessionTimeoutMinutes) {
      merged.sessionTimeoutMinutes = DEFAULT_PERSISTED.sessionTimeoutMinutes;
    }
    if (typeof merged.passwordMinLength !== "number" || merged.passwordMinLength < 6 || merged.passwordMinLength > 32) {
      merged.passwordMinLength = DEFAULT_PERSISTED.passwordMinLength;
    }
    for (const k of [
      "passwordRequireUppercase",
      "passwordRequireLowercase",
      "passwordRequireNumber",
      "passwordRequireSpecial",
    ] as const) {
      if (typeof merged[k] !== "boolean") merged[k] = DEFAULT_PERSISTED[k];
    }
    const allowedSession = new Set(["15", "30", "60", "120", "240", "480", "never"]);
    if (!allowedSession.has(merged.sessionTimeoutMinutes)) {
      merged.sessionTimeoutMinutes = DEFAULT_PERSISTED.sessionTimeoutMinutes;
    }
    const allowedBackup = new Set(["daily", "weekly", "monthly"]);
    if (typeof merged.backupSchedule !== "string" || !allowedBackup.has(merged.backupSchedule)) {
      merged.backupSchedule = DEFAULT_PERSISTED.backupSchedule;
    }
    return merged;
  } catch {
    return { ...DEFAULT_PERSISTED, qcToggles: { ...DEFAULT_QC_TOGGLES } };
  }
}

const selectTriggerClass =
  "h-auto min-h-9 w-full rounded-lg border-2 border-input bg-input-background py-2 text-left text-sm text-foreground shadow-none focus:border-ring focus:ring-2 focus:ring-ring/30 focus:ring-offset-0 [&>svg]:text-muted-foreground";

const selectContentClass =
  "z-[100] border-2 border-border bg-popover text-popover-foreground";

function SettingsSaveButton({
  disabled,
  onClick,
}: {
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Button
      type="button"
      disabled={disabled}
      className="min-w-[160px] bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {t("saveChanges")}
    </Button>
  );
}

export function SettingsView({ userRole, userEmail }: SettingsViewProps) {
  const { t } = useLanguage();

  const EMAIL_NOTIFICATION_DEFS: {
    key: EmailNotificationKey;
    title: string;
    description: string;
  }[] = [
    {
      key: "reportCompletion",
      title: t("reportCompletionAlerts"),
      description: t("receiveEmailWhenReportFinished"),
    },
    {
      key: "failedQc",
      title: t("failedQcReportAlerts"),
      description: t("receiveEmailWhenReportFailsQc"),
    },
    {
      key: "weeklySummary",
      title: t("weeklySummaryReport"),
      description: t("receiveWeeklyDigestQcActivity"),
    },
    {
      key: "newUserReg",
      title: t("newUserRegistrationAlerts"),
      description: t("receiveEmailWhenNewUserRegisters"),
    },
  ];

  const QC_RULES: {
    key: QCRuleKey;
    title: string;
    description: string;
    userStory: string;
  }[] = [
    {
      key: "squareBracket",
      title: t("squareBracketDetection"),
      description: t("detectsSquareBracketPlaceholders"),
      userStory: "US-003",
    },
    {
      key: "guidanceText",
      title: t("guidanceTextDetection"),
      description: t("flagsGuidanceTextPatterns"),
      userStory: "US-004",
    },
    {
      key: "buildingContradictions",
      title: t("buildingCharacteristicContradictions"),
      description: t("identifiesInconsistentBuildingDetails"),
      userStory: "US-007",
    },
    {
      key: "requiredFields",
      title: t("requiredFieldsCheck"),
      description: t("checksHeightAreaOccupancyTypeDate"),
      userStory: "US-005",
    },
    {
      key: "limitationAction",
      title: t("limitationVsActionContradictions"),
      description: t("crossReferencesLimitationsActions"),
      userStory: "US-006, US-008",
    },
  ];

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (userRole === "consultant") {
      return "notifications";
    }
    if (!SHOW_QC_SETTINGS_TAB) {
      return "notifications";
    }
    return "qc-rules";
  });
  const [settings, setSettings] = useState<PersistedShape>(() => loadPersisted());
  const [resetOpen, setResetOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<"csv" | "zip" | null>(null);
  const [teamsList, setTeamsList] = useState<{ id: string; name: string }[]>([]);
  const [managedTeam, setManagedTeam] = useState<{ id: string; name: string } | null>(null);
  const [backupTeamTarget, setBackupTeamTarget] = useState<"all" | string>("all");

  const [emailNotifDraft, setEmailNotifDraft] = useState<Record<EmailNotificationKey, boolean>>(() =>
    loadNotificationEmail(),
  );

  const [displayPrefs, setDisplayPrefs] = useState<UserDisplayPreferences>(() =>
    loadUserDisplayPreferences(userEmail),
  );

  const [savedMeta, setSavedMeta] = useState(() => ({
    settings: JSON.stringify(loadPersisted()),
    email: JSON.stringify(loadNotificationEmail()),
    display: JSON.stringify(loadUserDisplayPreferences(userEmail)),
  }));

  useEffect(() => {
    const s = loadPersisted();
    const e = loadNotificationEmail();
    const d = loadUserDisplayPreferences(userEmail);
    setSettings(s);
    setEmailNotifDraft(e);
    setDisplayPrefs(d);
    applyDisplayPrefsToDocument(d);
    setSavedMeta({
      settings: JSON.stringify(s),
      email: JSON.stringify(e),
      display: JSON.stringify(d),
    });
  }, [userEmail]);

  const updateDisplayPrefs = (next: UserDisplayPreferences) => {
    setDisplayPrefs(next);
    applyDisplayPrefsToDocument(next);
  };

  /**
   * True when any settings differ from the last saved snapshot.
   * Used to enable/disable the "Save Changes" button.
   */
  const isDirty = useMemo(
    () =>
      JSON.stringify(settings) !== savedMeta.settings ||
      JSON.stringify(emailNotifDraft) !== savedMeta.email ||
      JSON.stringify(displayPrefs) !== savedMeta.display,
    [settings, emailNotifDraft, displayPrefs, savedMeta],
  );

  /**
   * Persists all current settings (main settings, email notifications, display prefs)
   * to localStorage and updates the saved snapshot so isDirty resets to false.
   */
  const handleSaveChanges = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    saveNotificationEmailPrefs(emailNotifDraft);
    saveUserDisplayPreferences(userEmail, displayPrefs);
    applyUserDisplayPreferencesToDocument(userEmail);
    setSavedMeta({
      settings: JSON.stringify(settings),
      email: JSON.stringify(emailNotifDraft),
      display: JSON.stringify(displayPrefs),
    });
    toast.success(t("yourChangesHaveBeenSaved"));
  }, [settings, emailNotifDraft, displayPrefs, userEmail, t]);

  const setEmailNotifToggle = (key: EmailNotificationKey, value: boolean) => {
    setEmailNotifDraft((prev) => ({ ...prev, [key]: value }));
  };

  const runManualBackup = async () => {
    if (userRole === "team_manager" && !managedTeam) {
      toast.error(t("noTeamAssignedContactAdmin"));
      return;
    }
    setBackupLoading(true);
    try {
      const r = await adminApi.manualBackup(
        userRole === "admin"
          ? { teamId: backupTeamTarget === "all" ? "all" : backupTeamTarget }
          : undefined,
      );
      toast.success(r.message ?? t("backupCompleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("backupFailed"));
    } finally {
      setBackupLoading(false);
    }
  };

  const runExportAll = async (format: "csv" | "zip") => {
    if (userRole === "team_manager" && !managedTeam) {
      toast.error(t("noTeamAssignedContactAdmin"));
      return;
    }
    setExportLoading(format);
    try {
      const file = await adminApi.exportAllReports(
        format,
        userRole === "admin"
          ? { teamId: backupTeamTarget === "all" ? "all" : backupTeamTarget }
          : undefined,
      );
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${t("downloadStarted")} (${format.toUpperCase()}).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("exportFailed"));
    } finally {
      setExportLoading(null);
    }
  };

  useEffect(() => {
    if (!SHOW_QC_SETTINGS_TAB && activeTab === "qc-rules") {
      setActiveTab("notifications");
    }
  }, [activeTab]);

  useEffect(() => {
    if (userRole !== "consultant") return;
    if (activeTab === "qc-rules" || activeTab === "security" || activeTab === "data-backup") {
      setActiveTab("notifications");
    }
  }, [userRole, activeTab]);

  useEffect(() => {
    if (userRole !== "admin" || activeTab !== "data-backup") return;
    teamsApi
      .list()
      .then((tms) => setTeamsList(tms.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setTeamsList([]));
  }, [userRole, activeTab]);

  useEffect(() => {
    if (userRole !== "team_manager" || activeTab !== "data-backup") return;
    teamsApi
      .me()
      .then((tm) => setManagedTeam(tm ? { id: tm.id, name: tm.name } : null))
      .catch(() => setManagedTeam(null));
  }, [userRole, activeTab]);

  const {
    qcToggles,
    highSeverity,
    mediumSeverity,
    maxFileSize,
    acceptedFileTypes,
    reportRetention,
    placeholderPatterns,
    guidancePatterns,
    sessionTimeoutMinutes,
    passwordMinLength,
    passwordRequireUppercase,
    passwordRequireLowercase,
    passwordRequireNumber,
    passwordRequireSpecial,
    backupSchedule,
  } = settings;

  const childSections = useMemo(() => new Set(settings.childSections), [settings.childSections]);
  const hiddenSections = useMemo(() => new Set(settings.hiddenSections), [settings.hiddenSections]);

  const setToggle = (key: QCRuleKey, value: boolean) => {
    setSettings((s) => ({
      ...s,
      qcToggles: { ...s.qcToggles, [key]: value },
    }));
  };

  const restoreHiddenSections = () => {
    setSettings((s) => ({ ...s, hiddenSections: [] }));
    toast.success(t("allSectionsRestored"));
  };

  const applyResetDefaults = () => {
    setSettings((s) => ({
      ...s,
      placeholderPatterns: DEFAULT_PLACEHOLDER_PATTERNS,
      guidancePatterns: DEFAULT_GUIDANCE_PATTERNS,
    }));
    setResetOpen(false);
    toast.success(t("customDetectionKeywordsResetToDefaults"));
  };

  const subNavItems: {
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = useMemo(
    () => [
      {
        id: "qc-rules",
        label: SHOW_QC_RULES ? t("qcCheckRules") : t("processingAndThresholds"),
        icon: FileText,
      },
      { id: "notifications", label: t("notifications"), icon: Bell },
      { id: "security", label: t("security"), icon: Shield },
      { id: "data-backup", label: t("dataAndBackup"), icon: Database },
      { id: "user-defaults", label: t("userDefaults"), icon: UserCircle },
    ],
    [t],
  );

  const visibleSubNavItems = useMemo(() => {
    const base = SHOW_QC_SETTINGS_TAB ? subNavItems : subNavItems.filter((i) => i.id !== "qc-rules");
    if (userRole === "consultant") {
      return base.filter((i) => i.id === "notifications" || i.id === "user-defaults");
    }
    return base;
  }, [userRole, subNavItems]);

  const sectionIndent = (id: SectionId) =>
    childSections.has(id) ? "ml-6 border-l-2 border-border pl-4" : "";

  const showBanner = hiddenSections.size > 0;

  return (
    <div className="flex min-h-full bg-background">
      <aside className="w-56 flex-shrink-0 border-r-2 border-border bg-card">
        <nav className="space-y-1 p-4">
          {visibleSubNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-card-foreground hover:bg-muted/50"
                }`}
              >
                <Icon
                  className={`size-5 flex-shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 p-8">
        <div className="mb-8 flex flex-col items-center text-center sm:items-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("general")}
          </p>
          <h1 className="mb-2 text-4xl font-bold text-foreground">{t("systemSettings")}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {!SHOW_QC_SETTINGS_TAB
              ? t("configureNotificationsSecurityBackupsDisplayDefaults")
              : SHOW_QC_RULES
                ? t("configureQualityControlRulesAndSystemPreferences")
                : t("configureSystemPreferencesAndProcessingOptions")}{" "}
            {t("useSaveChangesWhenFinished")}
          </p>
        </div>

        {showBanner && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground">
            <p className="text-sm text-muted-foreground">
              {hiddenSections.size} {t("sectionsHiddenFromView")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="ligtas-btn-outline border-2"
              onClick={restoreHiddenSections}
            >
              {t("restoreAllSections")}
            </Button>
          </div>
        )}

        {SHOW_QC_SETTINGS_TAB && activeTab === "qc-rules" && userRole !== "consultant" && (
          <div className="mx-auto max-w-4xl space-y-8">
            {SHOW_QC_RULES && !hiddenSections.has("qc-rules") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("qc-rules")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("qualityControlCheckRules")}</CardTitle>
                      <CardDescription className="text-base text-muted-foreground">
                        {t("enableOrDisableAutomatedChecks")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {QC_RULES.map((rule) => {
                    const on = qcToggles[rule.key];
                    return (
                      <div
                        key={rule.key}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{rule.title}</span>
                            <Badge
                              className={`rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {on ? t("enabledUpper") : t("disabledUpper")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                          <p className="text-xs text-muted-foreground">{t("userStory")}: {rule.userStory}</p>
                        </div>
                        <div className="flex shrink-0 justify-end sm:pl-4">
                          <Switch checked={on} onCheckedChange={(v) => setToggle(rule.key, v)} aria-label={rule.title} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("severity") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("severity")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t("issueSeverityThresholds")}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {t("setWhenQcResultsInFailureOrWarnings")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="high-severity" className="text-sm font-medium text-foreground">
                      {t("highSeverityThresholdPassFail")}
                    </Label>
                    <Select
                      value={highSeverity}
                      onValueChange={(v) => setSettings((s) => ({ ...s, highSeverity: v }))}
                    >
                      <SelectTrigger id="high-severity" className={selectTriggerClass}>
                        <SelectValue placeholder={t("selectThreshold")} />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {HIGH_SEVERITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                            {t(o.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">{t("determinesWhenReportAutomaticallyFailsQc")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medium-severity" className="text-sm font-medium text-foreground">
                      {t("mediumSeverityThreshold")}
                    </Label>
                    <Select
                      value={mediumSeverity}
                      onValueChange={(v) => setSettings((s) => ({ ...s, mediumSeverity: v }))}
                    >
                      <SelectTrigger id="medium-severity" className={selectTriggerClass}>
                        <SelectValue placeholder={t("selectThreshold")} />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {MEDIUM_SEVERITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                            {t(o.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">{t("controlsWhenMediumIssuesTriggerWarning")}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("file-processing") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("file-processing")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t("fileProcessingSettings")}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {t("limitsAndRetentionForUploadedReports")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 pt-2 sm:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="max-file-size">{t("maximumFileSize")}</Label>
                    <Input
                      id="max-file-size"
                      value={maxFileSize}
                      onChange={(e) => setSettings((s) => ({ ...s, maxFileSize: e.target.value }))}
                      className="rounded-lg border-2 border-input bg-input-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:ring-offset-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accepted-types">{t("acceptedFileTypes")}</Label>
                    <Input
                      id="accepted-types"
                      value={acceptedFileTypes}
                      onChange={(e) => setSettings((s) => ({ ...s, acceptedFileTypes: e.target.value }))}
                      className="rounded-lg border-2 border-input bg-input-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:ring-offset-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retention">{t("reportRetentionPeriod")}</Label>
                    <Input
                      id="retention"
                      value={reportRetention}
                      onChange={(e) => setSettings((s) => ({ ...s, reportRetention: e.target.value }))}
                      className="rounded-lg border-2 border-input bg-input-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:ring-offset-0"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("custom-keywords") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("custom-keywords")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t("customDetectionKeywords")}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {t("onePatternPerLineUsedByChecks")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="placeholder-patterns">{t("additionalPlaceholderPatterns")}</Label>
                    <Textarea
                      id="placeholder-patterns"
                      rows={6}
                      value={placeholderPatterns}
                      onChange={(e) => setSettings((s) => ({ ...s, placeholderPatterns: e.target.value }))}
                      className="rounded-lg border-2 border-input bg-input-background font-mono text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guidance-patterns">{t("guidanceTextPatterns")}</Label>
                    <Textarea
                      id="guidance-patterns"
                      rows={6}
                      value={guidancePatterns}
                      onChange={(e) => setSettings((s) => ({ ...s, guidancePatterns: e.target.value }))}
                      className="rounded-lg border-2 border-input bg-input-background font-mono text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="ligtas-btn-outline border-2"
                      onClick={() => setResetOpen(true)}
                    >
                      {t("resetToDefaults")}
                    </Button>
                    <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
                  </div>
                </CardContent>
              </Card>
            )}

            {hiddenSections.has("custom-keywords") && (
              <div className="flex justify-center pt-4">
                <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
              </div>
            )}
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="mx-auto max-w-4xl space-y-8">
            <Card className="ligtas-surface-card rounded-xl shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-start gap-3">
                  <Bell className="mt-0.5 size-6 text-foreground" />
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">{t("emailNotifications")}</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                      {t("chooseWhichEmailAlertsYouWant")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {EMAIL_NOTIFICATION_DEFS.map((row) => {
                  const on = emailNotifDraft[row.key];
                  return (
                    <div
                      key={row.key}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{row.title}</span>
                          <Badge
                            className={`rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {on ? t("onUpper") : t("offUpper")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{row.description}</p>
                      </div>
                      <div className="flex shrink-0 justify-end sm:pl-4">
                        <Switch
                          checked={on}
                          onCheckedChange={(v) => setEmailNotifToggle(row.key, v)}
                          aria-label={row.title}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex justify-center pt-8">
              <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
            </div>
          </div>
        )}

        {activeTab === "security" && userRole !== "consultant" && (
          <div className="mx-auto max-w-4xl space-y-8">
            {!hiddenSections.has("session-timeout") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("session-timeout")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <Timer className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("sessionTimeout")}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("howLongUserCanStayInactive")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  <Label htmlFor="session-timeout" className="text-sm font-medium text-foreground">
                    {t("sessionTimeout")}
                  </Label>
                  <Select
                    value={sessionTimeoutMinutes}
                    onValueChange={(v) => setSettings((s) => ({ ...s, sessionTimeoutMinutes: v }))}
                  >
                    <SelectTrigger id="session-timeout" className={selectTriggerClass}>
                      <SelectValue placeholder={t("selectDuration")} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {SESSION_TIMEOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                          {t(o.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t("appliesToBrowserAfterNextInteraction")}
                  </p>
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("password-policy") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("password-policy")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("passwordPolicy")}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("minimumLengthAndComplexityForPasswords")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="pwd-min-len">{t("minimumPasswordLength")}</Label>
                    <Input
                      id="pwd-min-len"
                      type="number"
                      min={6}
                      max={32}
                      value={passwordMinLength}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setSettings((s) => ({
                          ...s,
                          passwordMinLength: Number.isFinite(n) ? Math.min(32, Math.max(6, n)) : s.passwordMinLength,
                        }));
                      }}
                      className="max-w-xs rounded-lg border-2 border-input bg-input-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:ring-offset-0"
                    />
                    <p className="text-sm text-muted-foreground">{t("betweenSixAndThirtyTwoCharacters")}</p>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-foreground">{t("requireUppercaseLetter")}</span>
                    <Switch
                      checked={passwordRequireUppercase}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, passwordRequireUppercase: v }))}
                      aria-label={t("requireUppercaseLetter")}
                    />
                  </div>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-foreground">{t("requireLowercaseLetter")}</span>
                    <Switch
                      checked={passwordRequireLowercase}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, passwordRequireLowercase: v }))}
                      aria-label={t("requireLowercaseLetter")}
                    />
                  </div>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-foreground">{t("requireNumber")}</span>
                    <Switch
                      checked={passwordRequireNumber}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, passwordRequireNumber: v }))}
                      aria-label={t("requireNumber")}
                    />
                  </div>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-foreground">{t("requireSpecialCharacter")}</span>
                    <Switch
                      checked={passwordRequireSpecial}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, passwordRequireSpecial: v }))}
                      aria-label={t("requireSpecialCharacter")}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center pt-8">
              <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
            </div>
          </div>
        )}

        {activeTab === "data-backup" && userRole !== "consultant" && (
          <div className="mx-auto max-w-4xl space-y-8">
            <Card className="ligtas-surface-card rounded-xl shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-lg font-bold text-foreground">{t("backupAndExportScope")}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {userRole === "admin"
                    ? t("chooseWhetherBackupsAndExportsIncludeAllTeams")
                    : t("backupsAndExportsApplyOnlyToManagedTeam")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {userRole === "admin" ? (
                  <>
                    <Label htmlFor="backup-team-scope">{t("team")}</Label>
                    <Select
                      value={backupTeamTarget}
                      onValueChange={(v) => setBackupTeamTarget(v as "all" | string)}
                    >
                      <SelectTrigger id="backup-team-scope" className={selectTriggerClass}>
                        <SelectValue placeholder={t("selectScope")} />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        <SelectItem value="all" className="cursor-pointer">
                          {t("allTeamsEntireOrganization")}
                        </SelectItem>
                        {teamsList.map((tm) => (
                          <SelectItem key={tm.id} value={tm.id} className="cursor-pointer">
                            {tm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <p className="text-sm text-foreground">
                    {managedTeam ? (
                      <>
                        <span className="font-semibold">{t("team")}:</span> {managedTeam.name}
                      </>
                    ) : (
                      <span className="text-amber-800">{t("notAssignedAsTeamManagerYet")}</span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            {!hiddenSections.has("manual-backup") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("manual-backup")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <Archive className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("manualBackup")}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("runOnDemandBackupNow")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <Button
                    type="button"
                    disabled={backupLoading || (userRole === "team_manager" && !managedTeam)}
                    className="bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    onClick={() => void runManualBackup()}
                  >
                    {backupLoading ? t("runningBackup") : t("runBackupNow")}
                  </Button>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("createsBackupJobOnServer")}
                  </p>
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("auto-backup-schedule") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("auto-backup-schedule")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("automaticBackupSchedule")}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("howOftenAutomaticBackupsShouldRun")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  <Label htmlFor="backup-schedule" className="text-sm font-medium text-foreground">
                    {t("frequency")}
                  </Label>
                  <Select
                    value={backupSchedule}
                    onValueChange={(v) => setSettings((s) => ({ ...s, backupSchedule: v }))}
                  >
                    <SelectTrigger id="backup-schedule" className={selectTriggerClass}>
                      <SelectValue placeholder={t("selectFrequency")} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {BACKUP_SCHEDULE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                          {(o.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t("automaticJobsRequireServerScheduler")}
                  </p>
                </CardContent>
              </Card>
            )}

            {!hiddenSections.has("data-export") && (
              <Card className={`ligtas-surface-card rounded-xl shadow-sm ${sectionIndent("data-export")}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <Download className="mt-0.5 size-6 text-foreground" />
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{t("dataExport")}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("exportCompletedQcReportsForScope")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 pt-2">
                  {userRole === "admin" || userRole === "team_manager" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          exportLoading !== null || (userRole === "team_manager" && !managedTeam)
                        }
                        className="ligtas-btn-outline border-2 disabled:opacity-50"
                        onClick={() => void runExportAll("csv")}
                      >
                        {exportLoading === "csv" ? t("preparingCsv") : t("exportAsCsv")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          exportLoading !== null || (userRole === "team_manager" && !managedTeam)
                        }
                        className="ligtas-btn-outline border-2 disabled:opacity-50"
                        onClick={() => void runExportAll("zip")}
                      >
                        {exportLoading === "zip" ? t("preparingZip") : t("exportAsZip")}
                      </Button>
                      <p className="w-full text-sm text-muted-foreground">
                        {t("csvCombinedZipOnePerReport")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("bulkExportAvailableAdminsManagers")}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center pt-8">
              <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
            </div>
          </div>
        )}

        {activeTab === "user-defaults" && (
          <div className="mx-auto max-w-4xl space-y-8">
            <Card className="ligtas-surface-card rounded-xl shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-start gap-3">
                  <UserCircle className="mt-0.5 size-6 text-foreground" />
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      {t("userDefaultsDisplayAccessibility")}
                    </CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                      {t("savedPerUserInBrowser")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-10 pt-6">
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Moon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Label className="text-base font-semibold text-foreground">{t("darkModeNightMode")}</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("switchesEntireInterfaceToDark")}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={displayPrefs.darkMode}
                    onCheckedChange={(checked) => updateDisplayPrefs({ ...displayPrefs, darkMode: checked })}
                  />
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Glasses className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Label className="text-base font-semibold text-foreground">{t("colourBlindMode")}</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("usesColourBlindFriendlyPalette")}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={displayPrefs.colourBlindMode}
                    onCheckedChange={(checked) =>
                      updateDisplayPrefs({ ...displayPrefs, colourBlindMode: checked })
                    }
                  />
                </div>

                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <Type className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <Label htmlFor="text-size" className="text-base font-semibold text-foreground">
                        {t("textSize")}
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("smallMediumLargeFontSize")}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={displayPrefs.textSize}
                    onValueChange={(value) =>
                      updateDisplayPrefs({ ...displayPrefs, textSize: value as TextSizeOption })
                    }
                  >
                    <SelectTrigger id="text-size" className={selectTriggerClass}>
                      <SelectValue placeholder={t("selectSize")} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="small" className="cursor-pointer">
                        {t("small")}
                      </SelectItem>
                      <SelectItem value="medium" className="cursor-pointer">
                        {t("mediumDefault")}
                      </SelectItem>
                      <SelectItem value="large" className="cursor-pointer">
                        {t("large")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <LayoutDashboard className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <Label htmlFor="default-dashboard" className="text-base font-semibold text-foreground">
                        {t("defaultDashboardView")}
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("whichSectionLoadsFirst")}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={displayPrefs.defaultDashboardView}
                    onValueChange={(value) =>
                      updateDisplayPrefs({
                        ...displayPrefs,
                        defaultDashboardView: value as DefaultDashboardViewOption,
                      })
                    }
                  >
                    <SelectTrigger id="default-dashboard" className={selectTriggerClass}>
                      <SelectValue placeholder={t("selectView")} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="dashboard" className="cursor-pointer">
                        {t("dashboard")}
                      </SelectItem>
                      <SelectItem value="upload" className="cursor-pointer">
                        {t("uploadReport")}
                      </SelectItem>
                      <SelectItem value="history" className="cursor-pointer">
                        {t("reportHistory")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center pt-8">
              <SettingsSaveButton disabled={!isDirty} onClick={handleSaveChanges} />
            </div>
          </div>
        )}

        {activeTab !== "qc-rules" &&
          activeTab !== "notifications" &&
          activeTab !== "security" &&
          activeTab !== "data-backup" &&
          activeTab !== "user-defaults" && (
          <div className="mx-auto max-w-2xl rounded-xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-lg font-semibold text-foreground">{t("comingSoon")}</p>
            <p className="mt-2 text-muted-foreground">
              {t("settingsForThisCategoryFutureRelease")}
            </p>
          </div>
        )}
      </div>

      <Transition show={resetOpen} as={React.Fragment}>
        <Dialog onClose={() => setResetOpen(false)} className="relative z-[200]">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl border-2 border-border bg-card p-6 text-card-foreground shadow-xl">
                <Dialog.Title className="text-xl font-bold text-foreground">{t("resetCustomKeywords")}</Dialog.Title>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("resetKeywordsDescription")}
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="ligtas-btn-outline border-2"
                    onClick={() => setResetOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="button"
                    className="bg-primary text-primary-foreground hover:opacity-90"
                    onClick={applyResetDefaults}
                  >
                    {t("resetToDefaults")}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}