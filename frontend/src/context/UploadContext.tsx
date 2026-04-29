import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    type UploadReportErrorCode,
    type UploadReportSuccess,
    uploadReport,
} from "../api/reportUpload";
import { useLanguage } from "./useLanguage";
import { compressPdf } from "../utils/compressPdf";
import { sessionQcApi } from "../services/api";
import { UploadContext } from "./Upload-Context";


type UploadState = "idle" | "uploading" | "success" | "error";

export interface UploadContextType {
    uploadState: UploadState;
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;

    abortControllerRef: React.RefObject<AbortController>

    uploadProgress: number;

    errorMessage: string;
    setErrorMessage: React.Dispatch<React.SetStateAction<string>>;

    result: UploadReportSuccess | null;
    setResult: React.Dispatch<React.SetStateAction<UploadReportSuccess | null>>;

    startTime: number | null;
    setStartTime: React.Dispatch<React.SetStateAction<number | null>>;

    startUpload: (file: File) => Promise<void>;
    cancelUpload: () => void;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [uploadProgress, setUploadProgress] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [result, setResult] = useState<UploadReportSuccess | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);

    const { t } = useLanguage();
    const navigate = useNavigate();

    const friendlyErrorMessages: Record<UploadReportErrorCode, string> = {
        file_required: t("uploadErrorFileRequired"),
        invalid_file_type: t("uploadErrorInvalidFileType"),
        file_too_large: t("uploadErrorFileTooLarge"),
        internal_error: t("uploadErrorInternal"),
        unauthorized: t("uploadErrorUnauthorized"),
        ai_scan_unavailable: t("uploadErrorAiUnavailable"),
        ai_scan_failed: t("uploadErrorAiFailed"),
        invalid_scan_mode: t("uploadErrorInvalidScanMode"),
        rule_scan_unavailable: t("uploadErrorRuleUnavailable"),
    };

    async function startUpload(selectedFile: File) {
        setUploadState("uploading");
        setUploadProgress(0);
        setStartTime(Date.now());

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
                if (!selectedFile) {
                    setUploadState("error");
                    setErrorMessage(friendlyErrorMessages.file_required);
                    return;
                }

                setUploadState("uploading");
                setUploadProgress(0);
                setErrorMessage("");
                setResult(null);

                try {
                    const controller = new AbortController();
                    abortControllerRef.current = controller;
                    const compressedFile = await compressPdf(selectedFile);
                    if (controller.signal.aborted) {
                        throw new DOMException("Aborted", "AbortError");
                    }

                    const response = await uploadReport({
                        file: compressedFile,
                        token:
                            (localStorage.getItem("ligtas.jwt") ?? "").trim() || undefined,
                        onProgress: setUploadProgress,
                        scanMode: "ai",
                        aiLocationMode: "full",
                        signal: controller.signal,
                    });

                    setUploadProgress(100);
                    setResult(response);
                    const persistedResult = await sessionQcApi.analyze(
                        response.reportSessionId,
                        "ai",
                        undefined,
                        { aiLocationMode: "full" },
                    );
                    setUploadState("success");
                    localStorage.setItem("reportResult", JSON.stringify(persistedResult));
                    if (persistedResult.reportId) {
                        localStorage.setItem("ligtas-current-report-id", persistedResult.reportId);
                    } else {
                        localStorage.removeItem("ligtas-current-report-id");
                    }
                    localStorage.setItem("ligtas-current-report-file-name", persistedResult.filename);
                    sessionStorage.setItem("ligtas-next-dashboard-view", "results");
                    window.dispatchEvent(new Event("ligtas-report-result-updated"));
                    navigate("/");
                } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") {
                        setUploadState("idle");
                        setUploadProgress(0);
                        setErrorMessage("");
                        setResult(null);
                        return;
                    }

                    const message = error instanceof Error ? error.message : friendlyErrorMessages.internal_error;
                    setUploadState("error");
                    setErrorMessage(message);
                } finally {
                    abortControllerRef.current = null;
                }
        } catch {
            setUploadState("error");
        }
    }

    function cancelUpload() {
        abortControllerRef.current?.abort();
        setUploadState("idle");
        setUploadProgress(0);
    }

    return (
        <UploadContext.Provider
            value={{
                startUpload,
                uploadState, setUploadState,
                errorMessage, setErrorMessage,
                result, setResult,
                startTime, setStartTime,
                uploadProgress,
                abortControllerRef,
                cancelUpload,
            }}
        >
            {children}
        </UploadContext.Provider>
    );
}

