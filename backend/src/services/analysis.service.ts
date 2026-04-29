
import { analyzeSections } from "../ai/analyser";
import { splitIntoSections } from "../utils/splitter";


export interface ReportInput {
    id: string;
    observations: string;
    findings: string;
    limitations: string;
    conclusion: string;
    full: string;
}

// Main analysis function with chunking
export async function runAnalysis(
    report: ReportInput,
    onProgress?: (batchIssues: any[], processed: number, total: number) => void
) {
    // Split report into sections
    const sections = splitIntoSections(report.full);

    // Forward progress to analyzeSections
    const result = await analyzeSections(sections, onProgress);

    // Flatten issues if necessary
    return result.issues;
}