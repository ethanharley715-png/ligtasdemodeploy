import { Flag } from "lucide-react";
import type { IssueReviewStatus } from "./issueReviewStatus";

type IssueReviewControlsProps = {
  status: IssueReviewStatus;
  busy?: boolean;
  onChangeStatus?: (status: IssueReviewStatus) => void;
};

type IssueFalsePositiveFlagProps = {
  status: IssueReviewStatus;
  busy?: boolean;
  onChangeStatus?: (status: IssueReviewStatus) => void;
  className?: string;
};

export function IssueFalsePositiveFlag({
  status,
  busy = false,
  onChangeStatus,
  className = "",
}: IssueFalsePositiveFlagProps) {
  if (!onChangeStatus) {
    return null;
  }

  const isFlagged = status === "FALSE_POSITIVE";
  const label = isFlagged ? "Remove false positive flag" : "Flag as false positive";
  const nextStatus: IssueReviewStatus = isFlagged ? "OPEN" : "FALSE_POSITIVE";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isFlagged}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onChangeStatus(nextStatus);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      className={`inline-flex size-9 items-center justify-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        isFlagged
          ? "border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-700 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-950"
          : "border-red-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:border-red-700 dark:hover:bg-red-950/40"
      } ${className}`}
    >
      <Flag className={isFlagged ? "size-4 fill-current" : "size-4"} aria-hidden />
    </button>
  );
}

export function IssueReviewControls({
  status,
  busy = false,
  onChangeStatus,
}: IssueReviewControlsProps) {
  if (!onChangeStatus) {
    return null;
  }

  if (status === "OPEN") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onChangeStatus("COMPLETED");
          }}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
        >
          Mark complete
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus("OPEN");
        }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        Reopen
      </button>
    </div>
  );
}
