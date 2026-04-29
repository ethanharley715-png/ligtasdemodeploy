export type ApiErrorCode =
  | "file_required"
  | "invalid_file_type"
  | "file_too_large"
  | "invalid_scan_mode"
  | "report_not_ready"
  | "report_session_not_found"
  | "qc_results_not_found"
  | "invalid_request"
  | "analysis_failed"
  | "ai_scan_unavailable"
  | "ai_scan_failed"
  | "rule_scan_unavailable"
  | "share_failed"
  | "rate_limited"
  | "unauthorized"
  | "internal_error"
  | "not_found"
  | "invalid_input"
  | "already_reviewed";

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
