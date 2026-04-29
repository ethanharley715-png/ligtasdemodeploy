import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getInitialDashboardView } from "../../utils/userDisplayPreferences";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { DashboardView } from "../views/DashboardView.tsx";
import { UploadView } from "../views/UploadView.tsx";
import { ReportHistoryView } from "../views/ReportHistoryView.tsx";
import { AnalyticsView } from "../views/AnalyticsView.tsx";
import { AILearningView } from "../views/AILearningView.tsx";
import { UserManagementView } from "../views/UserManagementView.tsx";
import { TeamView } from "../views/TeamView.tsx";
import { TeamsView } from "../views/TeamsView.tsx";
import { TeamAnalyticsView } from "../views/TeamAnalyticsView.tsx";
import { SettingsView } from "../views/SettingsView.tsx";
import { QCResultsDebugView } from "../views/QCResultsDebugView.tsx";
import { MyProfileView } from "../views/MyProfileView.tsx";
import { SecurityAuditView } from "../views/SecurityAuditView.tsx";
import QCReportPage from "../views/QCResultsView.tsx";
import { type QCReport } from "../types/qc.ts";
import { transformToQCReport } from "../../Functions/parseResults.ts"
import { ProgressClock } from "../../pages/clock"; 
import { useLanguage } from "../../context/useLanguage";
import { useUpload } from "../../context/useUpload.tsx"
import { CheckCircle2, Info, Trash2, ChevronUp } from "lucide-react";




export type UploadState = "idle" | "uploading" | "success" | "error";
type TFunction = ReturnType<typeof useLanguage>["t"];

interface User {
  name: string;
  email: string;
  role: "admin" | "team_manager" | "consultant";
}

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
  initialView?: string;
}

interface LoadingBar {
    readonly uploadState: UploadState;
    readonly uploadProgress: number;
    readonly setShowCancelConfirm: React.Dispatch<React.SetStateAction<boolean>>;
}

//-----------------------------------------------------------------------------------

/** When navigating from another route (e.g. /reports), next mount opens main dashboard. */
const LOGO_HOME_DASHBOARD_SESSION_KEY = "ligtas-logo-home-dashboard";

function formatProgressText(progress: number, state: UploadState, t: TFunction): string {

    if (state !== "uploading") {
        return "";
    }

    if (progress >= 100) {
        return t("processingReport");
    }

    return `${t("uploading")} ${progress}%`;
}

const Notification = () => {
    const { uploadState } = useUpload();
    const { t } = useLanguage();
    const uploadSuccessShownRef = useRef(false);
    const [showUploadComplete, setShowUploadComplete] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (uploadState === "success" && !uploadSuccessShownRef.current) {
            uploadSuccessShownRef.current = true;

            const showTimer = window.setTimeout(() => {
                setShowUploadComplete(true);
                setIsClosing(false);
            }, 0);

            const closeTimer = setTimeout(() => {
                setIsClosing(true);
            }, 1800);

            const hideTimer = setTimeout(() => {
                setShowUploadComplete(false);
                setIsClosing(false);
                uploadSuccessShownRef.current = false;
            }, 2200);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(closeTimer);
                clearTimeout(hideTimer);
            };
        }

        if (uploadState !== "success") {
            uploadSuccessShownRef.current = false;
            const resetTimer = window.setTimeout(() => {
                setShowUploadComplete(false);
                setIsClosing(false);
            }, 0);

            return () => clearTimeout(resetTimer);
        }
    }, [uploadState]);

    if (!showUploadComplete) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed left-1/2 top-[5.25rem] z-[4000] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 px-2">
            <div
                className={`flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg transition-all duration-300 ${
                    isClosing ? "translate-y-[-6px] opacity-0" : "translate-y-0 opacity-100"
                }`}
            >
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{t("reportUploadedReady")}</span>
            </div>
        </div>
    );
};

const LoadingBar = ({ uploadState, uploadProgress, setShowCancelConfirm }: LoadingBar) => {
    const { t } = useLanguage();

    const [showInfo, setShowInfo] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!showInfo) return;
        const timer = setTimeout(() => setShowInfo(false), 2500);
        return () => clearTimeout(timer);
    }, [showInfo]);



    const toggleCollapse = () => setCollapsed(prev => !prev);

    return (
        <div className="fixed bottom-0 left-0 z-[1300] w-full border-t border-border bg-card/95 text-card-foreground shadow-[0_-4px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm">
            {/* ===== TOGGLE BUTTON ===== */}
            <div className="flex justify-center -mt-4">
                <button
                    onClick={toggleCollapse}
                    className="rounded-full border border-border bg-card p-1 shadow transition hover:scale-105"
                >
                    <div
                        className={`transition-transform duration-300 ${collapsed ? "": "rotate-180" 
                            }`}
                    >
                        <ChevronUp className="h-4 w-4 text-foreground" />
                    </div>
                </button>
            </div>

            {/* ===== COLLAPSED STATE ===== */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="px-4 pb-3 pt-1 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                        />
                    </div>

                    <span className="w-10 text-right text-xs text-muted-foreground">
                        {uploadProgress}%
                    </span>
                </div>
            </div>

            {/* ===== EXPANDED STATE ===== */}
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? "max-h-0 opacity-0" : "max-h-40 opacity-100"
                    }`}
            >
                <div className="px-4 pb-4 space-y-2 pt-2">
                    <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                            />
                        </div>

                        {/* Info button */}
                        <button
                            type="button"
                            onClick={() => setShowInfo(true)}
                            className="rounded-md p-2 transition hover:bg-muted/70"
                        >
                            <Info className="h-4 w-4 text-foreground" />
                        </button>

                        {/* Trash button */}
                        <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="rounded-md p-2 transition hover:bg-muted/70"
                        >
                            <Trash2 className="h-4 w-4 text-foreground" />
                        </button>
                    </div>

                    {/* Info popup */}
                    {showInfo && (
                        <div className="absolute bottom-16 right-6 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                            <ProgressClock percentDone={uploadProgress} />
                        </div>
                    )}

                    {/* Text */}
                    <p className="text-xs text-muted-foreground">
                        {formatProgressText(uploadProgress, uploadState, t)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export function DashboardLayout({ user, onLogout, onUserUpdate, initialView }: DashboardLayoutProps) {

    const [showCancelConfirm, setShowCancelConfirm ] = useState(false);
    const { uploadState, uploadProgress, abortControllerRef } = useUpload();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const { t } = useLanguage();

    

  const readNextDashboardView = () => {
    if (typeof sessionStorage !== "undefined") {
      const logoHome = sessionStorage.getItem(LOGO_HOME_DASHBOARD_SESSION_KEY);
      if (logoHome === "1") {
        sessionStorage.removeItem(LOGO_HOME_DASHBOARD_SESSION_KEY);
        return "dashboard";
      }
    }

    const nextView = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("ligtas-next-dashboard-view")
      : null;

    if (nextView) {
      sessionStorage.removeItem("ligtas-next-dashboard-view");
      return nextView as string;
    }

    return getInitialDashboardView(user.email);
  };
  const [activeView, setActiveView] = useState(() =>
    initialView != null && initialView !== "" ? initialView : readNextDashboardView(),
  );

  const handleLogoNavigateHome = useCallback(() => {
    setActiveView("dashboard");
    if (pathname !== "/") {
      sessionStorage.setItem(LOGO_HOME_DASHBOARD_SESSION_KEY, "1");
    }
    void navigate("/");
  }, [navigate, pathname]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("ligtas-current-report-id") : null,
  );
  const [uploadedFileName, setUploadedFileName] = useState<string>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("ligtas-current-report-file-name") ?? "" : "",
  );

  useEffect(() => {
    const syncStoredReportState = () => {
      setCurrentReportId(typeof localStorage !== "undefined" ? localStorage.getItem("ligtas-current-report-id") : null);
      setUploadedFileName(
        typeof localStorage !== "undefined" ? localStorage.getItem("ligtas-current-report-file-name") ?? "" : "",
      );

      const nextView = typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("ligtas-next-dashboard-view")
        : null;

      if (nextView) {
        sessionStorage.removeItem("ligtas-next-dashboard-view");
        setActiveView(nextView);
      }
    };

    window.addEventListener("storage", syncStoredReportState);
    window.addEventListener("ligtas-report-result-updated", syncStoredReportState as EventListener);

    return () => {
      window.removeEventListener("storage", syncStoredReportState);
      window.removeEventListener("ligtas-report-result-updated", syncStoredReportState as EventListener);
    };
  }, []);

const stored = typeof localStorage !== "undefined" ? localStorage.getItem("reportResult") : null;

const emptyReport: QCReport = (() => {
  const fallback: QCReport = {
    summary: {
      totalIssues: 0,
      passed: false,
    },
    issues: [],
  };

  if (!stored) {
    return fallback;
  }

  try {
    const rawData = JSON.parse(stored);

    if (!rawData || rawData.analysisStatus === "pending") {
      return fallback;
    }

    return transformToQCReport(rawData);
  } catch (error) {
    console.error("Failed to build QC report from localStorage:", error);
    return fallback;
  }
})();






  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "upload":
        return <UploadView />;
      case "results":
        return (
          <QCReportPage
            reportId={currentReportId}
            fileName={uploadedFileName}
            report={emptyReport}
            viewerRole={user.role}
          />
        );
      case "history":
        return <ReportHistoryView userRole={user.role} />;
      case "analytics":
        return user.role === "admin"
          ? <AnalyticsView />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "team-analytics":
        return (user.role === "admin" || user.role === "team_manager")
          ? <TeamAnalyticsView userRole={user.role} />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "ai-learning":
        return (user.role === "admin" || user.role === "team_manager")
          ? <AILearningView />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "teams":
        return user.role === "admin"
          ? <TeamsView />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "team":
        return <TeamView />;
      case "users":
        return user.role === "admin"
          ? <UserManagementView currentUserEmail={user.email} />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      case "settings":
        return <SettingsView userRole={user.role} userEmail={user.email} />;
      case "profile":
        return <MyProfileView user={user} onUserUpdate={onUserUpdate} />;
      case "qc-debug":
        return <QCResultsDebugView />;
      case "security-events":
        return user.role === "admin"
          ? <SecurityAuditView />
          : <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
      default:
        return <DashboardView userRole={user.role} userName={user.name} onNavigate={setActiveView} />;
    }
  };


  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header
        userName={user.name}
        userEmail={user.email}
        userRole={user.role}
        onLogout={onLogout}
        onNavigate={setActiveView}
        onLogoNavigateHome={handleLogoNavigateHome}
      />
      <div className="flex flex-1">
        <Sidebar activeView={activeView} onViewChange={setActiveView} userRole={user.role} />
        <main className="flex-1 overflow-auto bg-muted/30 pb-16 text-foreground dark:bg-muted/10">
                  {renderView()}
                  {uploadState === "uploading" && activeView !== "upload" && (
                      <LoadingBar
                          uploadState={uploadState}
                          uploadProgress={uploadProgress} 
                          setShowCancelConfirm={setShowCancelConfirm}
                   />)}
        </main>
          </div>
              <Footer onNavigate={setActiveView} userRole={user.role} />
              {showCancelConfirm && (
                  <div className="fixed inset-0 z-[3000] flex items-center justify-center">
                      <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />

                      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("cancelScanTitle")}</h2>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              {t("cancelScanDescription")}
                          </p>

                          <div className="mt-6 flex justify-end gap-3">
                              <button
                                  type="button"
                                  onClick={() => setShowCancelConfirm(false)}
                                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-slate-700 hover:bg-gray-100 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-gray-700"
                              >
                                  {t("no")}
                              </button>
                              <button
                                  type="button"
                                  onClick={() => {
                                      abortControllerRef.current?.abort();
                                      setShowCancelConfirm(false);
                                  }}
                                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                              >
                                  {t("yes")}
                              </button>
                          </div>
                      </div>
                  </div>
          )}
          {<Notification/>}
    </div>
  );
}



