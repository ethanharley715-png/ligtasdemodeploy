import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { adminApi, type AuthSecurityAuditEventDto } from "../../services/api";
import { adminUserAnalyticsHref } from "../../utils/adminUserAnalytics";
import { useLanguage } from "../../context/useLanguage";

const OUTCOME_STYLES: Record<AuthSecurityAuditEventDto["outcome"], string> = {
  failed:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800",
  blocked:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-700",
  success:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700",
  viewed:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function SecurityAuditView() {
  const { t } = useLanguage();

  const EVENT_LABELS: Record<AuthSecurityAuditEventDto["eventType"], string> = {
    login_failed: t("failedSignIn"),
    login_lockout: t("lockoutTriggered"),
    login_captcha_required: t("captchaRequired"),
    login_success: t("successfulSignIn"),
    logout: t("logout"),
    audit_view_access: t("auditViewOpened"),
  };

  const [events, setEvents] = useState<AuthSecurityAuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.securityEvents();
      setEvents(response.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadSecurityAuditEvents"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const summary = useMemo(
    () =>
      events.reduce(
        (acc, event) => {
          acc.total += 1;
          if (event.eventType === "login_failed") acc.failed += 1;
          if (event.eventType === "login_lockout") acc.lockouts += 1;
          if (event.eventType === "login_captcha_required") acc.captcha += 1;
          if (event.eventType === "login_success") acc.success += 1;
          return acc;
        },
        { total: 0, failed: 0, lockouts: 0, captcha: 0, success: 0 },
      ),
    [events],
  );

  return (
    <div className="min-h-full bg-background px-6 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border-2 border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="ligtas-icon-tile-lg flex size-12 items-center justify-center rounded-xl">
                  <ShieldAlert className="size-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("adminOnly")}
                  </p>
                  <h1 className="text-3xl font-bold text-card-foreground">{t("securityAuditEvents")}</h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {t("securityAuditEventsDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadEvents()}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition hover:bg-muted"
            >
              <RefreshCcw className="size-4" />
              {t("refresh")}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{t("recentEvents")}</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{summary.total}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{t("failedSignIns")}</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{summary.failed}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{t("lockouts")}</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{summary.lockouts}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{t("captchaEscalations")}</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{summary.captcha}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border-2 border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-card-foreground">{t("recentEventStream")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("securityAuditMaskedIdentifiers")}
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">{t("loadingSecurityEvents")}</div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : events.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">
              {t("noSecurityEventsAvailable")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-4 px-6 py-4 lg:grid-cols-[180px_180px_140px_140px_minmax(0,1fr)]"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("time")}</p>
                    <p className="mt-1 text-sm font-medium text-card-foreground">
                      {formatTimestamp(event.occurredAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("event")}</p>
                    <p className="mt-1 text-sm font-medium text-card-foreground">
                      {EVENT_LABELS[event.eventType]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("outcome")}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${OUTCOME_STYLES[event.outcome]}`}
                    >
                      {event.outcome}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("actor")}</p>
                    <p className="mt-1 text-sm text-card-foreground">
                      {event.actorUserId != null ? (
                        <Link
                          to={adminUserAnalyticsHref(event.actorUserId)}
                          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {event.actorEmail ?? t("system")}
                        </Link>
                      ) : (
                        (event.actorEmail ?? t("system"))
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{event.actorRole ?? "n/a"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("detail")}</p>
                    <p className="text-sm text-card-foreground">{event.detail ?? t("noDetailProvided")}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t("target")}: {event.targetEmail ?? "n/a"}</span>
                      <span>{t("ip")}: {event.sourceIp ?? "n/a"}</span>
                      <span>{t("route")}: {event.route ?? "n/a"}</span>
                      {event.retryAfterSeconds != null && (
                        <span>{t("retryAfter")}: {event.retryAfterSeconds}s</span>
                      )}
                      {event.captchaRequired && <span>{t("captchaRequired")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}