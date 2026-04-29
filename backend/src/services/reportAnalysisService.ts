import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import { reportUploadConfig } from "../config/reportUploadConfig";
import { scanConfig } from "../config/scanConfig";
import { detectQcIssuesFromText } from "../rules/reportTextRules";
import {
    ISSUE_TYPE_KEY_MAP,
    type PersistedIssueType,
    type QcIssueTypeKey,
    type QcIssue,
} from "../rules/types";
import {
    parseStoredExtractedReportText,
    type ExtractedPdfPage,
} from "../utils/pdf/extractReportText";
import {
    collectSectionHeadings,
    findNearestSectionName,
    findNormalizedTextMatchIndices,
    normalizeApprovedSectionReference,
} from "../utils/text/sectionLocator";
import { runAnalysis } from "./analysis.service";
import { IssueType } from "@prisma/client";

export type ReportScanMode = "ai" | "rules";
export type AiLocationMode = "full" | "canonical_only";

export type AiAnalysisIssue = {
    type: PersistedIssueType;
    description: string;
    section: string;
    quote?: string;
    suggestedAction?: string;
    suggestion?: string;
    pageNumber?: number | null;
    confidence?: number;
    severity?: string;
};

export function resolveReportScanMode(requestedMode?: ReportScanMode): ReportScanMode {
    if (requestedMode === "rules") {
        return "rules";
    }

    if (!scanConfig.aiEnabled || scanConfig.aiProvider === "rules") {
        return "rules";
    }

    return "ai";
}

const mapIssueType = (type: string): IssueType => {
    switch (type) {
        case "TEMPLATE_ARTIFACT":
            return "TEMPLATE_ARTIFACT";

        case "UNREMOVED_GUIDANCE":
            return "UNREMOVED_GUIDANCE";

        case "MISSING_INFORMATION":
            return "MISSING_INFORMATION";

        case "CONTRADICTION":
            return "CONTRADICTION";

        case "LIMITATION_CONTRADICTION":
            return "LIMITATION_CONTRADICTION";

        case "INCOMPLETE_LIMITATIONS":
            return "INCOMPLETE_LIMITATIONS";

        // AI-only extra types → collapse into valid enum
        case "BRACKETED_TEXT_NOT_REMOVED":
        case "PLACEHOLDER_TEXT":
        case "TEMPLATE_PLACEHOLDER":
            return "TEMPLATE_ARTIFACT";

        default:
            return "MISSING_INFORMATION"; // safe fallback
    }
};

type AnalyzeActor = {
    userAccountId: number;
    role: string;
};

type ActiveSession = {
    id: string;
    userAccountId: number;
    filename: string;
    text: string;
    expiresAt: Date;
};

type PersistedIssueRow = {
    id: string;
    type: keyof typeof ISSUE_TYPE_KEY_MAP;
    ruleKey: string | null;
    description: string;
    suggestion: string;
    sectionName: string | null;
    context: string;
    pageNumber: number | null;
};

export type PersistedIssueInput = {
    type: PersistedIssueRow["type"];
    ruleKey: string | null;
    description: string;
    suggestion: string;
    sectionName: string | null;
    context: string;
    location: string;
    pageNumber: number | null;
};

type PersistedReportRow = {
    id: string;
    reportSessionId: string | null;
    fileName: string;
    status: "PROCESSING" | "COMPLETED" | "FAILED";
    analyzedAt: Date | null;
    processingTimeSeconds: number | null;
    totalIssues: number;
    passedQC: boolean;
    userAccountId: number | null;
    issues: PersistedIssueRow[];
};

type ByTypeSummary = Record<QcIssueTypeKey, number>;

type ReportScannerDependencies = {
    runAiAnalysis: (text: string) => Promise<AiAnalysisIssue[]>;
    runRuleAnalysis: (text: string) => QcIssue[];
};

type ReportAnalysisOptions = {
    aiLocationMode?: AiLocationMode;
};

export type SessionQcResultDto = {
    reportSessionId: string;
    reportId: string;
    filename: string;
    scanSource?: ReportScanMode;
    analysisStatus: "pending" | "completed" | "failed";
    summary: {
        totalIssues: number;
        passedQC: boolean;
        byType: ByTypeSummary;
    };
    issues: Array<{
        id: string;
        type: QcIssueTypeKey;
        ruleKey: string | null;
        message: string;
        suggestion: string;
        section: string | null;
        location: {
            page: number | null;
            section: string | null;
        };
        anchor: {
            mode: "page" | "section" | "text";
            targetText: string | null;
            startPage: number | null;
            endPage: number | null;
        };
        context: string;
    }>;
    analyzedAt: string | null;
    processingTimeSeconds?: number;
};

export interface ReportAnalysisRepository {
    cleanupExpiredSessions(now: Date): Promise<void>;

    findActiveSession(
        reportSessionId: string,
        actor: AnalyzeActor,
        now: Date,
    ): Promise<ActiveSession | null>;

    findReportBySession(
        reportSessionId: string,
        actor: AnalyzeActor,
    ): Promise<PersistedReportRow | null>;

    createCompletedReport(params: {
        reportSessionId: string;
        fileName: string;
        userAccountId: number;
        processingTimeSeconds: number;
        issues: PersistedIssueInput[];
    }): Promise<PersistedReportRow>;
}

const isAdminRole = (role: string): boolean => role.toUpperCase() === "ADMIN";

const prismaReportAnalysisRepository: ReportAnalysisRepository = {
    async cleanupExpiredSessions(now) {
        const deleted = await prisma.reportSession.deleteMany({
            where: {
                expiresAt: { lte: now },
            },
        });

        if (deleted.count > 0) {
            console.info("[report-analysis] deleted expired raw text sessions", {
                deletedCount: deleted.count,
            });
        }
    },

    async findActiveSession(reportSessionId, actor, now) {
        return prisma.reportSession.findFirst({
            where: {
                id: reportSessionId,
                expiresAt: { gt: now },
                ...(isAdminRole(actor.role) ? {} : { userAccountId: actor.userAccountId }),
            },
            select: {
                id: true,
                userAccountId: true,
                filename: true,
                text: true,
                expiresAt: true,
            },
        });
    },

    async findReportBySession(reportSessionId, actor) {
        return prisma.report.findFirst({
            where: {
                reportSessionId,
                ...(isAdminRole(actor.role) ? {} : { userAccountId: actor.userAccountId }),
            },
            select: {
                id: true,
                reportSessionId: true,
                fileName: true,
                status: true,
                analyzedAt: true,
                processingTimeSeconds: true,
                totalIssues: true,
                passedQC: true,
                userAccountId: true,
                issues: {
                    select: {
                        id: true,
                        type: true,
                        ruleKey: true,
                        description: true,
                        suggestion: true,
                        sectionName: true,
                        context: true,
                        pageNumber: true,
                    },
                },
            },
        });
    },

    async createCompletedReport(params) {
        const totalCount = params.issues.length;

        return prisma.$transaction(async (tx) => {
            const analyzedAt = new Date();
            const report = await tx.report.create({
                data: {
                    reportSessionId: params.reportSessionId,
                    fileName: params.fileName,
                    status: "COMPLETED",
                    analyzedAt,
                    processingTimeSeconds: params.processingTimeSeconds,
                    totalIssues: totalCount,
                    passedQC: totalCount === 0,
                    userAccountId: params.userAccountId,
                },
            });

            if (params.issues.length > 0) {
                await tx.issue.createMany({
                    data: params.issues.map((issue) => ({
                        reportId: report.id,
                        type: mapIssueType(issue.type),
                        ruleKey: issue.ruleKey,
                        description: issue.description,
                        suggestion: issue.suggestion,
                        sectionName: issue.sectionName,
                        context: issue.context,
                        location: issue.location,
                        pageNumber: issue.pageNumber,
                    })),
                });
            }

            const deletedSession = await tx.reportSession.deleteMany({
                where: {
                    id: params.reportSessionId,
                },
            });

            if (deletedSession.count > 0) {
                console.info("[report-analysis] deleted report session raw text after persistence", {
                    reportSessionId: params.reportSessionId,
                    reportId: report.id,
                });
            }

            return tx.report.findUniqueOrThrow({
                where: { id: report.id },
                select: {
                    id: true,
                    reportSessionId: true,
                    fileName: true,
                    status: true,
                    analyzedAt: true,
                    processingTimeSeconds: true,
                    totalIssues: true,
                    passedQC: true,
                    userAccountId: true,
                    issues: {
                        select: {
                            id: true,
                            type: true,
                            ruleKey: true,
                            description: true,
                            suggestion: true,
                            sectionName: true,
                            context: true,
                            pageNumber: true,
                        },
                    },
                },
            });
        });
    },
};

const defaultScannerDependencies: ReportScannerDependencies = {
    runAiAnalysis: async (text) => {
        const issues = await runAnalysis({
            id: "",
            observations: "",
            findings: "",
            limitations: "",
            conclusion: "",
            full: text,
        });

        return issues.map((issue) => ({
            type: issue.type as PersistedIssueType,
            description: issue.description,
            section: issue.section,
            quote: issue.quote,
            suggestedAction: issue.suggestedAction,
            pageNumber: issue.pageNumber,
            confidence: issue.confidence,
            severity: issue.severity,
        }));
    },
    runRuleAnalysis: (text) => {
        const detected = detectQcIssuesFromText(text, {
            wordsPerPage: reportUploadConfig.wordsPerPageHeuristic,
            maxIssuesPerType: 25,
        });

        return detected.issues;
    },
};

function emptyByTypeSummary(): ByTypeSummary {
    return {
        template_artifact: 0,
        unremoved_guidance: 0,
        missing_information: 0,
        contradiction: 0,
        limitation_contradiction: 0,
        incomplete_limitations: 0,
    };
}

function normalizeAiSectionLabel(section: string): string | null {
    const normalized = section
        .replace(/^#+\s*SECTION\s+\d+\s*:\s*/i, "")
        .replace(/^SECTION\s+\d+\s*:\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized || /^multiple sections analysis$/i.test(normalized)) {
        return null;
    }

    return normalizeApprovedSectionReference(normalized) ?? normalized;
}

function isSyntheticSectionMarkerIssue(issue: {
    description: string;
    section: string;
    quote?: string;
}): boolean {
    const values = [issue.description, issue.quote, issue.section]
        .map((value) => value?.trim() || "")
        .filter(Boolean);

    return values.some((value) => /^#+\s*SECTION\s+\d+\b/i.test(value));
}

const IGNORED_AI_STANDALONE_TABLE_TOKENS = new Set(
    [
        "l/r",
        "rating",
        "freq",
        "priority",
        "photograph",
        "item description",
        "action required",
        "progress / completion notes",
    ].map((value) => value.toLowerCase()),
);

function normalizeStandaloneAiToken(value: string | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed
        .replace(/^\[(.*)\]$/s, "$1")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    return normalized || null;
}

function isIgnoredStandaloneTableTokenIssue(issue: {
    description: string;
    section: string;
    quote?: string;
}): boolean {
    const candidates = [issue.quote, issue.description]
        .map((value) => normalizeStandaloneAiToken(value))
        .filter((value): value is string => Boolean(value));

    return candidates.some((value) => IGNORED_AI_STANDALONE_TABLE_TOKENS.has(value));
}

function normalizeAiPageNumber(pageNumber: number | null | undefined): number | null {
    if (typeof pageNumber !== "number") {
        return null;
    }

    return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : null;
}

function normalizeAiIssues(
    issues: AiAnalysisIssue[],
    pages: ExtractedPdfPage[],
    options: ReportAnalysisOptions = {},
): PersistedIssueInput[] {
    const pageSectionHeadings = new Map(
        pages.map((page) => [page.pageNumber, collectSectionHeadings(page.text)]),
    );

    return issues
        .filter((issue) => !isSyntheticSectionMarkerIssue(issue))
        .filter((issue) => !isIgnoredStandaloneTableTokenIssue(issue))
        .map((issue) => {
            const normalizedSection = normalizeAiSectionLabel(issue.section);
            const trimmedQuote = issue.quote?.trim() || "";
            const trimmedDescription = issue.description.trim();
            const matchedLocation =
                options.aiLocationMode === "canonical_only"
                    ? { pageNumber: null, sectionName: null }
                    : matchAiIssueToLocation(issue, pages, pageSectionHeadings);
            const pageNumber = matchedLocation.pageNumber ?? normalizeAiPageNumber(issue.pageNumber);
            const resolvedSection = normalizedSection || matchedLocation.sectionName;
            const context = trimmedQuote || trimmedDescription || resolvedSection || "AI detected issue";
            const description = trimmedDescription || trimmedQuote || "AI detected issue.";
            const suggestion = issue.suggestedAction?.trim() || issue.suggestion?.trim() || "";
            const location =
                pageNumber != null
                    ? `Page ${pageNumber}${resolvedSection ? ` - ${resolvedSection}` : ""}`
                    : resolvedSection || "AI detected issue";

            return {
                type: mapIssueType(issue.type),
                ruleKey: null,
                description,
                suggestion,
                sectionName: resolvedSection || null,
                context,
                location,
                pageNumber,
            };
        });
}

export function normalizeAiIssuesForPersistence(
    issues: AiAnalysisIssue[],
    pages: ExtractedPdfPage[],
    options: ReportAnalysisOptions = {},
): PersistedIssueInput[] {
    return normalizeAiIssues(issues, pages, options);
}

function normalizeTextForSearch(value: string): string {
    return value
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function mapMatchIndexToPage(matchIndex: number, pages: ExtractedPdfPage[]): number | null {
    let cursor = 0;

    for (const page of pages) {
        const start = cursor;
        const end = start + page.text.length;

        if (matchIndex >= start && matchIndex <= end) {
            return page.pageNumber;
        }

        cursor = end + 2;
    }

    return null;
}

function buildRuleIssueSearchCandidates(issue: QcIssue): string[] {
    const rawCandidates = issue.context
        .split(/[\r\n]+/)
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length >= 8)
        .filter((candidate) => !candidate.includes("..."));

    if (rawCandidates.length > 0) {
        return rawCandidates.sort((a, b) => b.length - a.length);
    }

    const trimmedContext = issue.context.trim();
    if (trimmedContext.length >= 8 && !trimmedContext.includes("...")) {
        return [trimmedContext];
    }

    return [];
}

function buildAiIssueSearchCandidates(issue: {
    description: string;
    section: string;
    quote?: string;
    suggestedAction?: string;
}): string[] {
    const normalizedSection = normalizeAiSectionLabel(issue.section);
    const candidates = [issue.quote, issue.description]
        .map((value) => value?.trim() || "")
        .filter((value) => value.length >= 8)
        .filter((value) => {
            if (!normalizedSection) {
                return true;
            }

            return normalizeTextForSearch(value) !== normalizeTextForSearch(normalizedSection);
        });

    return [...new Set(candidates)].sort((a, b) => b.length - a.length);
}

function sanitizeAnchorCandidate(candidate: string): string | null {
    const sanitized = candidate
        .trim()
        .replace(/^#\s*/, "")
        .replace(/^\[(.*)\]$/s, "$1")
        .replace(/\*{2,}\s*OR\s*\*{2,}/gi, "OR")
        .replace(/\*{2,}/g, "")
        .trim();

    return sanitized && sanitized !== candidate.trim() ? sanitized : null;
}

type MatchedAiIssueLocation = {
    pageNumber: number | null;
    sectionName: string | null;
};

const AMBIGUOUS_SECTION_NAME = "Ambiguous";
const UNKNOWN_SECTION_NAME = "Unknown";

const DERIVED_SECTION_PARENT_LOOKUP = new Map<string, string>([
    ["risk assessment findings", "8. Fire Risk Assessment"],
    ["high risk action(s) requiring immediate attention", "8. Fire Risk Assessment"],
    ["ground floor shop unit", "10. Tenant(s) Monitoring"],
]);

function deriveApprovedSectionFromStoredSection(sectionName: string | null): string | null {
    const normalized = sectionName?.trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    return DERIVED_SECTION_PARENT_LOOKUP.get(normalized) ?? null;
}

function normalizeCanonicalSectionReference(sectionName: string | null): string | null {
    return (
        normalizeApprovedSectionReference(sectionName) ??
        deriveApprovedSectionFromStoredSection(sectionName)
    );
}

function isLikelyContentsPage(
    pageNumber: number,
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): boolean {
    return (pageSectionHeadings.get(pageNumber) ?? []).length >= 4;
}

function findCanonicalSectionAnchorPage(
    canonicalSection: string | null,
    pages: ExtractedPdfPage[],
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): number | null {
    if (!canonicalSection) {
        return null;
    }

    const matches = pages
        .map((page) => ({
            pageNumber: page.pageNumber,
            firstMatchIndex: findNormalizedTextMatchIndices(page.text, canonicalSection)[0] ?? null,
        }))
        .filter((page): page is { pageNumber: number; firstMatchIndex: number } => page.firstMatchIndex != null);

    if (matches.length === 0) {
        return null;
    }

    const nonContentsMatches = matches.filter(
        (page) => !isLikelyContentsPage(page.pageNumber, pageSectionHeadings),
    );
    const preferredMatches = nonContentsMatches.length > 0 ? nonContentsMatches : matches;
    const nearStartMatches = preferredMatches.filter((page) => page.firstMatchIndex < 160);
    const narrowedMatches = nearStartMatches.length > 0 ? nearStartMatches : preferredMatches;

    return narrowedMatches.length === 1 ? narrowedMatches[0].pageNumber : null;
}

function pickPageFromMatchSet(
    pageNumbers: number[],
    candidate: string,
    sectionAnchorPage: number | null,
): number | null {
    if (pageNumbers.length === 0) {
        return null;
    }

    if (pageNumbers.length === 1) {
        return pageNumbers[0];
    }

    if (sectionAnchorPage != null && pageNumbers.includes(sectionAnchorPage)) {
        return sectionAnchorPage;
    }

    if (sectionAnchorPage != null && pageNumbers.length <= 3 && candidate.trim().length >= 12) {
        const sortedPages = [...pageNumbers].sort((a, b) => a - b);
        const nearbyContinuationPages = sortedPages.filter(
            (pageNumber) => pageNumber > sectionAnchorPage && pageNumber <= sectionAnchorPage + 3,
        );

        if (nearbyContinuationPages.length > 0) {
            return nearbyContinuationPages[0];
        }
    }

    return null;
}

function findCandidateMatchPages(candidate: string, pages: ExtractedPdfPage[]): number[] {
    return pages
        .filter((page) => findNormalizedTextMatchIndices(page.text, candidate).length > 0)
        .map((page) => page.pageNumber);
}

function resolveAiIssuePageAnchor(
    searchCandidates: string[],
    expectedSection: string | null,
    pages: ExtractedPdfPage[],
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): number | null {
    const canonicalSection = normalizeCanonicalSectionReference(expectedSection);
    const sectionAnchorPage = findCanonicalSectionAnchorPage(
        canonicalSection,
        pages,
        pageSectionHeadings,
    );

    for (const candidate of searchCandidates) {
        const exactPages = findCandidateMatchPages(candidate, pages);
        const exactPage = pickPageFromMatchSet(exactPages, candidate, sectionAnchorPage);
        if (exactPage != null) {
            return exactPage;
        }

        const sanitizedCandidate = sanitizeAnchorCandidate(candidate);
        if (!sanitizedCandidate) {
            continue;
        }

        const sanitizedPages = findCandidateMatchPages(sanitizedCandidate, pages);
        const sanitizedPage = pickPageFromMatchSet(
            sanitizedPages,
            sanitizedCandidate,
            sectionAnchorPage,
        );
        if (sanitizedPage != null) {
            return sanitizedPage;
        }
    }

    return sectionAnchorPage;
}

function isTenantMonitoringTablePage(text: string): boolean {
    const normalized = normalizeTextForSearch(text);

    return (
        normalized.includes("tenant") &&
        normalized.includes("existing control measure / remarks") &&
        normalized.includes("action required")
    );
}

function deriveApprovedSectionFromPageContext(
    pageText: string,
    expectedSection: string | null,
): string | null {
    const derivedSection = deriveApprovedSectionFromStoredSection(expectedSection);
    if (derivedSection) {
        return derivedSection;
    }

    if (isTenantMonitoringTablePage(pageText)) {
        return "10. Tenant(s) Monitoring";
    }

    return null;
}

function canonicalizeReplaySectionName(sectionName: string | null): string | null {
    if (sectionName === AMBIGUOUS_SECTION_NAME) {
        return AMBIGUOUS_SECTION_NAME;
    }

    const canonicalApprovedSection = normalizeCanonicalSectionReference(sectionName);

    if (canonicalApprovedSection) {
        return canonicalApprovedSection;
    }

    return sectionName ? UNKNOWN_SECTION_NAME : null;
}

function resolveSectionNameForMatch(
    pageNumber: number,
    matchIndex: number,
    expectedSection: string | null,
    pages: ExtractedPdfPage[],
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): string | null {
    const derivedSection = normalizeCanonicalSectionReference(expectedSection);
    if (derivedSection) {
        return derivedSection;
    }

    const currentPageHeadings = pageSectionHeadings.get(pageNumber) ?? [];
    const currentPageSection = findNearestSectionName(matchIndex, currentPageHeadings);
    if (currentPageSection) {
        return currentPageSection;
    }

    const currentPage = pages.find((page) => page.pageNumber === pageNumber);
    if (currentPage) {
        const contextualSection = deriveApprovedSectionFromPageContext(currentPage.text, expectedSection);
        if (contextualSection) {
            return contextualSection;
        }
    }

    if (normalizeApprovedSectionReference(expectedSection)) {
        return null;
    }

    const pageIndex = pages.findIndex((page) => page.pageNumber === pageNumber);
    if (pageIndex <= 0) {
        return null;
    }

    const previousPage = pages[pageIndex - 1];
    const previousPageHeadings = pageSectionHeadings.get(previousPage.pageNumber) ?? [];
    return previousPageHeadings.length > 0
        ? previousPageHeadings[previousPageHeadings.length - 1].title
        : null;
}

function resolveMatchedLocation(
    searchCandidates: string[],
    expectedSection: string | null,
    pages: ExtractedPdfPage[],
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): MatchedAiIssueLocation {
    if (pages.length === 0) {
        return {
            pageNumber: null,
            sectionName: null,
        };
    }

    for (const candidate of searchCandidates) {
        const matches = pages.flatMap((page) => {
            const matchIndices = findNormalizedTextMatchIndices(page.text, candidate);
            if (matchIndices.length === 0) {
                return [];
            }

            return matchIndices.map((matchIndex) => ({
                matchKey: `${page.pageNumber}:${matchIndex}`,
                page,
                pageNumber: page.pageNumber,
                sectionName: resolveSectionNameForMatch(
                    page.pageNumber,
                    matchIndex,
                    expectedSection,
                    pages,
                    pageSectionHeadings,
                ),
            }));
        });

        if (matches.length === 1) {
            return {
                pageNumber: matches[0].pageNumber,
                sectionName: matches[0].sectionName,
            };
        }

        const distinctSections = Array.from(
            new Set(
                matches
                    .map((match) => match.sectionName?.trim())
                    .filter((section): section is string => Boolean(section)),
            ),
        );

        if (distinctSections.length > 1) {
            const distinctPages = Array.from(new Set(matches.map((match) => match.pageNumber)));
            return {
                pageNumber: distinctPages.length === 1 ? distinctPages[0] : null,
                sectionName: AMBIGUOUS_SECTION_NAME,
            };
        }

        if (distinctSections.length === 1) {
            const distinctPages = Array.from(new Set(matches.map((match) => match.pageNumber)));
            return {
                pageNumber: distinctPages.length === 1 ? distinctPages[0] : null,
                sectionName: distinctSections[0],
            };
        }

        if (matches.length > 1 && expectedSection) {
            const normalizedSectionText = normalizeTextForSearch(expectedSection);
            const headingMatches = matches.filter(
                (match) =>
                    match.sectionName &&
                    normalizeTextForSearch(match.sectionName) === normalizedSectionText,
            );

            const uniqueHeadingMatches = Array.from(
                new Map(headingMatches.map((match) => [match.matchKey, match])).values(),
            );

            if (uniqueHeadingMatches.length === 1) {
                return {
                    pageNumber: uniqueHeadingMatches[0].pageNumber,
                    sectionName: uniqueHeadingMatches[0].sectionName,
                };
            }

            const sectionMatches = matches.filter((match) =>
                normalizeTextForSearch(match.page.text).includes(normalizedSectionText),
            );

            const uniqueSectionMatches = Array.from(
                new Map(sectionMatches.map((match) => [match.matchKey, match])).values(),
            );

            if (uniqueSectionMatches.length === 1) {
                return {
                    pageNumber: uniqueSectionMatches[0].pageNumber,
                    sectionName: uniqueSectionMatches[0].sectionName,
                };
            }
        }
    }

    return {
        pageNumber: null,
        sectionName: null,
    };
}

function matchAiIssueToLocation(
    issue: { description: string; section: string; quote?: string },
    pages: ExtractedPdfPage[],
    pageSectionHeadings: Map<number, ReturnType<typeof collectSectionHeadings>>,
): MatchedAiIssueLocation {
    const normalizedSection = normalizeAiSectionLabel(issue.section);
    const pageNumber = resolveAiIssuePageAnchor(
        buildAiIssueSearchCandidates(issue),
        normalizedSection,
        pages,
        pageSectionHeadings,
    );

    return {
        pageNumber,
        sectionName: normalizedSection,
    };
}

function matchRuleIssueToPage(issue: QcIssue, pages: ExtractedPdfPage[]): number | null {
    if (pages.length === 0) {
        return issue.pageNumber;
    }

    if (issue.matchIndex != null) {
        const pageFromMatchIndex = mapMatchIndexToPage(issue.matchIndex, pages);
        if (pageFromMatchIndex != null) {
            return pageFromMatchIndex;
        }
    }

    for (const candidate of buildRuleIssueSearchCandidates(issue)) {
        const normalizedCandidate = normalizeTextForSearch(candidate);
        const matches = pages.filter((page) =>
            normalizeTextForSearch(page.text).includes(normalizedCandidate),
        );

        if (matches.length === 1) {
            return matches[0].pageNumber;
        }

        if (matches.length > 1 && issue.pageNumber != null) {
            const hinted = matches.find((page) => page.pageNumber === issue.pageNumber);
            if (hinted) {
                return hinted.pageNumber;
            }
        }
    }

    return issue.pageNumber;
}

function normalizeRuleIssues(
    issues: QcIssue[],
    pages: ExtractedPdfPage[],
): PersistedIssueInput[] {
    return issues.map((issue) => {
        const matchedPageNumber = matchRuleIssueToPage(issue, pages);
        const pageNumber = matchedPageNumber;
        const location =
            pageNumber != null
                ? `Page ${pageNumber}${issue.sectionName ? ` - ${issue.sectionName}` : ""}`
                : issue.location;

        return {
            type: mapIssueType(issue.type),
            ruleKey: issue.ruleKey,
            description: issue.message,
            suggestion: issue.suggestion,
            sectionName: issue.sectionName,
            context: issue.context,
            location,
            pageNumber,
        };
    });
}

export function normalizeRuleIssuesForPersistence(
    issues: QcIssue[],
    pages: ExtractedPdfPage[],
): PersistedIssueInput[] {
    return normalizeRuleIssues(issues, pages);
}

type PersistedIssueReplayInput = {
    id: string;
    description: string;
    context: string;
    location: string;
    pageNumber: number | null;
    sectionName: string | null;
};

export type PersistedIssueReplayResult = {
    id: string;
    original: {
        location: string;
        pageNumber: number | null;
        sectionName: string | null;
    };
    replayed: {
        location: string;
        pageNumber: number | null;
        sectionName: string | null;
    };
    changed: {
        location: boolean;
        pageNumber: boolean;
        sectionName: boolean;
    };
};

function buildPersistedIssueSearchCandidates(issue: PersistedIssueReplayInput): string[] {
    const normalizedSection = issue.sectionName ? normalizeTextForSearch(issue.sectionName) : null;
    const candidates = [issue.context, issue.description]
        .map((value) => value.trim())
        .filter((value) => value.length >= 8)
        .filter((value) => !normalizedSection || normalizeTextForSearch(value) !== normalizedSection);

    return [...new Set(candidates)].sort((a, b) => b.length - a.length);
}

export function replayPersistedIssueLocationsForPages(
    issues: PersistedIssueReplayInput[],
    pages: ExtractedPdfPage[],
): PersistedIssueReplayResult[] {
    const pageSectionHeadings = new Map(
        pages.map((page) => [page.pageNumber, collectSectionHeadings(page.text)]),
    );

    return issues.map((issue) => {
        const canonicalOriginalSection = normalizeCanonicalSectionReference(issue.sectionName);
        if (canonicalOriginalSection) {
            const replayedLocation =
                issue.pageNumber != null
                    ? `Page ${issue.pageNumber} - ${canonicalOriginalSection}`
                    : canonicalOriginalSection;

            return {
                id: issue.id,
                original: {
                    location: issue.location,
                    pageNumber: issue.pageNumber,
                    sectionName: issue.sectionName,
                },
                replayed: {
                    location: replayedLocation,
                    pageNumber: issue.pageNumber,
                    sectionName: canonicalOriginalSection,
                },
                changed: {
                    location: replayedLocation !== issue.location,
                    pageNumber: false,
                    sectionName: canonicalOriginalSection !== issue.sectionName,
                },
            };
        }

        const matchedLocation = resolveMatchedLocation(
            buildPersistedIssueSearchCandidates(issue),
            issue.sectionName,
            pages,
            pageSectionHeadings,
        );
        let replayedPageNumber = matchedLocation.pageNumber;
        let replayedSection = matchedLocation.sectionName || issue.sectionName || null;
        const approvedOriginalSection = normalizeApprovedSectionReference(issue.sectionName);

        if (approvedOriginalSection) {
            replayedSection = approvedOriginalSection;
        }

        if (replayedSection === AMBIGUOUS_SECTION_NAME && approvedOriginalSection) {
            replayedSection = approvedOriginalSection;
            if (replayedPageNumber == null && issue.pageNumber != null) {
                replayedPageNumber = issue.pageNumber;
            }
        }

        if (
            replayedPageNumber == null &&
            issue.pageNumber != null &&
            replayedSection !== AMBIGUOUS_SECTION_NAME &&
            !approvedOriginalSection
        ) {
            const hintedPage = pages.find((page) => page.pageNumber === issue.pageNumber);
            const hintedPageHeadings = issue.pageNumber != null
                ? pageSectionHeadings.get(issue.pageNumber) ?? []
                : [];

            if (hintedPage) {
                const contextualSection = deriveApprovedSectionFromPageContext(
                    hintedPage.text,
                    issue.sectionName,
                );

                if (contextualSection) {
                    replayedPageNumber = issue.pageNumber;
                    replayedSection = contextualSection;
                } else if (hintedPageHeadings.length === 1) {
                    replayedPageNumber = issue.pageNumber;
                    replayedSection = hintedPageHeadings[0].title;
                }
            }
        }

        replayedSection = canonicalizeReplaySectionName(replayedSection);
        if (replayedPageNumber != null && !replayedSection) {
            replayedSection = UNKNOWN_SECTION_NAME;
        }

        if (
            replayedPageNumber == null &&
            issue.pageNumber != null &&
            approvedOriginalSection &&
            replayedSection === approvedOriginalSection
        ) {
            replayedPageNumber = issue.pageNumber;
        }

        const replayedLocation =
            replayedPageNumber != null
                ? `Page ${replayedPageNumber}${replayedSection ? ` - ${replayedSection}` : ""}`
                : replayedSection || issue.location;

        return {
            id: issue.id,
            original: {
                location: issue.location,
                pageNumber: issue.pageNumber,
                sectionName: issue.sectionName,
            },
            replayed: {
                location: replayedLocation,
                pageNumber: replayedPageNumber,
                sectionName: replayedSection,
            },
            changed: {
                location: replayedLocation !== issue.location,
                pageNumber: replayedPageNumber !== issue.pageNumber,
                sectionName: replayedSection !== issue.sectionName,
            },
        };
    });
}

async function resolvePersistedIssuesFromText(
    storedText: string,
    scanMode: ReportScanMode,
    dependencies: ReportScannerDependencies,
    options: ReportAnalysisOptions = {},
): Promise<{ issues: PersistedIssueInput[]; source: "ai" | "rules" }> {
    const extracted = parseStoredExtractedReportText(storedText);
    const text = extracted.text;

    if (scanMode === "ai") {
        if (!scanConfig.aiEnabled) {
            if (scanConfig.ruleScanEnabled) {
                return {
                    issues: normalizeRuleIssues(
                        dependencies.runRuleAnalysis(text),
                        extracted.pages,
                    ),
                    source: "rules",
                };
            }

            throw new ApiError(503, "ai_scan_unavailable", "AI scan is currently unavailable.");
        }

        try {
            const aiIssues = await dependencies.runAiAnalysis(text);
            return {
                issues: normalizeAiIssues(aiIssues, extracted.pages, options),
                source: "ai",
            };
        } catch (error) {
            console.warn("[report-analysis] AI scan failed", {
                provider: scanConfig.aiProvider,
                error: error instanceof Error ? error.message : "unknown_error",
            });

            if (scanConfig.ruleScanEnabled) {
                console.info("[report-analysis] falling back to rule scan after AI failure", {
                    provider: scanConfig.aiProvider,
                });

                return {
                    issues: normalizeRuleIssues(
                        dependencies.runRuleAnalysis(text),
                        extracted.pages,
                    ),
                    source: "rules",
                };
            }

            throw new ApiError(
                503,
                "ai_scan_failed",
                "AI scan failed before completion. Retry with AI later or switch to the rule-based scan option.",
            );
        }
    }

    if (scanMode === "rules") {
        if (!scanConfig.ruleScanEnabled) {
            throw new ApiError(
                503,
                "rule_scan_unavailable",
                "Rule-based scan is currently unavailable. Retry with AI scan instead.",
            );
        }

        return {
            issues: normalizeRuleIssues(
                dependencies.runRuleAnalysis(text),
                extracted.pages,
            ),
            source: "rules",
        };
    }

    throw new ApiError(400, "invalid_scan_mode", "Invalid report scan mode.");
}

function makeByTypeSummary(issues: PersistedIssueRow[]): ByTypeSummary {
    const summary = emptyByTypeSummary();

    for (const issue of issues) {
        summary[ISSUE_TYPE_KEY_MAP[issue.type]] += 1;
    }

    return summary;
}

function toAnalysisStatus(status: PersistedReportRow["status"]): "pending" | "completed" | "failed" {
    if (status === "COMPLETED") {
        return "completed";
    }

    if (status === "FAILED") {
        return "failed";
    }

    return "pending";
}

function pickIssueTargetText(issue: PersistedIssueRow): string | null {
    const candidates = [issue.context, issue.description, issue.sectionName];

    for (const candidate of candidates) {
        const trimmed = candidate?.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return null;
}

function buildIssueAnchor(issue: PersistedIssueRow): {
    mode: "page" | "section" | "text";
    targetText: string | null;
    startPage: number | null;
    endPage: number | null;
} {
    const targetText = pickIssueTargetText(issue);

    if (issue.pageNumber != null) {
        return {
            mode: "page",
            targetText,
            startPage: issue.pageNumber,
            endPage: issue.pageNumber,
        };
    }

    if (issue.sectionName) {
        return {
            mode: "section",
            targetText,
            startPage: null,
            endPage: null,
        };
    }

    return {
        mode: "text",
        targetText,
        startPage: null,
        endPage: null,
    };
}

function mapToDto(reportSessionId: string, report: PersistedReportRow): SessionQcResultDto {
    const totalIssues = report.issues.length;

    const dto: SessionQcResultDto = {
        reportSessionId,
        reportId: report.id,
        filename: report.fileName,
        analysisStatus: toAnalysisStatus(report.status),
        summary: {
            totalIssues,
            passedQC: totalIssues === 0,
            byType: makeByTypeSummary(report.issues),
        },
        issues: report.issues.map((issue) => ({
            id: issue.id,
            type: ISSUE_TYPE_KEY_MAP[issue.type],
            ruleKey: issue.ruleKey,
            message: issue.description,
            suggestion: issue.suggestion,
            section: issue.sectionName,
            location: {
                page: issue.pageNumber,
                section: issue.sectionName,
            },
            anchor: buildIssueAnchor(issue),
            context: issue.context,
        })),
        analyzedAt: report.analyzedAt ? report.analyzedAt.toISOString() : null,
    };

    if (report.processingTimeSeconds != null) {
        dto.processingTimeSeconds = report.processingTimeSeconds;
    }

    return dto;
}

export async function persistReportAnalysisFromText(
    params: {
        reportSessionId: string;
        fileName: string;
        userAccountId: number;
        text: string;
        scanMode?: ReportScanMode;
    },
    repository: ReportAnalysisRepository = prismaReportAnalysisRepository,
    dependencies: ReportScannerDependencies = defaultScannerDependencies,
    options: ReportAnalysisOptions = {},
): Promise<SessionQcResultDto> {
    const startedAt = Date.now();
    const scanMode = resolveReportScanMode(params.scanMode);
    const resolved = await resolvePersistedIssuesFromText(
        params.text,
        scanMode,
        dependencies,
        options,
    );

    const processingTimeSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    console.info("[report-analysis] persisting scan results", {
        reportSessionId: params.reportSessionId,
        source: resolved.source,
        issueCount: resolved.issues.length,
    });

    try {
        const createdReport = await repository.createCompletedReport({
            reportSessionId: params.reportSessionId,
            fileName: params.fileName,
            userAccountId: params.userAccountId,
            processingTimeSeconds,
            issues: resolved.issues,
        });

        return {
            ...mapToDto(params.reportSessionId, createdReport),
            scanSource: resolved.source,
        };
    } catch (error) {
        console.error("[report-analysis] failed to persist scan results", {
            reportSessionId: params.reportSessionId,
            issueCount: resolved.issues.length,
            error: error instanceof Error ? error.message : "unknown_error",
        });
        throw new ApiError(500, "analysis_failed", "Failed to persist QC analysis results.");
    }
}

export async function persistPrecomputedReportAnalysis(
    params: {
        reportSessionId: string;
        fileName: string;
        userAccountId: number;
        issues: PersistedIssueInput[];
        scanSource: ReportScanMode;
        processingTimeSeconds?: number;
    },
    repository: ReportAnalysisRepository = prismaReportAnalysisRepository,
): Promise<SessionQcResultDto> {
    const processingTimeSeconds = params.processingTimeSeconds ?? 1;

    console.info("[report-analysis] persisting precomputed scan results", {
        reportSessionId: params.reportSessionId,
        source: params.scanSource,
        issueCount: params.issues.length,
    });

    try {
        const createdReport = await repository.createCompletedReport({
            reportSessionId: params.reportSessionId,
            fileName: params.fileName,
            userAccountId: params.userAccountId,
            processingTimeSeconds,
            issues: params.issues,
        });

        return {
            ...mapToDto(params.reportSessionId, createdReport),
            scanSource: params.scanSource,
        };
    } catch (error) {
        console.error("[report-analysis] failed to persist precomputed scan results", {
            reportSessionId: params.reportSessionId,
            issueCount: params.issues.length,
            error: error instanceof Error ? error.message : "unknown_error",
        });
        throw new ApiError(500, "analysis_failed", "Failed to persist QC analysis results.");
    }
}

export async function analyzeReportSession(
    reportSessionId: string,
    actor: AnalyzeActor,
    repository: ReportAnalysisRepository = prismaReportAnalysisRepository,
    now: Date = new Date(),
    scannerDependencies: ReportScannerDependencies = defaultScannerDependencies,
    scanMode?: ReportScanMode,
    options: ReportAnalysisOptions = {},
): Promise<{ created: boolean; result: SessionQcResultDto }> {
    await repository.cleanupExpiredSessions(now);

    const existing = await repository.findReportBySession(reportSessionId, actor);
    if (existing) {
        console.info("[report-analysis] returning existing persisted report", {
            reportSessionId,
            reportId: existing.id,
            issueCount: existing.issues.length,
            passedQC: existing.issues.length === 0,
            scanMode: scanMode ?? "default",
            aiLocationMode: options.aiLocationMode ?? "default",
        });

        return {
            created: false,
            result: mapToDto(reportSessionId, existing),
        };
    }

    const session = await repository.findActiveSession(reportSessionId, actor, now);

    if (!session) {
        throw new ApiError(404, "report_session_not_found", "Report session not found or expired.");
    }
    const result = await persistReportAnalysisFromText(
        {
            reportSessionId,
            fileName: session.filename,
            userAccountId: session.userAccountId,
            text: session.text,
            scanMode,
        },
        repository,
        scannerDependencies,
        options,
    );

    console.info("[report-analysis] created persisted report from active session", {
        reportSessionId,
        reportId: result.reportId,
        issueCount: result.summary.totalIssues,
        passedQC: result.summary.passedQC,
        scanMode: scanMode ?? "default",
        aiLocationMode: options.aiLocationMode ?? "default",
    });

    return {
        created: true,
        result,
    };
}

export async function getSessionQcResults(
    reportSessionId: string,
    actor: AnalyzeActor,
    repository: ReportAnalysisRepository = prismaReportAnalysisRepository,
    now: Date = new Date(),
): Promise<SessionQcResultDto> {
    await repository.cleanupExpiredSessions(now);

    const report = await repository.findReportBySession(reportSessionId, actor);
    if (!report) {
        const session = await repository.findActiveSession(reportSessionId, actor, now);
        if (!session) {
            throw new ApiError(404, "report_session_not_found", "Report session not found or expired.");
        }
        throw new ApiError(404, "qc_results_not_found", "QC results not found for this session.");
    }

    return mapToDto(reportSessionId, report);
}
