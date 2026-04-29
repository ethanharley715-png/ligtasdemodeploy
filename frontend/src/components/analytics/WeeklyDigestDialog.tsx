import { Dialog, Transition } from "@headlessui/react";
import { Calendar, Download, FileSpreadsheet, FileText, Mail, X } from "lucide-react";
import { Fragment, useMemo } from "react";
import type { ComponentType } from "react";
import type { ReportExportFormat } from "../../services/api";
import { openComposeUrl, type EmailComposeTarget } from "../../utils/emailCompose";
import { describeWeekRange, weekValueToWeekStartIso } from "../../utils/weeklyDigestWeek";

type WeeklyDigestDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedWeek: string;
  onSelectedWeekChange: (value: string) => void;
  consultantLabel: string;
  issueTypeLabel: string;
  loadingFormat: ReportExportFormat | null;
  onExport: (format: ReportExportFormat) => Promise<void>;
};

const exportOptions: Array<{
  format: ReportExportFormat;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    format: "csv",
    title: "CSV export",
    description: "Machine-readable weekly digest sections for audit, review, and handover.",
    icon: FileSpreadsheet,
  },
  {
    format: "pdf",
    title: "PDF export",
    description: "Portable weekly consultant digest with summary metrics and supporting breakdowns.",
    icon: FileText,
  },
];

export function WeeklyDigestDialog({
  open,
  onClose,
  selectedWeek,
  onSelectedWeekChange,
  consultantLabel,
  issueTypeLabel,
  loadingFormat,
  onExport,
}: WeeklyDigestDialogProps) {
  const selectedWeekLabel = useMemo(() => describeWeekRange(selectedWeek), [selectedWeek]);
  const isBusy = Boolean(loadingFormat);

  function handleOpenCompose(target: EmailComposeTarget) {
    openComposeUrl(target, {
      subject: `Weekly QC digest for ${selectedWeekLabel ?? selectedWeek}`,
      body: [
        `Please review the weekly QC digest for ${selectedWeekLabel ?? selectedWeek}.`,
        "",
        `Consultant filter: ${consultantLabel}`,
        `Issue category filter: ${issueTypeLabel}`,
        "",
        "If you need to include the digest attachment, download the CSV or PDF first and attach it manually.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    });
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => (isBusy ? null : onClose())}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
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
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-950">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-2xl font-bold text-black dark:text-white">
                      Weekly digest
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Generate or share an admin weekly QC digest for the selected calendar week.
                    </Dialog.Description>
                    {selectedWeekLabel && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Selected week:{" "}
                        <span className="font-medium text-black dark:text-white">{selectedWeekLabel}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    aria-label="Close weekly digest dialog"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-3 dark:border-gray-700 dark:bg-gray-900">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span className="mb-2 flex items-center gap-2">
                      <Calendar className="size-4 text-gray-500 dark:text-gray-400" />
                      Calendar week
                    </span>
                    <input
                      type="week"
                      value={selectedWeek}
                      onChange={(event) => onSelectedWeekChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-black focus:outline-none dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                    />
                  </label>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">Current consultant filter</p>
                    <p className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                      {consultantLabel}
                    </p>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                      Current issue category filter
                    </p>
                    <p className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                      {issueTypeLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {exportOptions.map((option) => {
                    const Icon = option.icon;
                    const isLoading = loadingFormat === option.format;

                    return (
                      <button
                        key={option.format}
                        type="button"
                        onClick={() => void onExport(option.format)}
                        disabled={isBusy || !weekValueToWeekStartIso(selectedWeek)}
                        className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                      >
                        <div className="mb-4 inline-flex rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
                          <Icon className="size-5" />
                        </div>
                        <p className="text-lg font-semibold text-black dark:text-white">{option.title}</p>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
                          <Download className="size-4" />
                          {isLoading
                            ? "Generating digest..."
                            : `Download ${option.format.toUpperCase()}`}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-black dark:text-white">Email shortcuts</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Open a draft and attach the downloaded digest manually.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("default")}
                      disabled={isBusy || !weekValueToWeekStartIso(selectedWeek)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Open email app
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("gmail")}
                      disabled={isBusy || !weekValueToWeekStartIso(selectedWeek)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Open Gmail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("outlook")}
                      disabled={isBusy || !weekValueToWeekStartIso(selectedWeek)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Open Outlook Web
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
