/* istanbul ignore file */
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileText, Info, ShieldCheck, UploadCloud } from "lucide-react";
import { ProgressClock } from "./clock";
import { useLanguage } from "../context/useLanguage";
import { useUpload } from "../context/useUpload"

type UploadState = "idle" | "uploading" | "success" | "error";

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadReportPage() {
  const { t } = useLanguage();

  function formatProgressText(progress: number, state: UploadState): string {
    if (state !== "uploading") {
      return "";
    }

    if (progress >= 100) {
      return t("processingReport");
    }

    return `${t("uploading")} ${progress}%`;
  }

    const { startUpload,
        uploadState, setUploadState,
        errorMessage, setErrorMessage,
        result, setResult,
        uploadProgress,
        abortControllerRef,
    } = useUpload();


  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);



  const canUpload = useMemo(() => {
    return Boolean(selectedFile) && uploadState !== "uploading";
  }, [selectedFile, uploadState]);


  function resetStatus() {
    setUploadState("idle");
    setErrorMessage("");
    setResult(null);
  }

  function handlePickedFile(file: File | null) {
    setSelectedFile(file);
    resetStatus();
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function onDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    handlePickedFile(file);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    handlePickedFile(file);
  }

  const isUploading = uploadState === "uploading";
  

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-7 md:px-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {t("uploadFireRiskAssessment")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("uploadPdfForAnalysis")}
          </p>
        </div>

        <div className="ligtas-surface-card-sm space-y-4 rounded-2xl p-6 shadow-sm md:p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={isUploading}
            onChange={onFileInputChange}
          />

          <div
            role="button"
            tabIndex={isUploading ? -1 : 0}
              onKeyDown={(event) => {
                if (isUploading) return;

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
                onClick={() => {
                if (isUploading) return;
                openFilePicker();
              }}
              onDragOver={(e) => {
                if (isUploading) return;
                onDragOver(e);
              }}
              onDragLeave={(e) => {
                if (isUploading) return;
                onDragLeave(e);
              }}
              onDrop={(e) => {
                if (isUploading) return;
                onDrop(e);
  }}
            className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition md:px-8 md:py-12
              ${isUploading
                ? "pointer-events-none cursor-not-allowed opacity-50"
                : dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/30 hover:border-muted-foreground/40"
              }`
            }
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted">
              <UploadCloud className="size-10 text-muted-foreground" />
            </div>
            <p className="text-4xl font-bold text-foreground">{t("dropYourPdfHere")}</p>
            <p className="mt-2 text-lg text-muted-foreground">
              {t("clickToBrowseComputer")}
            </p>
            <button
              type="button"
              disabled={isUploading}
              onClick={(event) => {
                event.stopPropagation();
                  if (isUploading) return; 
                openFilePicker();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("selectPdfFile")}
            </button>
            <p className="mt-5 text-sm text-muted-foreground">
              {t("supportedFormatPdf")}
            </p>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("selectedFile")}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selectedFile?.name ?? t("noFileSelected")}
              </p>
              {selectedFile && <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>}
            </div>
            <button
              type="button"
              onClick={() => handlePickedFile(null)}
              disabled={!selectedFile || uploadState === "uploading"}
              className="ligtas-btn-outline rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("clear")}
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!canUpload}
                onClick={() => startUpload(selectedFile!)}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadState === "uploading" ? t("uploading") : t("uploadReport")}
              </button>

              {uploadState === "uploading" && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  {t("cancel")}
                </button>
              )}

              {uploadState === "success" && (
                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  {t("reportUploadedReady")}
                </div>
              )}
            </div>

            {uploadState === "uploading" && (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center rounded-lg border border-border bg-muted px-6 py-2.5 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ProgressClock percentDone={uploadProgress} />
              </button>
            )}
          </div>

          {uploadState === "uploading" && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatProgressText(uploadProgress, uploadState)}
              </p>
            </div>
          )}

          {uploadState === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="ligtas-surface-card-sm rounded-xl p-4 shadow-sm">
            <div className="ligtas-icon-tile mb-3 inline-flex">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("templateDetection")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("templateDetectionDescription")}
            </p>
          </article>

          <article className="ligtas-surface-card-sm rounded-xl p-4 shadow-sm">
            <div className="ligtas-icon-tile mb-3 inline-flex">
              <ShieldCheck className="size-4 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("contradictionCheck")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("contradictionCheckDescription")}
            </p>
          </article>

          <article className="ligtas-surface-card-sm rounded-xl p-4 shadow-sm">
            <div className="ligtas-icon-tile mb-3 inline-flex">
              <Info className="size-4 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("missingInformation")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("missingInformationDescription")}
            </p>
          </article>
        </div>

        <div className="ligtas-surface-card-sm rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">{t("beforeYouUpload")}</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t("beforeUploadPdfTextBased")}</li>
            <li>{t("beforeUploadMax50mb")}</li>
            <li>{t("beforeUploadCompletes15Mins")}</li>
            <li>{t("beforeUploadNotStored")}</li>
          </ul>
        </div>

        <aside className="ligtas-surface-card-sm rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">{t("uploadResult")}</h2>
          {!result && (
            <p className="mt-3 text-sm text-muted-foreground">{t("noReportUploadInProgress")}</p>
          )}
          {result && (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <dt className="font-medium text-muted-foreground">{t("sessionId")}</dt>
                <dd className="break-all text-foreground">{result.reportSessionId}</dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <dt className="font-medium text-muted-foreground">{t("filename")}</dt>
                <dd className="text-foreground">{result.filename}</dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <dt className="font-medium text-muted-foreground">{t("wordCount")}</dt>
                <dd className="text-foreground">{result.wordCount}</dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <dt className="font-medium text-muted-foreground">{t("estimatedPages")}</dt>
                <dd className="text-foreground">{result.estimatedPages}</dd>
              </div>
            </dl>
          )}
        </aside>
      </section>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />

          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{t("cancelScanTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("cancelScanDescription")}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="ligtas-btn-outline rounded-lg px-4 py-2 text-sm"
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
    </div>
  );
}
