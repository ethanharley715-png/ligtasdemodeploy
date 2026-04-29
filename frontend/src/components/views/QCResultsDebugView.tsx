import { useState } from "react";
import { sessionQcApi, type SessionQcResult } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

export function QCResultsDebugView() {
  const { t } = useLanguage();
  const [reportSessionId, setReportSessionId] = useState("");
  const [loadingAction, setLoadingAction] = useState<"analyze-ai" | "analyze-rules" | "fetch" | null>(null);
  const [disableHeavyReplay, setDisableHeavyReplay] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SessionQcResult | null>(null);

  async function runAnalyze(scanMode: "ai" | "rules") {
    if (!reportSessionId.trim()) {
      setError(t("reportSessionIdRequired"));
      return;
    }

    setLoadingAction(scanMode === "ai" ? "analyze-ai" : "analyze-rules");
    setError("");
    try {
      const response = await sessionQcApi.analyze(
        reportSessionId.trim(),
        scanMode,
        undefined,
        scanMode === "ai" && disableHeavyReplay ? { aiLocationMode: "canonical_only" } : undefined,
      );
      setResult(response);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function fetchResults() {
    if (!reportSessionId.trim()) {
      setError(t("reportSessionIdRequired"));
      return;
    }

    setLoadingAction("fetch");
    setError("");
    try {
      const response = await sessionQcApi.getResults(reportSessionId.trim());
      setResult(response);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoadingAction(null);
    }
  }
  return (
    <div className="min-h-full p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black dark:text-white">{t("qcApiDebug")}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("qcApiDebugDescription")}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <label htmlFor="session-id-input" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("reportSessionId")}
        </label>
        <input
          id="session-id-input"
          type="text"
          value={reportSessionId}
          onChange={(event) => setReportSessionId(event.target.value)}
          placeholder={t("pasteReportSessionId")}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <label className="mt-4 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={disableHeavyReplay}
            onChange={(event) => {
              setDisableHeavyReplay(event.target.checked);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:border-gray-600"
          />
          <span>
            Disable heavy AI location replay
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              AI debug runs keep canonical section names only and skip aggressive page/section remapping.
            </span>
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void runAnalyze("ai")}
            disabled={loadingAction !== null}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loadingAction === "analyze-ai" ? t("analyzing") : t("analyzeSessionAi")}
          </button>
          <button
            type="button"
            onClick={() => void runAnalyze("rules")}
            disabled={loadingAction !== null}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {loadingAction === "analyze-rules" ? t("analyzing") : t("analyzeSessionRules")}
          </button>
          <button
            type="button"
            onClick={fetchResults}
            disabled={loadingAction !== null}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {loadingAction === "fetch" ? t("fetching") : t("fetchResults")}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("summary")}</h2>
            <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t("sessionId")}</dt>
                <dd className="break-all text-right text-gray-900 dark:text-gray-100">{result.reportSessionId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t("reportId")}</dt>
                <dd className="text-right text-gray-900 dark:text-gray-100">{result.reportId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t("status")}</dt>
                <dd className="text-right text-gray-900 dark:text-gray-100">{result.analysisStatus}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t("scanSource")}</dt>
                <dd className="text-right text-gray-900 dark:text-gray-100">{result.scanSource ?? t("unknown")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t("totalIssues")}</dt>
                <dd className="text-right text-gray-900 dark:text-gray-100">{result.summary.totalIssues}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("issues")}</h2>
            {result.issues.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("noIssuesDetected")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {result.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-600 dark:bg-gray-800/50"
                  >
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {t("section")}: {issue.section ?? issue.location.section ?? t("unknown")} | {t("page")}: {issue.location.page ?? t("unknown")}
                    </p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {t("anchor")}: {issue.anchor.mode}
                      {issue.anchor.startPage != null
                        ? ` | ${t("pages")}: ${issue.anchor.startPage}${
                            issue.anchor.endPage != null && issue.anchor.endPage !== issue.anchor.startPage
                              ? `-${issue.anchor.endPage}`
                              : ""
                          }`
                        : ""}
                    </p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">{t("rule")}: {issue.ruleKey ?? "n/a"}</p>
                    <p className="mt-1 text-gray-700 dark:text-gray-300">{issue.message}</p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">{t("suggestion")}: {issue.suggestion}</p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">{t("context")}: {issue.context}</p>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {t("targetText")}: {issue.anchor.targetText ?? "n/a"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("rawJson")}</h2>
            <pre className="mt-3 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
