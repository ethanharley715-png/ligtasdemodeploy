import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

import type { ReportDetail } from "../../services/api";
import type { TextContent, TextItem } from "react-pdf";
import { IssueFalsePositiveFlag, IssueReviewControls } from "./IssueReviewControls";
import { formatIssueReviewStatus, issueReviewStatusClasses, type IssueReviewStatus } from "./issueReviewStatus";

export type AttachedPdfReviewIssue = Pick<
  ReportDetail["issues"][number],
  "id" | "type" | "description" | "location" | "context" | "pageNumber" | "reviewStatus" | "reviewedAt"
>;

type Props = {
  issues: AttachedPdfReviewIssue[];
  selectedIssueId?: string | null;
  onSelectIssue?: (issue: AttachedPdfReviewIssue) => void;
  onFocusPage?: (page: number) => void;
  onChangeIssueReviewStatus?: (issueId: string, status: IssueReviewStatus) => void;
  busyIssueId?: string | null;
};

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function formatIssueType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHighlightHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeHighlightValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForExactMatch(value: string) {
  return normalizeHighlightValue(value).toLowerCase();
}

function sanitizeHighlightCandidate(value: string) {
  return normalizeHighlightValue(value)
    .replace(/^#\s*/, "")
    .replace(/^\[(.*)\]$/s, "$1")
    .replace(/\*{2,}\s*OR\s*\*{2,}/gi, "OR")
    .replace(/\*{2,}/g, "")
    .trim();
}

function buildPhraseWindowCandidates(value: string) {
  const words = normalizeHighlightValue(value).split(" ").filter(Boolean);
  if (words.length < 6) {
    return [];
  }

  const windowSizes = [16, 12, 8];
  const candidates: string[] = [];

  for (const windowSize of windowSizes) {
    if (words.length < windowSize) {
      continue;
    }

    const lastStart = words.length - windowSize;
    const sampleStarts = new Set([0, Math.floor(lastStart / 2), lastStart]);

    for (const start of sampleStarts) {
      const phrase = words.slice(start, start + windowSize).join(" ").trim();
      if (phrase.length >= 24) {
        candidates.push(phrase);
      }
    }
  }

  return candidates;
}

function findMatchStarts(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return [];
  }

  const starts: number[] = [];
  let index = 0;

  while (index !== -1) {
    index = haystack.indexOf(needle, index);
    if (index !== -1) {
      starts.push(index);
      index += needle.length;
    }
  }

  return starts;
}

function buildExactHighlightCandidates(issue: AttachedPdfReviewIssue | null) {
  if (!issue) {
    return [];
  }

  const context = issue.context?.trim() ?? "";
  if (!context) {
    return [];
  }

  // PDF text layers often split lines differently, so try cleaned phrases before falling back to full context.
  const candidates = context
    .split(/[\r\n]+/)
    .flatMap((value) => {
      const normalized = normalizeHighlightValue(value);
      const sanitized = sanitizeHighlightCandidate(value);
      return [
        normalized,
        sanitized,
        ...buildPhraseWindowCandidates(normalized),
        ...buildPhraseWindowCandidates(sanitized),
      ];
    })
    .filter((value) => value.length >= 3)
    .filter((value) => value !== issue.location)
    .sort((a, b) => b.length - a.length);

  const uniqueCandidates = Array.from(new Set(candidates));
  if (uniqueCandidates.length > 0) {
    return uniqueCandidates;
  }

  const normalizedContext = normalizeHighlightValue(context);
  const sanitizedContext = sanitizeHighlightCandidate(context);
  return Array.from(new Set([normalizedContext, sanitizedContext].filter(Boolean)));
}

type IndexedTextItem = {
  itemIndex: number;
  rawText: string;
  normalizedText: string;
  start: number;
  end: number;
};

type ExactHighlightMatch = {
  itemIndexes: Set<number>;
};

type IssueVisualSortKey = {
  matched: boolean;
  y: number;
  x: number;
  itemIndex: number;
  originalIndex: number;
};

function buildIndexedTextItems(textContent: TextContent): { combined: string; items: IndexedTextItem[] } {
  const items: IndexedTextItem[] = [];
  let cursor = 0;

  for (const [itemIndex, item] of textContent.items.entries()) {
    if (!("str" in item)) {
      continue;
    }

    const normalizedText = normalizeForExactMatch((item as TextItem).str);
    if (!normalizedText) {
      continue;
    }

    const start = cursor;
    const end = start + normalizedText.length;
    items.push({
      itemIndex,
      rawText: (item as TextItem).str,
      normalizedText,
      start,
      end,
    });
    cursor = end + 1;
  }

  return {
    combined: items.map((item) => item.normalizedText).join(" "),
    items,
  };
}


function findExactHighlightMatch(
  textContent: TextContent | null,
  issue: AttachedPdfReviewIssue | null,
): ExactHighlightMatch | null {
  if (!textContent || !issue) {
    return null;
  }

  const { combined, items } = buildIndexedTextItems(textContent);
  if (!combined || items.length === 0) {
    return null;
  }

  // Match in normalized page text, then map the match back to PDF text-layer item indexes for highlighting.
  const candidates = buildExactHighlightCandidates(issue);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForExactMatch(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const matchStarts = findMatchStarts(combined, normalizedCandidate);
    if (matchStarts.length === 0) {
      continue;
    }

    const itemIndexes = matchStarts.flatMap((matchStart) => {
      const matchEnd = matchStart + normalizedCandidate.length;
      return items
        .filter((item) => item.end > matchStart && item.start < matchEnd)
        .map((item) => item.itemIndex);
    });

    if (itemIndexes.length === 0) {
      continue;
    }

    return {
      itemIndexes: new Set(itemIndexes),
    };
  }

  return null;
}

function highlightPdfTextItem(text: string, itemIndex: number, match: ExactHighlightMatch | null) {
  if (!match?.itemIndexes.has(itemIndex)) {
    return escapeHighlightHtml(text);
  }

  return `<mark style="background: rgba(245, 158, 11, 0.45); color: inherit; padding: 0 1px; border-radius: 2px;">${escapeHighlightHtml(text)}</mark>`;
}

function getTextItemPosition(textContent: TextContent, itemIndex: number): { x: number; y: number } | null {
  const item = textContent.items[itemIndex];
  if (!item || !("transform" in item)) {
    return null;
  }

  const transform = (item as { transform?: unknown }).transform;
  if (!Array.isArray(transform)) {
    return null;
  }

  const x = Number(transform[4]);
  const y = Number(transform[5]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function buildIssueVisualSortKey(
  textContent: TextContent | null,
  issue: AttachedPdfReviewIssue,
  originalIndex: number,
): IssueVisualSortKey {
  if (!textContent) {
    return { matched: false, y: 0, x: 0, itemIndex: Number.MAX_SAFE_INTEGER, originalIndex };
  }

  const match = findExactHighlightMatch(textContent, issue);
  if (!match) {
    return { matched: false, y: 0, x: 0, itemIndex: Number.MAX_SAFE_INTEGER, originalIndex };
  }

  const positionedItems = Array.from(match.itemIndexes)
    .map((itemIndex) => {
      const position = getTextItemPosition(textContent, itemIndex);
      return position ? { ...position, itemIndex } : null;
    })
    .filter((item): item is { x: number; y: number; itemIndex: number } => Boolean(item));

  if (positionedItems.length === 0) {
    return { matched: false, y: 0, x: 0, itemIndex: Number.MAX_SAFE_INTEGER, originalIndex };
  }

  const topY = Math.max(...positionedItems.map((item) => item.y));
  const topLineItems = positionedItems.filter((item) => Math.abs(item.y - topY) < 2);

  return {
    matched: true,
    y: topY,
    x: Math.min(...topLineItems.map((item) => item.x)),
    itemIndex: Math.min(...positionedItems.map((item) => item.itemIndex)),
    originalIndex,
  };
}

function compareIssueVisualSortKeys(a: IssueVisualSortKey, b: IssueVisualSortKey): number {
  if (a.matched !== b.matched) {
    return a.matched ? -1 : 1;
  }

  if (!a.matched && !b.matched) {
    return a.originalIndex - b.originalIndex;
  }

  const yDifference = b.y - a.y;
  if (Math.abs(yDifference) >= 2) {
    return yDifference;
  }

  const xDifference = a.x - b.x;
  if (Math.abs(xDifference) >= 2) {
    return xDifference;
  }

  return a.itemIndex - b.itemIndex || a.originalIndex - b.originalIndex;
}

export default function AttachedPdfReviewPanel({
  issues,
  selectedIssueId,
  onSelectIssue,
  onFocusPage,
  onChangeIssueReviewStatus,
  busyIssueId,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedPdfUrl, setAttachedPdfUrl] = useState<string | null>(null);
  const [attachedPdfName, setAttachedPdfName] = useState<string | null>(null);
  const [viewerPage, setViewerPage] = useState<number>(1);
  const [viewerPageCount, setViewerPageCount] = useState<number>(0);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [internalSelectedIssueId, setInternalSelectedIssueId] = useState<string | null>(null);
  const [currentPageTextContent, setCurrentPageTextContent] = useState<TextContent | null>(null);
  const [pageWidth, setPageWidth] = useState(900);
  const viewerFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (attachedPdfUrl) {
        URL.revokeObjectURL(attachedPdfUrl);
      }
    };
  }, [attachedPdfUrl]);

  const effectiveSelectedIssueId = selectedIssueId ?? internalSelectedIssueId;

  const pageBreakdown = useMemo(() => {
    const counts = issues.reduce<Record<number, number>>((acc, issue) => {
      if (issue.pageNumber == null) {
        return acc;
      }

      acc[issue.pageNumber] = (acc[issue.pageNumber] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([page, count]) => ({ page: Number(page), count }))
      .sort((a, b) => a.page - b.page);
  }, [issues]);

  const currentPageIssues = useMemo(() => {
    return issues
      .map((issue, originalIndex) => ({ issue, originalIndex }))
      .filter(({ issue }) => issue.pageNumber === viewerPage)
      .map(({ issue, originalIndex }) => ({
        issue,
        sortKey: buildIssueVisualSortKey(currentPageTextContent, issue, originalIndex),
      }))
      .sort((a, b) => compareIssueVisualSortKeys(a.sortKey, b.sortKey))
      .map(({ issue }) => issue);
  }, [issues, viewerPage, currentPageTextContent]);

  const selectedCurrentPageIssue = useMemo(() => {
    const selectedIssue = issues.find((issue) => issue.id === effectiveSelectedIssueId) ?? null;
    if (!selectedIssue) {
      return null;
    }

    if (selectedIssue.pageNumber !== viewerPage) {
      return null;
    }

    return selectedIssue;
  }, [issues, effectiveSelectedIssueId, viewerPage]);

  const selectedIssueHighlightMatch = useMemo(() => {
    return findExactHighlightMatch(currentPageTextContent, selectedCurrentPageIssue);
  }, [currentPageTextContent, selectedCurrentPageIssue]);

  const selectedIssueExactCandidates = useMemo(() => {
    return buildExactHighlightCandidates(selectedCurrentPageIssue);
  }, [selectedCurrentPageIssue]);

  useEffect(() => {
    if (selectedCurrentPageIssue?.pageNumber == null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setViewerPage(selectedCurrentPageIssue.pageNumber!);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedCurrentPageIssue]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentPageTextContent(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [viewerPage, attachedPdfUrl]);

  useEffect(() => {
    const frame = viewerFrameRef.current;
    if (!frame) {
      return;
    }

    const updatePageWidth = () => {
      const availableWidth = Math.max(320, frame.clientWidth - 32);
      setPageWidth(Math.min(980, Math.floor(availableWidth)));
    };

    updatePageWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePageWidth);
      return () => window.removeEventListener("resize", updatePageWidth);
    }

    const observer = new ResizeObserver(updatePageWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  function handleAttachPdf(file: File | null) {
    if (!file) {
      return;
    }

    if (attachedPdfUrl) {
      URL.revokeObjectURL(attachedPdfUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setAttachedPdfUrl(nextUrl);
    setAttachedPdfName(file.name);
    setViewerPage(1);
    setViewerPageCount(0);
    setViewerError(null);
  }

  function focusPage(page: number) {
    setViewerPage(page);
    onFocusPage?.(page);
  }

  function selectIssue(issue: AttachedPdfReviewIssue) {
    setInternalSelectedIssueId(issue.id);
    onSelectIssue?.(issue);
    if (issue.pageNumber != null) {
      focusPage(issue.pageNumber);
    }
  }

  const maxPageCount = pageBreakdown.length > 0 ? Math.max(...pageBreakdown.map((entry) => entry.count)) : 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attached PDF Review</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Re-upload a local PDF to visualize issue anchors and text highlights without storing the file on the server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {attachedPdfName ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {attachedPdfName}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            {attachedPdfUrl ? "Replace attached PDF" : "Attach PDF for review"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => handleAttachPdf(event.target.files?.[0] ?? null)}
        />
      </div>

      {!attachedPdfUrl ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/40">
          <p className="text-sm font-medium text-gray-900 dark:text-white">No PDF attached yet</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Attach the same report PDF and review page-level issue placement and approximate text highlights here.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Attach PDF
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Viewer controls</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Current page: {viewerPage}{viewerPageCount > 0 ? ` / ${viewerPageCount}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setInternalSelectedIssueId(null);
                  setViewerPage((current) => Math.max(1, current - 1));
                }}
                disabled={viewerPage <= 1}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  setInternalSelectedIssueId(null);
                  setViewerPage((current) => Math.min(viewerPageCount || current + 1, current + 1));
                }}
                disabled={viewerPageCount === 0 || viewerPage >= viewerPageCount}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
              >
                Next
              </button>
            </div>
          </div>

          {pageBreakdown.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Issue Map by Page</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Jump by page before selecting a specific issue.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {pageBreakdown.map(({ page, count }) => {
                  const active = viewerPage === page;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => focusPage(page)}
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        active
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{`Page ${page} (${count})`}</span>
                        <span
                          className={`inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            active
                              ? "bg-white/20 text-white dark:bg-black/10 dark:text-black"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-full rounded-full ${
                            active ? "bg-white dark:bg-black" : "bg-gray-900 dark:bg-gray-100"
                          }`}
                          style={{ width: `${Math.max(18, Math.round((count / maxPageCount) * 100))}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
              <div ref={viewerFrameRef} className="relative flex min-h-[780px] items-start justify-center overflow-auto p-4">
                <Document
                  file={attachedPdfUrl}
                  loading={<p className="pt-10 text-sm text-gray-600 dark:text-gray-400">Loading attached PDF...</p>}
                  onLoadSuccess={({ numPages }) => {
                    setViewerPageCount(numPages);
                    setViewerPage((current) => {
                      if (current >= 1 && current <= numPages) {
                        return current;
                      }
                      return pageBreakdown[0]?.page ?? 1;
                    });
                    setViewerError(null);
                  }}
                  onLoadError={(loadError) => {
                    setViewerError(loadError instanceof Error ? loadError.message : "Failed to load attached PDF.");
                  }}
                >
                  <div className="relative">
                    <Page
                      className="attached-pdf-review-page shadow-sm"
                      pageNumber={viewerPage}
                      width={pageWidth}
                      renderTextLayer
                      renderAnnotationLayer={false}
                      onGetTextSuccess={(textContent) => setCurrentPageTextContent(textContent)}
                      customTextRenderer={({ str, itemIndex }) =>
                        highlightPdfTextItem(str, itemIndex, selectedIssueHighlightMatch)
                      }
                    />

                    <div className="pointer-events-none absolute left-4 top-4">
                      <div className="rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                        Page {viewerPage}
                      </div>
                    </div>
                  </div>
                </Document>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Current page
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Page {viewerPage}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      currentPageIssues.length > 0
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {currentPageIssues.length > 0 ? `${currentPageIssues.length} issue${currentPageIssues.length === 1 ? "" : "s"}` : "No issues"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Select an issue to keep the text highlight focused on that problem area.
                </p>

                {currentPageIssues.length > 0 ? (
                  <div className="mt-4 max-h-[440px] space-y-2 overflow-auto pr-1">
                    {currentPageIssues.map((issue) => (
                      <div
                        key={issue.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectIssue(issue)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectIssue(issue);
                          }
                        }}
                        className={`block w-full rounded-xl border px-3 py-3 text-left transition ${
                          effectiveSelectedIssueId === issue.id
                            ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100"
                            : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-black/80 px-2 py-0.5 font-semibold text-white dark:bg-white/90 dark:text-black">
                              {formatIssueType(issue.type)}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 font-semibold ${issueReviewStatusClasses(issue.reviewStatus)}`}>
                              {formatIssueReviewStatus(issue.reviewStatus)}
                            </span>
                          </div>
                          <IssueFalsePositiveFlag
                            status={issue.reviewStatus}
                            busy={busyIssueId === issue.id}
                            onChangeStatus={
                              onChangeIssueReviewStatus
                                ? (status) => onChangeIssueReviewStatus(issue.id, status)
                                : undefined
                            }
                            className="size-8"
                          />
                        </div>
                        <p className="mt-2 text-sm font-semibold">{issue.description}</p>
                        <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                          {issue.context || issue.location}
                        </p>
                        <div className="mt-3">
                          <IssueReviewControls
                            status={issue.reviewStatus}
                            busy={busyIssueId === issue.id}
                            onChangeStatus={
                              onChangeIssueReviewStatus
                                ? (status) => onChangeIssueReviewStatus(issue.id, status)
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {selectedCurrentPageIssue ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">Selected issue</p>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
                        {formatIssueType(selectedCurrentPageIssue.type)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${issueReviewStatusClasses(selectedCurrentPageIssue.reviewStatus)}`}>
                        {formatIssueReviewStatus(selectedCurrentPageIssue.reviewStatus)}
                      </span>
                      <span>Page {selectedCurrentPageIssue.pageNumber}</span>
                    </div>
                    <IssueFalsePositiveFlag
                      status={selectedCurrentPageIssue.reviewStatus}
                      busy={busyIssueId === selectedCurrentPageIssue.id}
                      onChangeStatus={
                        onChangeIssueReviewStatus
                          ? (status) => onChangeIssueReviewStatus(selectedCurrentPageIssue.id, status)
                          : undefined
                      }
                      className="size-8"
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{selectedCurrentPageIssue.description}</p>
                  <p className="mt-2 text-sm opacity-90">
                    {selectedCurrentPageIssue.context || selectedCurrentPageIssue.location}
                  </p>
                  <div className="mt-3">
                    <IssueReviewControls
                      status={selectedCurrentPageIssue.reviewStatus}
                      busy={busyIssueId === selectedCurrentPageIssue.id}
                      onChangeStatus={
                        onChangeIssueReviewStatus
                          ? (status) => onChangeIssueReviewStatus(selectedCurrentPageIssue.id, status)
                          : undefined
                      }
                    />
                  </div>
                  {selectedIssueExactCandidates.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedIssueExactCandidates.slice(0, 4).map((term: string) => (
                        <span
                          key={term}
                          className="rounded-full border border-amber-300 bg-white/70 px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-950/60"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {viewerError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {viewerError}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
