import { type QCReport } from "../components/types/qc";
import { type SessionQcResult } from "../services/api";

/* -------------------- */
/* 🔹 Raw API Types     */
/* -------------------- */

type RawIssue = {
    type: string;
    description: string;
    confidence: number;
    section: string;
};

type RawCodeIssue = {
    type: string;
    message: string;
    suggestion: string;
    location: string;
    sectionName: string;
    context: string;
    pageNumber: number;
};

type RawReport = {
    reportSessionId: string;
    filename: string;
    wordCount: number;
    estimatedPages: number;
    issues: RawIssue[];
    codeIssues?: {
        issues: RawCodeIssue[];
    };
};

function isSessionQcResult(data: RawReport | SessionQcResult): data is SessionQcResult {
    return "summary" in data && typeof data.summary === "object" && "passedQC" in data.summary;
}

/* -------------------- */
/* 🔹 Helpers           */
/* -------------------- */

function mapType(rawType: string): string {
    switch (rawType) {
        case "TEMPLATE_ARTIFACT":
            return "Template Placeholder Errors";
        case "CONTRADICTION":
            return "Contradictions Detected";
        case "MISSING_INFORMATION":
            return "Missing Mandatory Information";
        case "UNREMOVED_GUIDANCE":
            return "Template Guidance Not Removed";
        default:
            return "Other Issues";
    }
}




/* -------------------- */
/* 🔹 Main Transformer  */
/* -------------------- */

export function transformToQCReport(data: RawReport | SessionQcResult): QCReport {
    console.log("Raw report:", data);

    if (isSessionQcResult(data)) {
        const issues = data.issues.map((item) => ({
            id: item.id,
            type: mapType(item.type),
            message: item.message,
            location:
                item.location.page != null && item.location.section
                    ? `Page ${item.location.page} - ${item.location.section}`
                    : item.location.page != null
                        ? `Page ${item.location.page}`
                        : item.location.section ?? "",
        }));

        return {
            summary: {
                totalIssues: data.summary.totalIssues,
                passed: data.summary.passedQC,
            },
            issues,
        };
    }

    /* ---------- Base Issues ---------- */
    const baseIssues = data.issues.map((item, index) => ({
        id: `ISSUE-${String(index + 1).padStart(3, "0")}`,
        type: mapType(item.type),
        message: item.description,
        location: item.section,
        severity: null,
        confidence: item.confidence,
    }));

    /* ---------- Code Issues ---------- */
    /*
    const codeIssues =
        data.codeIssues?.issues.map((item, index) => ({
            id: `CODE-${String(index + 1).padStart(3, "0")}`,
            type: mapType(item.type),
            message: `${item.message} → ${item.context}`,
            location: `${item.sectionName} (${item.location})`,
            severity: getSeverity(item.type, 1),
            confidence: 1,
        })) ?? [];
    */

    /* ---------- Merge ---------- */
    //const issues = [...baseIssues, ...codeIssues];
    const issues = [...baseIssues];

    /* ---------- Summary ---------- */
    const summary = {
        totalIssues: issues.length,
        passed: issues.length === 0,
    };

    return {
        summary,
        issues,
    };
}
