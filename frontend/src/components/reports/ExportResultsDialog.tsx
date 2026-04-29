import { Dialog, Transition } from "@headlessui/react";
import { Download, FileSpreadsheet, FileText, FileUp, Mail, ShieldCheck, X } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { ReportExportFormat } from "../../services/api";
import { openComposeUrl, type EmailComposeTarget } from "../../utils/emailCompose";

interface ExportResultsDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ReportExportFormat) => Promise<void>;
  reportId: string;
  fileName: string;
  isExportable: boolean;
  loadingFormat: ReportExportFormat | null;
  loadingAnnotatedExport: boolean;
  onAnnotatedPdfExport: (sourcePdf: File) => Promise<void>;
}

const exportOptions: Array<{
  format: ReportExportFormat;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    format: "csv",
    title: "CSV export",
    description: "Structured issue rows for spreadsheet review and evidence tracking.",
    icon: FileSpreadsheet,
  },
  {
    format: "pdf",
    title: "PDF export",
    description: "Portable consultant summary with report metadata, statistics, and issue detail.",
    icon: FileText,
  },
];

export function ExportResultsDialog({
  open,
  onClose,
  onExport,
  reportId,
  fileName,
  isExportable,
  loadingFormat,
  loadingAnnotatedExport,
  onAnnotatedPdfExport,
}: ExportResultsDialogProps) {
  const sourcePdfInputRef = useRef<HTMLInputElement | null>(null);
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);
  const [sourcePdfError, setSourcePdfError] = useState<string | null>(null);
  const exportBusy = Boolean(loadingFormat) || loadingAnnotatedExport;

  function handleSourcePdf(file: File | null) {
    setSourcePdfError(null);

    if (!file) {
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setSourcePdf(null);
      setSourcePdfError("Choose a PDF file to create an annotated PDF.");
      return;
    }

    setSourcePdf(file);
  }

  function handleOpenCompose(target: EmailComposeTarget) {
    openComposeUrl(target, {
      subject: `QC results export for report ${reportId}`,
      body: [
        `Please find the QC results for report ${reportId} (${fileName}).`,
        "",
        "If you need to include the export attachment, download the CSV or PDF first and attach it manually.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    });
  }

  function handleAnnotatedPdfExport() {
    if (!sourcePdf) {
      sourcePdfInputRef.current?.click();
      return;
    }

    void onAnnotatedPdfExport(sourcePdf);
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => (exportBusy ? null : onClose())}
      >
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
              <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-950">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-2xl font-bold text-black dark:text-white">Export QC results</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Generate a consultant-ready export for report <span className="font-medium text-black dark:text-white">{reportId}</span>.
                    </Dialog.Description>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Filename pattern: <span className="font-mono">{fileName}__{reportId}__qc-results__YYYY-MM-DD__generated-YYYY-MM-DDThh-mm-ssZ</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={exportBusy}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    aria-label="Close export dialog"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {!isExportable && (
                  <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This report is not ready for export yet. Exports are only available once QC analysis is complete.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {exportOptions.map((option) => {
                    const Icon = option.icon;
                    const isLoading = loadingFormat === option.format;

                    return (
                      <button
                        key={option.format}
                        type="button"
                        onClick={() => void onExport(option.format)}
                        disabled={!isExportable || exportBusy}
                        className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                      >
                        <div className="mb-4 inline-flex rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
                          <Icon className="size-5" />
                        </div>
                        <p className="text-lg font-semibold text-black dark:text-white">{option.title}</p>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
                          <Download className="size-4" />
                          {isLoading ? "Generating export..." : `Download ${option.format.toUpperCase()}`}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
                        <FileUp className="size-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-black dark:text-white">Annotate original PDF</h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Choose the original PDF and download the same pages with QC highlights and issue callout boxes.
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <ShieldCheck className="size-3.5" />
                        Source PDF stays in this browser
                      </div>
                    </div>

                    <div className="w-full space-y-3 md:max-w-xs">
                      <input
                        ref={sourcePdfInputRef}
                        type="file"
                        accept="application/pdf"
                        aria-label="Source PDF for annotated PDF"
                        className="sr-only"
                        onChange={(event) => handleSourcePdf(event.target.files?.[0] ?? null)}
                      />

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        {sourcePdf ? sourcePdf.name : "No source PDF selected"}
                      </div>

                      {sourcePdfError ? (
                        <p className="text-sm text-red-600 dark:text-red-300">{sourcePdfError}</p>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                        <button
                          type="button"
                          onClick={() => sourcePdfInputRef.current?.click()}
                          disabled={!isExportable || exportBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                          {sourcePdf ? "Replace original PDF" : "Choose original PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={handleAnnotatedPdfExport}
                          disabled={!isExportable || !sourcePdf || exportBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                        >
                          <Download className="size-4" />
                          {loadingAnnotatedExport ? "Annotating PDF..." : "Download annotated PDF"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-black dark:text-white">Email shortcuts</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Open a draft and attach the downloaded export manually.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("default")}
                      disabled={!isExportable || exportBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Open email app
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("gmail")}
                      disabled={!isExportable || exportBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:border-black hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Open Gmail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCompose("outlook")}
                      disabled={!isExportable || exportBusy}
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
