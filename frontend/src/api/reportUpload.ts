export type UploadReportSuccess = {
  reportSessionId: string;
  reportId?: string;
  filename: string;
  wordCount: number;
  estimatedPages: number;
  issues?: { type: string; description: string; section: string }[];
  codeIssues?: unknown;
};

export type UploadScanMode = "ai" | "rules";
export type UploadAiLocationMode = "full" | "canonical_only";

type UploadReportParams = {
  file: File;
  token?: string;
  onProgress?: (progress: number) => void;
  scanMode?: UploadScanMode;
  aiLocationMode?: UploadAiLocationMode;
  signal?: AbortSignal;
};

export type UploadReportErrorCode =
  | "file_required"
  | "invalid_file_type"
  | "file_too_large"
  | "invalid_scan_mode"
  | "ai_scan_unavailable"
  | "ai_scan_failed"
  | "rule_scan_unavailable"
  | "internal_error"
  | "unauthorized";

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
  return url ? url.replace(/\/api\/?$/, "") : "http://localhost:4000";
}

function parseUploadError(responseText: string, status: number): Error {
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    return new Error(parsed.message || parsed.error || `Request failed: ${status}`);
  } catch {
    return new Error(responseText || `Request failed: ${status}`);
  }
}

export async function uploadReport({
  file,
  token,
  onProgress,
  scanMode,
  aiLocationMode,
  signal,
}: UploadReportParams): Promise<UploadReportSuccess> {
  const formData = new FormData();
  formData.append("file", file);

  const query = new URLSearchParams();
  if (scanMode) {
    query.set("scanMode", scanMode);
  }
  if (aiLocationMode) {
    query.set("aiLocationMode", aiLocationMode);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${getApiBaseUrl()}/api/reports/upload${suffix}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw parseUploadError(errorText, response.status);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResult: UploadReportSuccess | null = null;

  signal?.addEventListener("abort", () => {
    void reader.cancel();
  });

  // The backend streams newline-delimited JSON progress chunks and finishes with a done result.
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const data = JSON.parse(line) as {
        stage?: string;
        processed?: number;
        total?: number;
        result?: UploadReportSuccess;
        error?: string;
      };

      if (data.stage === "batch_done") {
        if (typeof data.processed === "number" && typeof data.total === "number" && data.total > 0) {
          onProgress?.(Math.round((data.processed / data.total) * 100));
        }
        continue;
      }

      if (data.stage === "done" && data.result) {
        finalResult = data.result;
        continue;
      }

      if (data.stage === "error") {
        throw new Error(data.error || "Upload failed");
      }
    }
  }

  if (!finalResult) {
    throw new Error("Upload did not complete successfully");
  }

  return finalResult;
}
