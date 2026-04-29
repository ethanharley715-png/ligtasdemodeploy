import { IssueFalsePositiveFlag, IssueReviewControls } from "./reports/IssueReviewControls";
import { formatIssueReviewStatus, issueReviewStatusClasses, type IssueReviewStatus } from "./reports/issueReviewStatus";
import type { ReactNode } from "react";

type Issue = {
  id: string;
  type: string;
  description: string;
  location: string;
  context: string;
  suggestion: string;
  pageNumber: number | null;
  reviewStatus: IssueReviewStatus;
  reviewedAt: string | null;
};

type Props = {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  selectedIssueId?: string | null;
  onChangeIssueReviewStatus?: (issueId: string, status: IssueReviewStatus) => void;
  busyIssueId?: string | null;
};

function formatIssueType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const DEFAULT_SUGGESTIONS: Record<string, string> = {
  TEMPLATE_ARTIFACT: "Replace placeholder or template text with the correct final report content.",
  UNREMOVED_GUIDANCE: "Remove drafting guidance or instructional text before finalizing the report.",
  MISSING_INFORMATION: "Add the missing report details so the section is complete and verifiable.",
  CONTRADICTION: "Resolve the conflicting statements so the report is internally consistent.",
  LIMITATION_CONTRADICTION: "Clarify the limitation and align it with the rest of the report content.",
  INCOMPLETE_LIMITATIONS: "Complete the limitations section with clear scope, exclusions, or constraints.",
};

function normalizeIssueTypeKey(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function formatIssueLocation(location: string) {
  const trimmedLocation = location?.trim() ?? "";

  if (!trimmedLocation) {
    return "Unknown location";
  }

  return trimmedLocation.replace(/^Page\s+\d+\s*-\s*/i, "").trim() || "Unknown location";
}

function isMissingSuggestion(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["", "n/a", "na", "none", "no suggestion", "no suggestion available"].includes(normalized);
}

function getSuggestedFix(issue: Issue) {
  const trimmedSuggestion = issue.suggestion?.trim();
  if (trimmedSuggestion && !isMissingSuggestion(trimmedSuggestion)) {
    return trimmedSuggestion;
  }

  return DEFAULT_SUGGESTIONS[normalizeIssueTypeKey(issue.type)] ?? "No suggestion available.";
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="mt-1.5 text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

export default function IssueList({
  issues,
  selectedIssueId,
  onChangeIssueReviewStatus,
  busyIssueId,
}: Props) {
  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <p className="text-sm text-gray-600 dark:text-gray-400">No issues match the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {issues.map((issue, index) => (
        <article
          key={issue.id}
          className={`rounded-xl border bg-white p-5 shadow-sm transition dark:bg-gray-900 ${
            selectedIssueId === issue.id
              ? "border-black ring-2 ring-black/10 dark:border-white dark:ring-white/20"
              : "border-gray-200 hover:shadow-md dark:border-gray-700 dark:hover:shadow-lg"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {formatIssueType(issue.type)}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${issueReviewStatusClasses(issue.reviewStatus)}`}>
                  {formatIssueReviewStatus(issue.reviewStatus)}
                </span>

              </div>

              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                Issue {index + 1}
              </h3>
              {issue.reviewedAt ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Reviewed {new Date(issue.reviewedAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            <IssueFalsePositiveFlag
              status={issue.reviewStatus}
              busy={busyIssueId === issue.id}
              onChangeStatus={
                onChangeIssueReviewStatus
                  ? (status) => onChangeIssueReviewStatus(issue.id, status)
                  : undefined
              }
            />
          </div>

          <div className="mt-5 grid gap-5">
            <DetailSection label="Review status">
              <IssueReviewControls
                status={issue.reviewStatus}
                busy={busyIssueId === issue.id}
                onChangeStatus={
                  onChangeIssueReviewStatus
                    ? (status) => onChangeIssueReviewStatus(issue.id, status)
                    : undefined
                }
              />
            </DetailSection>

            <DetailSection label="Location">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                {formatIssueLocation(issue.location)}
              </div>
            </DetailSection>

            <DetailSection label="Triggered text">
              <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                {issue.context || "No triggering text available."}
              </div>
            </DetailSection>

            <DetailSection label="Suggested fix">
              <p className="leading-6 text-gray-700 dark:text-gray-300">
                {getSuggestedFix(issue)}
              </p>
            </DetailSection>
          </div>
        </article>
      ))}
    </div>
  );
}

