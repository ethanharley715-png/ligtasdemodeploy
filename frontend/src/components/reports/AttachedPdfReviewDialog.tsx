import { Dialog, Transition } from "@headlessui/react";
import { Expand, X } from "lucide-react";
import { Fragment } from "react";

import AttachedPdfReviewPanel, { type AttachedPdfReviewIssue } from "./AttachedPdfReviewPanel";
import type { IssueReviewStatus } from "./issueReviewStatus";

type Props = {
  open: boolean;
  onClose: () => void;
  issues: AttachedPdfReviewIssue[];
  selectedIssueId?: string | null;
  onSelectIssue?: (issue: AttachedPdfReviewIssue) => void;
  onFocusPage?: (page: number) => void;
  onChangeIssueReviewStatus?: (issueId: string, status: IssueReviewStatus) => void;
  busyIssueId?: string | null;
};

export function AttachedPdfReviewDialog({
  open,
  onClose,
  issues,
  selectedIssueId,
  onSelectIssue,
  onFocusPage,
  onChangeIssueReviewStatus,
  busyIssueId,
}: Props) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="flex h-[92vh] w-full max-w-[min(96rem,96vw)] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950">
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                      <Expand className="size-3.5" />
                      PDF Review
                    </div>
                    <Dialog.Title className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                      Review attached PDF against QC issues
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                      Attach the report PDF, inspect issue placement, and move through pages without leaving the QC results screen.
                    </Dialog.Description>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    aria-label="Close PDF review"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
                  <AttachedPdfReviewPanel
                    issues={issues}
                    selectedIssueId={selectedIssueId}
                    onSelectIssue={onSelectIssue}
                    onFocusPage={onFocusPage}
                    onChangeIssueReviewStatus={onChangeIssueReviewStatus}
                    busyIssueId={busyIssueId}
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
