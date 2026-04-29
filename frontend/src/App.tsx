import React, { useState, useEffect, useRef, useCallback } from "react";
import { Navigate, Route, Routes, useNavigate, Link, useSearchParams } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Lock, Mail } from "lucide-react";
import { Toaster } from "sonner";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ApiClientError, authApi } from "./services/api";
import { encryptObject } from "./Functions/encryptObject";
import UploadReportPage from "./pages/UploadReportPage";
import ReportDetailPage from "./pages/ReportDetailPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import { adminUserAnalyticsHref } from "./utils/adminUserAnalytics";
import AboutPage from "./pages/AboutPage";
import HelpPage from "./pages/HelpPage";
import { CookiesPage, PrivacyPage, TermsPage } from "./pages/LegalPage";
import "./App.css";
import { useIdleSessionLogout } from "./hooks/useIdleSessionLogout";
import {
  applyUserDisplayPreferencesToDocument,
  clearUserDisplayPreferencesFromDocument,
  USER_DISPLAY_PREFS_CHANGED,
} from "./utils/userDisplayPreferences";
import { useLanguage } from "./context/useLanguage";
import axios from "axios";

const PEM_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiWXfGjq9yxl+3VtjKTaB
Vyzt79HsQJIvMzS6qEa5u0LbzsbU6CEngxk+8aM+bvgSlUemwwfauDwv687jQqJh
4MUjr0C/G7klEHw0kjV9snSX4B7ywtEowO0wslUqaqlxXnKMIkO5YErukqK1v7zD
zB3JrTkvNsRIJ+7nBtsKlzSrbbYQNAeO8QoKzKQkaB1ZFtI9VMMYCoFa7LRG55fh
1vCVKdT7+Ix5KrZIIohAT/UeF3w/+R3WODfOIEGSVlC0V3S9z/Q4WHhGLzeDCmF8
lhcrQc6sESt6iOGUTzM9TCCCsXnbORHzqcDjnTsTu6pzyFHPqfw/r0lK/hwif0Ef
dQIDAQAB
-----END PUBLIC KEY-----
`;

const TURNSTILE_SITE_KEY = import.meta.env.VITE_LOGIN_TURNSTILE_SITE_KEY ?? "";
const SHOW_DEMO_LOGIN_HINTS =
  import.meta.env.DEV || String(import.meta.env.VITE_SHOW_DEMO_LOGIN_HINTS ?? "").toLowerCase() === "true";

let currentUserId: number = -1;
const qrCode = "";

async function verifyMfa(userId: number, token: string) {
    const res = await axios.post(
        "http://localhost:4000/api/logins/mfa/verify",
        {
            userId,
            token,
        },
        {
            withCredentials: true, // important if you're setting JWT cookies
        }
    );

    console.log(res.data);
    return res.data;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type AppUser = {
  name: string;
  email: string;
  role: "admin" | "team_manager" | "consultant";
};

/** `/admin/reports?userId=` → `/admin/users/{id}/analytics` for backwards compatibility (AC4). */
function AdminReportsLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  if (userId != null && userId !== "") {
    return <Navigate to={adminUserAnalyticsHref(userId)} replace />;
  }
  return <AdminReportsPage />;
}

function App() {
  const { t } = useLanguage();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sonnerTheme, setSonnerTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    authApi
      .me()
      .then((data) => {
        const roleMap: Record<string, "admin" | "team_manager" | "consultant"> = {
          admin: "admin",
          team_manager: "team_manager",
          consultant: "consultant",
        };

        setUser({
          name: data.name || data.email,
          email: data.email,
          role: roleMap[data.role] ?? "consultant",
        });
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  useIdleSessionLogout(handleLogout, !!user);

  useEffect(() => {
    if (user?.email) {
      applyUserDisplayPreferencesToDocument(user.email);
    } else {
      clearUserDisplayPreferencesFromDocument();
    }
  }, [user?.email]);

  useEffect(() => {
    const syncSonnerTheme = () => {
      setSonnerTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    syncSonnerTheme();
    window.addEventListener(USER_DISPLAY_PREFS_CHANGED, syncSonnerTheme);
    const observer = new MutationObserver(syncSonnerTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener(USER_DISPLAY_PREFS_CHANGED, syncSonnerTheme);
      observer.disconnect();
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" theme={sonnerTheme} richColors closeButton />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage setUser={setUser} />}
        />
        <Route path="/mfa" element={user ? <Navigate to="/" replace /> : <MfaPage setUser={setUser} />} />
        <Route path="/qr" element={user ? <Navigate to="/" replace /> : <QrPage/>} />
        <Route
          path="/forgot-password"
          element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/about" element={<AboutPage isAuthenticated={Boolean(user)} />} />
        <Route path="/help" element={<HelpPage isAuthenticated={Boolean(user)} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route
          path="/"
          element={
            user ? (
              <DashboardLayout user={user} onLogout={handleLogout} onUserUpdate={setUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/upload" element={user ? <UploadReportPage /> : <Navigate to="/login" replace />} />
        <Route path="/rules" element={<RuleCheckPage />} />
        <Route
          path="/reports"
          element={
            user ? (
              <DashboardLayout
                user={user}
                onLogout={handleLogout}
                onUserUpdate={setUser}
                initialView="history"
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/reports/:id" element={user ? <ReportDetailPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/admin/reports"
          element={user ? <AdminReportsLegacyRedirect /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/users/:userId/analytics"
          element={user ? <AdminReportsPage /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </>
  );
}

function AuthSupportLinks() {
  return (
    <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
      <Link to="/about" className="font-medium transition-colors hover:text-black">
        About
      </Link>
      <span aria-hidden="true" className="text-gray-300">
        /
      </span>
      <Link to="/help" className="font-medium transition-colors hover:text-black">
        Help Center
      </Link>
    </div>
  );
}

function MfaPage({
    setUser,
}: {
    setUser: (u: { name: string; email: string; role: "admin" | "team_manager" | "consultant" }) => void;
}) {
    const navigate = useNavigate();
    const [values, setValues] = useState<string[]>(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    const handleChange = (index: number, value: string) => {
        if (!/^\d?$/.test(value)) return;

        const newValues = [...values];
        newValues[index] = value;
        setValues(newValues);

        if (value && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !values[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const paste = e.clipboardData.getData("text").trim();
        if (!/^\d{6}$/.test(paste)) return;

        const newValues = paste.split("");
        setValues(newValues);
        inputsRef.current[5]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = values.join("");

        if (code.length !== 6) {
            setError("Please enter the 6-digit code.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            console.log(currentUserId);
            console.log(code)
            verifyMfa(currentUserId, code);
            await new Promise((r) => setTimeout(r, 1500));

            const me = await authApi.me();

            const roleMap: Record<string, "admin" | "team_manager" | "consultant"> = {
                admin: "admin",
                team_manager: "team_manager",
                consultant: "consultant",
            };

            setUser({
                name: me.name || me.email,
                email: me.email,
                role: roleMap[me.role?.toLowerCase() ?? ""] ?? "consultant",
            });

            navigate("/", { replace: true });
        } catch {
            setError("Invalid or expired code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-white items-center justify-center px-6 py-8">
            <div className="w-full max-w-[440px] rounded-2xl border-2 border-gray-200 bg-white shadow-sm p-8">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="h-20 w-20 flex items-center justify-center bg-black rounded-lg overflow-hidden mb-4">
                        <img
                            src="/ligtas-logo.png"
                            alt="Logo"
                            className="w-full h-full object-cover invert"
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-black mb-1">
                        Multi-Factor Authentication
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Enter the 6-digit code from your authenticator app
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div
                        className="flex justify-between gap-2"
                        onPaste={handlePaste}
                    >
                        {values.map((val, i) => (
                            <input
                                key={i}
                                ref={(el) => (inputsRef.current[i] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={val}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                className="w-12 h-14 text-center text-xl font-bold rounded-[10px] border-2 border-gray-300 bg-gray-50 focus:border-black focus:outline-none"
                            />
                        ))}
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 font-medium text-center">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-[10px] bg-black py-3 text-white font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function QrPage() {

    const navigate = useNavigate();
    //const base64Image = "data:image/png;base64,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";

    const handleSubmit = async () => {
        navigate("/mfa", { replace: true });
    };


    return (
        <div className="flex min-h-screen w-full bg-white items-center justify-center px-6 py-8">
            <div className="w-full max-w-[440px] rounded-2xl border-2 border-gray-200 bg-white shadow-sm p-8">
                <div className="flex flex-col items-center text-center mb-1">
                    <div className="h-20 w-20 flex items-center justify-center bg-black rounded-lg overflow-hidden mb-4">
                        <img
                            src="/ligtas-logo.png"
                            alt="Logo"
                            className="w-full h-full object-cover invert"
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-black mb-1">
                        QR registration
                    </h1>
                    <p className="text-gray-500 text-sm mb-2">
                        Read the following QR code to register the MFA in your microsoft or google authenticator app.
                    </p>
                    <p className="text-gray-500 text-sm">
                        <b>Warning: This QR will not be shown again.</b>
                    </p>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                    <div className="flex justify-center">
                        <img
                            src={qrCode}
                            alt="Generated"
                            style={{ width: 200, height: 200 }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-[10px] bg-black py-3 text-white font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
}

export function LoginPage({
  setUser,
}: {
  setUser?: (u: { name: string; email: string; role: "admin" | "team_manager" | "consultant" }) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaContainerRef = React.useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!retryAfterSeconds || retryAfterSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSeconds((value) => {
        if (value == null || value <= 1) {
          window.clearInterval(timer);
          return null;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (!captchaRequired || !TURNSTILE_SITE_KEY) {
      if (captchaWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(captchaWidgetIdRef.current);
        captchaWidgetIdRef.current = null;
      }
      if (captchaContainerRef.current) {
        captchaContainerRef.current.innerHTML = "";
      }
      return;
    }

    let cancelled = false;
    const scriptId = "login-turnstile-script";

    const renderWidget = () => {
      if (
        cancelled ||
        !captchaRequired ||
        !TURNSTILE_SITE_KEY ||
        !captchaContainerRef.current ||
        !window.turnstile
      ) {
        return;
      }

      if (captchaWidgetIdRef.current) {
        window.turnstile.reset(captchaWidgetIdRef.current);
        return;
      }

      captchaWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        renderWidget();
      } else {
        existingScript.addEventListener("load", renderWidget, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.loaded = "false";
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          renderWidget();
        },
        { once: true },
      );
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [captchaRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setRetryAfterSeconds(null);
    const emailVal = email.trim().toLowerCase();

    try {
      const payload = {
        email: emailVal,
        password,
        nonce: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        timestamp: Math.floor(Date.now() / 1000),
      };

      const encryptedPayload = await encryptObject(payload, PEM_PUBLIC_KEY);
      const answer = await authApi.loginEncrypted(encryptedPayload, {
        captchaToken: captchaToken || undefined,
      });
      console.log(answer)

      if (answer.mfaRequired) {
          currentUserId = answer.userId;
          navigate("/mfa", { replace: true });
      }
      else {
          const roleMap: Record<string, "admin" | "team_manager" | "consultant"> = {
            adm: "admin",
            admin: "admin",
            tm: "team_manager",
            team_manager: "team_manager",
            usr: "consultant",
            consultant: "consultant",
          };

          setUser?.({
            name: answer.email,
            email: answer.email,
            role: roleMap[String(answer.userType ?? "").toLowerCase()] ?? "consultant",
          });
          setCaptchaRequired(false);
          setCaptchaToken("");
          navigate("/", { replace: true });
      }

      /*const me = await authApi.me();
      const roleMap: Record<string, "admin" | "team_manager" | "consultant"> = {
        admin: "admin",
        team_manager: "team_manager",
        consultant: "consultant",
      };

      setUser({
        name: me.name || me.email,
        email: me.email,
        role: roleMap[me.role?.toLowerCase() ?? ""] ?? "consultant",
      });

      setCaptchaRequired(false);
      setCaptchaToken("");
      navigate("/", { replace: true });*/
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
        setRetryAfterSeconds(e.retryAfterSeconds ?? null);
        setCaptchaRequired(Boolean(e.captchaRequired));
        if (!e.captchaRequired) {
          setCaptchaToken("");
        }
      } else {
        setError(e instanceof Error ? e.message : t("loginFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex md:flex-1 md:flex-col md:bg-black md:px-10 md:py-8 md:justify-between">
        <div>
          <div className="flex items-center gap-3 pb-11">
            <div className="h-16 w-16 flex items-center justify-center bg-white rounded-lg overflow-hidden">
              <img src="/ligtas-logo.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <div>
              <p className="text-white text-2xl font-bold">Ligtas QC</p>
              <p className="text-gray-400 text-sm">{t("qualityControlSystem")}</p>
            </div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight max-w-md mb-4">
            {t("automatedQualityControlTitle")}
          </h2>
          <p className="text-gray-400 text-lg max-w-md">
            {t("automatedQualityControlDescription")}
          </p>
        </div>
        <div className="flex flex-col gap-3 max-w-xl">
          <div className="border border-gray-800 rounded-lg bg-white/5 p-4 flex gap-3 items-center">
            <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div>
              <p className="text-white font-semibold">{t("enterpriseSecurity")}</p>
              <p className="text-gray-400 text-sm">{t("enterpriseSecurityDescription")}</p>
            </div>
          </div>
          <div className="border border-gray-800 rounded-lg bg-white/5 p-4 flex gap-3 items-center">
            <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div>
              <p className="text-white font-semibold">{t("thirtySecondAnalysis")}</p>
              <p className="text-gray-400 text-sm">{t("thirtySecondAnalysisDescription")}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-8">
        <div className="w-full max-w-[440px] rounded-2xl border-2 border-border bg-card p-8 text-card-foreground shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-black dark:bg-white">
              <img
                src="/ligtas-logo.png"
                alt=""
                className="h-full w-full object-cover invert dark:invert-0"
              />
            </div>
            <h1 className="mb-1 text-2xl font-bold text-card-foreground">{t("ligtasQcSystem")}</h1>
            <p className="text-sm text-muted-foreground">{t("qualityControlForSectors")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-bold text-card-foreground">
                {t("emailAddress")}
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-[10px] border-2 border-input bg-input-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder={t("emailPlaceholder")}
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-bold text-card-foreground">
                {t("password")}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-[10px] border-2 border-input bg-input-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder={t("passwordPlaceholder")}
                required
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            {retryAfterSeconds != null && retryAfterSeconds > 0 && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t("tryAgainIn")} {Math.ceil(retryAfterSeconds / 60)} {t("minute")}
                {retryAfterSeconds >= 120 ? t("pluralSuffix") : ""}.
              </p>
            )}
            {captchaRequired && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("additionalVerificationRequired")}</p>
                {TURNSTILE_SITE_KEY ? (
                  <div ref={captchaContainerRef} />
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{t("captchaMissingSiteKey")}</p>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || (captchaRequired && Boolean(TURNSTILE_SITE_KEY) && !captchaToken)}
              className="w-full rounded-[10px] bg-primary py-3 text-base font-bold text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t("signingIn") : t("signIn")}
            </button>
            <p className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm font-bold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </p>
            <AuthSupportLinks />
          </form>

          {SHOW_DEMO_LOGIN_HINTS && (
            <>
              <div className="my-6 border-t border-border" />
              <div className="space-y-4">
                <div className="text-center">
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t("localDemoCredentials")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("developmentDemoAccountsOnly")}</p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-sm font-semibold text-card-foreground">{t("adminAccount")}</p>
                    <p className="text-sm text-muted-foreground">admin@ligtas.com / admin123</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-sm font-semibold text-card-foreground">{t("teamManagerAccount")}</p>
                    <p className="text-sm text-muted-foreground">teammanager@ligtas.com / admin123</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-sm font-semibold text-card-foreground">{t("consultantAccount")}</p>
                    <p className="text-sm text-muted-foreground">consultant@ligtas.com / admin123</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex md:w-1/3 md:flex-col md:bg-black md:px-10 md:py-8 md:justify-center">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-12 w-12 flex items-center justify-center bg-white rounded-lg overflow-hidden">
              <img src="/ligtas-logo.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <div>
              <p className="text-white text-xl font-bold">Ligtas QC</p>
              <p className="text-gray-400 text-sm">{t("qualityControlSystem")}</p>
            </div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-4">
            {t("secureAccountRecovery")}
          </h2>
          <p className="text-gray-400 text-base">
            {t("secureAccountRecoveryDescription")}
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-8">
        <div className="w-full max-w-md text-foreground">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mb-6 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("backToLogin")}
          </button>
          <h1 className="mb-2 text-3xl font-bold text-foreground">{t("forgotPasswordTitle")}</h1>
          <p className="mb-6 text-base text-muted-foreground">{t("forgotPasswordSubtitle")}</p>
          {sent ? (
            <div className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-card-foreground">
              {t("resetLinkNotice")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("emailAddress")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border-2 border-input bg-input-background py-2.5 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    placeholder={t("forgotEmailPlaceholder")}
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t("sending") : t("sendResetLink")}
              </button>
            </form>
          )}
          <div className="mt-6 rounded-lg border border-border bg-muted/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{t("securityNote")}</span> {t("resetLinkNotice")}
            </p>
          </div>
          <div className="mt-5">
            <AuthSupportLinks />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [phase, setPhase] = useState<"loading" | "invalid" | "ready" | "success">("loading");
  const [validateMessage, setValidateMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      setValidateMessage(t("resetPasswordInvalidOrMissingToken"));
      return;
    }

    let cancelled = false;
    setPhase("loading");
    authApi
      .validateResetToken(token)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setPhase("ready");
          setValidateMessage("");
        } else {
          setPhase("invalid");
          setValidateMessage(res.message ?? t("resetPasswordInvalidOrMissingToken"));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPhase("invalid");
        setValidateMessage(t("requestFailed"));
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!token) return;
    setSubmitting(true);
    try {
      await authApi.resetPasswordWithToken(token, newPassword, confirmPassword);
      setPhase("success");
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : t("requestFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex md:w-1/3 md:flex-col md:bg-black md:px-10 md:py-8 md:justify-center">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-12 w-12 flex items-center justify-center bg-white rounded-lg overflow-hidden">
              <img src="/ligtas-logo.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <div>
              <p className="text-white text-xl font-bold">{t("resetPasswordBrandTitle")}</p>
              <p className="text-gray-400 text-sm">{t("resetPasswordBrandSubtitle")}</p>
            </div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-4">{t("resetPasswordAsideHeading")}</h2>
          <p className="text-gray-400 text-base">{t("resetPasswordAsideDescription")}</p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-8">
        <div className="w-full max-w-md text-foreground">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mb-6 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("backToLogin")}
          </button>
          <h1 className="mb-2 text-3xl font-bold text-foreground">{t("resetPasswordTitle")}</h1>

          {phase === "loading" && (
            <p className="text-base text-muted-foreground">{t("resetPasswordValidateLoading")}</p>
          )}

          {phase === "invalid" && <p className="text-base text-muted-foreground">{validateMessage}</p>}

          {phase === "ready" && (
            <form onSubmit={handleResetSubmit} className="mt-4 space-y-4">
              <p className="mb-2 text-sm text-muted-foreground">{t("resetPasswordChooseNew")}</p>
              <div>
                <label htmlFor="reset-new-password" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("newPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="reset-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border-2 border-input bg-input-background py-2.5 pl-10 pr-3 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("confirmNewPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border-2 border-input bg-input-background py-2.5 pl-10 pr-3 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("saving") : t("resetPasswordSubmitButton")}
              </button>
            </form>
          )}

          {phase === "success" && (
            <div className="mt-4 space-y-4">
              <p className="font-medium text-foreground">{t("resetPasswordSuccessTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("resetPasswordSuccessBody")}</p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t("resetPasswordGoLogin")}
              </button>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-border bg-muted/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{t("securityNote")}</span>{" "}
              {t("resetPasswordSecurityFooter")}
            </p>
          </div>
          <div className="mt-5">
            <AuthSupportLinks />
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleCheckPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Rule checks</h1>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
              MVP · Node rule engine
            </span>
          </div>
          <RuleCheckDialog />
        </section>
      </main>
    </div>
  );
}

function RuleCheckDialog() {
  return (
    <Transition.Root show as={React.Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => {}}>
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-amber-500/10 p-2">
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <Dialog.Title className="text-base font-semibold">Rule engine placeholder</Dialog.Title>
                  <Dialog.Description className="text-sm text-slate-300">
                    POST <code>/api/rules/check</code> is available on the backend.
                  </Dialog.Description>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export default App;
