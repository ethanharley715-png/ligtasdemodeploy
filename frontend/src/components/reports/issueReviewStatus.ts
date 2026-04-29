export type IssueReviewStatus = "OPEN" | "COMPLETED" | "FALSE_POSITIVE";

export function issueReviewStatusClasses(status: IssueReviewStatus) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "FALSE_POSITIVE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";
  }
}

export function formatIssueReviewStatus(status: IssueReviewStatus) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "FALSE_POSITIVE":
      return "False positive";
    default:
      return "Open";
  }
}
