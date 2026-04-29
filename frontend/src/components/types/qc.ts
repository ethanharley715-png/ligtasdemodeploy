export type IssueType =
    | "MISSING_APPENDIX_D"
    | "CONTRADICTION"
    | "PLACEHOLDER"
    | "FORMAT"
    | "OTHER";

export interface QCIssue {
    id: string;
    message: string;
    type: string;
    location?: string;
    reviewStatus?: "OPEN" | "COMPLETED" | "FALSE_POSITIVE";
    reviewedAt?: string | null;
}

export interface QCSummary {
    totalIssues: number;
    passed: boolean;
}

export interface QCReport {
    summary: QCSummary;
    issues: QCIssue[];
}
