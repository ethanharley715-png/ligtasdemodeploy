import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type AnnotatedPdfIssue = {
  id: string;
  type: string;
  description: string;
  location: string;
  context: string;
  suggestion: string;
  pageNumber: number | null;
};

export type AnnotatedPdfExportParams = {
  sourceFile: File;
  reportId: string;
  reportFileName: string;
  issues: AnnotatedPdfIssue[];
  generatedAt?: Date;
};

export type AnnotatedPdfExportResult = {
  blob: Blob;
  fileName: string;
  annotatedIssueCount: number;
  skippedIssueCount: number;
};

type NumberedIssue = AnnotatedPdfIssue & {
  issueNumber: number;
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

type IndexedTextItem = {
  itemIndex: number;
  textItem: PdfTextItem;
  normalizedText: string;
  start: number;
  end: number;
};

type TextHighlight = {
  itemIndex: number;
  startRatio: number;
  endRatio: number;
};

type HighlightMatch = {
  candidate: string;
  highlights: TextHighlight[];
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const ANNOTATION_MARGIN_WIDTH = 260;
const ANNOTATION_MARGIN_GAP = 14;
const ANNOTATION_MARGIN_INSET = 14;
const ISSUE_CARD_HEIGHT = 82;
const ISSUE_CARD_GAP = 8;

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

const DEFAULT_ISSUE_SUGGESTIONS: Record<string, string> = {
  TEMPLATE_ARTIFACT: "Replace placeholder or template text with the correct final report content.",
  UNREMOVED_GUIDANCE: "Remove drafting guidance or instructional text before finalizing the report.",
  MISSING_INFORMATION: "Add the missing report details so the section is complete and verifiable.",
  CONTRADICTION: "Resolve the conflicting statements so the report is internally consistent.",
  LIMITATION_CONTRADICTION: "Clarify the limitation and align it with the rest of the report content.",
  INCOMPLETE_LIMITATIONS: "Complete the limitations section with clear scope, exclusions, or constraints.",
};

function toPdfSafeText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function formatIssueType(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeIssueTypeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function isMissingSuggestion(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["", "n/a", "na", "none", "no suggestion", "no suggestion available"].includes(normalized);
}

function resolveIssueSuggestion(issue: AnnotatedPdfIssue): string {
  const suggestion = issue.suggestion.trim();
  if (!isMissingSuggestion(suggestion)) {
    return suggestion;
  }

  return DEFAULT_ISSUE_SUGGESTIONS[normalizeIssueTypeKey(issue.type)] ?? "No suggestion available.";
}

function sanitizeFileStem(value: string): string {
  const cleaned = value
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "report";
}

function formatExportTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function buildAnnotatedFileName(reportFileName: string, reportId: string, generatedAt: Date): string {
  return `${sanitizeFileStem(reportFileName)}__${reportId}__annotated-qc__generated-${formatExportTimestamp(generatedAt)}.pdf`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function wrapText(value: string, font: PDFFont, fontSize: number, maxWidth: number, maxLines = 4): string[] {
  const words = toPdfSafeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.+$/, "")}...`;
  }

  return lines.length > 0 ? lines : ["n/a"];
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    maxLines?: number;
  },
): number {
  const lineHeight = options.lineHeight ?? options.size + 3;
  const lines = wrapText(text, options.font, options.size, options.maxWidth, options.maxLines);
  let y = options.y;

  for (const line of lines) {
    page.drawText(line, {
      x: options.x,
      y,
      size: options.size,
      font: options.font,
      color: options.color ?? rgb(0.11, 0.13, 0.17),
    });
    y -= lineHeight;
  }

  return y;
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<PdfTextItem>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

function normalizeHighlightValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForExactMatch(value: string): string {
  return normalizeHighlightValue(value).toLowerCase();
}

function sanitizeHighlightCandidate(value: string): string {
  return normalizeHighlightValue(value)
    .replace(/^#\s*/, "")
    .replace(/^\[(.*)\]$/s, "$1")
    .replace(/\*{2,}\s*OR\s*\*{2,}/gi, "OR")
    .replace(/\*{2,}/g, "")
    .trim();
}

function buildPhraseWindowCandidates(value: string): string[] {
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

function buildExactHighlightCandidates(issue: AnnotatedPdfIssue): string[] {
  const context = issue.context?.trim() ?? "";
  if (!context) {
    return [];
  }

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

function buildIndexedTextItems(textItems: unknown[]): { combined: string; items: IndexedTextItem[] } {
  const items: IndexedTextItem[] = [];
  let cursor = 0;

  for (const [itemIndex, item] of textItems.entries()) {
    if (!isPdfTextItem(item)) {
      continue;
    }

    const normalizedText = normalizeForExactMatch(item.str);
    if (!normalizedText) {
      continue;
    }

    const start = cursor;
    const end = start + normalizedText.length;
    items.push({
      itemIndex,
      textItem: item,
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

function findMatchStarts(haystack: string, needle: string): number[] {
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

function findHighlightMatch(textItems: unknown[], issue: AnnotatedPdfIssue): HighlightMatch | null {
  const { combined, items } = buildIndexedTextItems(textItems);
  if (!combined || items.length === 0) {
    return null;
  }

  for (const candidate of buildExactHighlightCandidates(issue)) {
    const normalizedCandidate = normalizeForExactMatch(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const matchStart = findMatchStarts(combined, normalizedCandidate)[0];
    if (matchStart == null) {
      continue;
    }

    const matchEnd = matchStart + normalizedCandidate.length;
    const highlights = items
      .filter((item) => item.end > matchStart && item.start < matchEnd)
      .map((item) => {
        const itemLength = Math.max(1, item.normalizedText.length);
        return {
          itemIndex: item.itemIndex,
          startRatio: clamp((matchStart - item.start) / itemLength, 0, 1),
          endRatio: clamp((matchEnd - item.start) / itemLength, 0, 1),
        };
      })
      .filter((highlight) => highlight.endRatio > highlight.startRatio);

    if (highlights.length === 0) {
      continue;
    }

    return { candidate, highlights };
  }

  return null;
}

function textItemToHighlightRect(page: PDFPage, textItem: PdfTextItem, highlight: TextHighlight): Rect | null {
  const transform = textItem.transform;
  const xBase = Number(transform[4]);
  const yBase = Number(transform[5]);
  const textWidth = Number(textItem.width ?? 0);
  const textHeight = Math.max(
    Math.abs(Number(transform[3] ?? 0)),
    Math.abs(Number(transform[0] ?? 0)),
    Number(textItem.height ?? 0),
    8,
  );

  if (!Number.isFinite(xBase) || !Number.isFinite(yBase) || !Number.isFinite(textWidth) || textWidth <= 0) {
    return null;
  }

  const highlightStart = textWidth * highlight.startRatio;
  const highlightWidth = Math.max(6, textWidth * (highlight.endRatio - highlight.startRatio));
  const x = clamp(xBase + highlightStart - 1.5, 0, page.getWidth() - 2);
  const y = clamp(yBase - 2, 0, page.getHeight() - 2);
  const width = clamp(highlightWidth + 3, 2, page.getWidth() - x);
  const height = clamp(textHeight + 4, 2, page.getHeight() - y);

  return { x, y, width, height };
}

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const bottom = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const top = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: bottom,
    width: right - left,
    height: top - bottom,
  };
}

function isSafeHighlightRect(page: PDFPage, rect: Rect, contentWidth: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > contentWidth || rect.y + rect.height > page.getHeight()) {
    return false;
  }

  const pageArea = Math.max(1, contentWidth * page.getHeight());
  const rectArea = rect.width * rect.height;
  const looksLikeVerticalExtractionArtefact = rect.height > 36 && rect.height > rect.width * 2;
  const isImplausiblyLarge = rectArea > pageArea * 0.08 || rect.height > page.getHeight() * 0.18;

  return !looksLikeVerticalExtractionArtefact && !isImplausiblyLarge;
}

function filterSafeHighlightRects(page: PDFPage, rects: Rect[], contentWidth: number): Rect[] {
  return rects.filter((rect) => isSafeHighlightRect(page, rect, contentWidth));
}

function rectsOverlap(a: Rect, b: Rect, padding = 2): boolean {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}

function drawHighlightRects(page: PDFPage, rects: Rect[]): void {
  for (const rect of rects) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color: rgb(1, 0.78, 0.18),
      opacity: 0.35,
      borderColor: rgb(0.96, 0.56, 0.13),
      borderWidth: 0.5,
      borderOpacity: 0.85,
    });
  }
}

function chooseIssueBadgeRect(page: PDFPage, anchor: Rect, contentWidth: number, placedBadges: Rect[]): Rect {
  const badgeSize = 13;
  const x = clamp(anchor.x + anchor.width + 3, 16, contentWidth - badgeSize - 8);
  const baseY = clamp(anchor.y + anchor.height - badgeSize / 2, 12, page.getHeight() - badgeSize - 12);
  const verticalStep = badgeSize + 3;
  const yOffsets = [0, verticalStep, -verticalStep, verticalStep * 2, -verticalStep * 2, verticalStep * 3, -verticalStep * 3];

  for (const yOffset of yOffsets) {
    const rect = {
      x,
      y: clamp(baseY + yOffset, 12, page.getHeight() - badgeSize - 12),
      width: badgeSize,
      height: badgeSize,
    };

    if (!placedBadges.some((placed) => rectsOverlap(rect, placed))) {
      return rect;
    }
  }

  return {
    x,
    y: clamp(baseY - placedBadges.length * verticalStep, 12, page.getHeight() - badgeSize - 12),
    width: badgeSize,
    height: badgeSize,
  };
}

function drawIssueBadge(
  page: PDFPage,
  anchor: Rect,
  issueNumber: number,
  contentWidth: number,
  font: PDFFont,
  placedBadges: Rect[],
): void {
  const badge = chooseIssueBadgeRect(page, anchor, contentWidth, placedBadges);
  page.drawRectangle({
    x: badge.x,
    y: badge.y,
    width: badge.width,
    height: badge.height,
    color: rgb(0.82, 0.32, 0.02),
    borderColor: rgb(1, 1, 1),
    borderWidth: 0.8,
    opacity: 0.95,
    borderOpacity: 1,
  });
  page.drawText(String(issueNumber), {
    x: badge.x + (issueNumber >= 10 ? 2.4 : 4.5),
    y: badge.y + 3.2,
    size: issueNumber >= 10 ? 5.6 : 6.4,
    font,
    color: rgb(1, 1, 1),
  });
  placedBadges.push(badge);
}

type PreparedIssue = {
  issue: NumberedIssue;
  match: HighlightMatch | null;
  highlightRects: Rect[];
};

type IssuePlacementStatus = "highlighted" | "page_only" | "not_placed";

function issuePlacementLabel(status: IssuePlacementStatus): string {
  if (status === "highlighted") {
    return "Highlighted on source page";
  }

  if (status === "page_only") {
    return "Listed on source page; text anchor not found";
  }

  return "Not placed on source page; listed in appendix";
}

function drawIssueCard(
  page: PDFPage,
  preparedIssue: PreparedIssue,
  card: Rect,
  fonts: { regular: PDFFont; bold: PDFFont },
): void {
  const { issue, match } = preparedIssue;
  const matched = Boolean(match);
  const contentX = card.x + 12;
  const contentWidth = card.width - 24;
  const topY = card.y + card.height;

  page.drawRectangle({
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    color: rgb(1, 1, 1),
    borderColor: matched ? rgb(0.93, 0.58, 0.2) : rgb(0.78, 0.81, 0.86),
    borderWidth: 0.8,
    opacity: 0.98,
    borderOpacity: 1,
  });
  page.drawRectangle({
    x: card.x,
    y: card.y,
    width: 4,
    height: card.height,
    color: matched ? rgb(0.91, 0.42, 0.08) : rgb(0.55, 0.6, 0.67),
  });
  page.drawRectangle({
    x: contentX,
    y: topY - 22,
    width: 16,
    height: 16,
    color: matched ? rgb(0.82, 0.32, 0.02) : rgb(0.41, 0.45, 0.52),
  });
  page.drawText(String(issue.issueNumber), {
    x: contentX + (issue.issueNumber >= 10 ? 3 : 5.5),
    y: topY - 17.4,
    size: issue.issueNumber >= 10 ? 6.2 : 7,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(formatIssueType(issue.type), {
    x: contentX + 23,
    y: topY - 16.5,
    size: 8.2,
    font: fonts.bold,
    color: rgb(0.1, 0.12, 0.16),
  });
  page.drawText(matched ? "Highlighted" : "Page issue", {
    x: contentX + 23,
    y: topY - 27.5,
    size: 6.4,
    font: fonts.regular,
    color: matched ? rgb(0.21, 0.45, 0.18) : rgb(0.42, 0.46, 0.53),
  });

  let cursorY = topY - 41;
  cursorY = drawWrappedText(page, issue.description || "Issue detected.", {
    x: contentX,
    y: cursorY,
    maxWidth: contentWidth,
    font: fonts.regular,
    size: 7.2,
    lineHeight: 8.4,
    maxLines: 1,
  });
  drawWrappedText(page, `Fix: ${resolveIssueSuggestion(issue)}`, {
    x: contentX,
    y: cursorY - 1,
    maxWidth: contentWidth,
    font: fonts.regular,
    size: 6.6,
    lineHeight: 7.6,
    maxLines: 2,
  });
}

function drawOverflowNote(page: PDFPage, overflowCount: number, font: PDFFont, contentWidth: number): void {
  if (overflowCount <= 0) {
    return;
  }

  const x = contentWidth + ANNOTATION_MARGIN_GAP;
  const width = page.getWidth() - x - ANNOTATION_MARGIN_INSET;
  page.drawRectangle({
    x,
    y: 18,
    width,
    height: 28,
    color: rgb(0.93, 0.94, 0.96),
    borderColor: rgb(0.78, 0.81, 0.86),
    borderWidth: 0.7,
    opacity: 0.95,
  });
  page.drawText(`${overflowCount} additional issue${overflowCount === 1 ? "" : "s"} could not fit on this page.`, {
    x: x + 10,
    y: 29,
    size: 7,
    font,
    color: rgb(0.32, 0.35, 0.41),
  });
}

function drawAnnotationMargin(page: PDFPage, originalWidth: number, issueCount: number, font: PDFFont): void {
  const originalHeight = page.getHeight();
  page.setSize(originalWidth + ANNOTATION_MARGIN_WIDTH, originalHeight);
  page.drawRectangle({
    x: originalWidth,
    y: 0,
    width: ANNOTATION_MARGIN_WIDTH,
    height: originalHeight,
    color: rgb(0.97, 0.98, 0.99),
    opacity: 1,
  });
  page.drawLine({
    start: { x: originalWidth, y: 0 },
    end: { x: originalWidth, y: originalHeight },
    thickness: 0.7,
    color: rgb(0.86, 0.88, 0.91),
  });
  page.drawText("QC Issues", {
    x: originalWidth + ANNOTATION_MARGIN_GAP,
    y: originalHeight - 21,
    size: 10,
    font,
    color: rgb(0.09, 0.11, 0.16),
  });
  page.drawText(`${issueCount} issue${issueCount === 1 ? "" : "s"} on this page`, {
    x: originalWidth + ANNOTATION_MARGIN_GAP,
    y: originalHeight - 34,
    size: 7,
    font,
    color: rgb(0.36, 0.4, 0.47),
  });
  page.drawLine({
    start: { x: originalWidth + ANNOTATION_MARGIN_GAP, y: originalHeight - 46 },
    end: { x: originalWidth + ANNOTATION_MARGIN_WIDTH - ANNOTATION_MARGIN_INSET, y: originalHeight - 46 },
    thickness: 0.5,
    color: rgb(0.86, 0.88, 0.91),
  });
}

function getNormalizedPageRotationAngle(page: PDFPage): number {
  const angle = page.getRotation().angle;
  return ((angle % 360) + 360) % 360;
}

async function replaceRotatedPageWithUprightAnnotationPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  sourcePage: PDFPage,
): Promise<{ page: PDFPage; contentWidth: number }> {
  const rotation = getNormalizedPageRotationAngle(sourcePage);
  const sourceWidth = sourcePage.getWidth();
  const sourceHeight = sourcePage.getHeight();
  const visualWidth = rotation === 90 || rotation === 270 ? sourceHeight : sourceWidth;
  const visualHeight = rotation === 90 || rotation === 270 ? sourceWidth : sourceHeight;
  const embeddedSourcePage = await pdfDoc.embedPage(sourcePage);
  const annotationPage = pdfDoc.insertPage(pageIndex, [visualWidth + ANNOTATION_MARGIN_WIDTH, visualHeight]);

  if (rotation === 90) {
    annotationPage.drawPage(embeddedSourcePage, {
      x: 0,
      y: sourceWidth,
      width: sourceWidth,
      height: sourceHeight,
      rotate: degrees(270),
    });
  } else if (rotation === 180) {
    annotationPage.drawPage(embeddedSourcePage, {
      x: sourceWidth,
      y: sourceHeight,
      width: sourceWidth,
      height: sourceHeight,
      rotate: degrees(180),
    });
  } else if (rotation === 270) {
    annotationPage.drawPage(embeddedSourcePage, {
      x: sourceHeight,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
      rotate: degrees(90),
    });
  } else {
    annotationPage.drawPage(embeddedSourcePage, {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    });
  }

  pdfDoc.removePage(pageIndex + 1);

  return { page: annotationPage, contentWidth: visualWidth };
}

async function readPdfTextItemsByPage(sourceBytes: ArrayBuffer, pageNumbers: number[]): Promise<Map<number, unknown[]>> {
  const textItemsByPage = new Map<number, unknown[]>();

  try {
    const loadingTask = getDocument({
      data: new Uint8Array(sourceBytes.slice(0)),
    });
    const pdf = await loadingTask.promise;

    try {
      for (const pageNumber of pageNumbers) {
        try {
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          textItemsByPage.set(pageNumber, textContent.items);
        } catch {
          textItemsByPage.set(pageNumber, []);
        }
      }
    } finally {
      await pdf.destroy();
    }
  } catch {
    return textItemsByPage;
  }

  return textItemsByPage;
}

function drawPageIssues(
  page: PDFPage,
  issues: NumberedIssue[],
  textItems: unknown[],
  fonts: { regular: PDFFont; bold: PDFFont },
  contentWidth: number,
): { annotated: number; skipped: number; placements: Map<string, IssuePlacementStatus> } {
  const indexedItems = textItems.filter(isPdfTextItem);
  const maxCards = Math.max(1, Math.floor((page.getHeight() - 74) / (ISSUE_CARD_HEIGHT + ISSUE_CARD_GAP)));
  const visibleIssues = issues.slice(0, maxCards);
  const skipped = issues.length - visibleIssues.length;
  const preparedIssues: PreparedIssue[] = [];
  const placedBadges: Rect[] = [];
  const placements = new Map<string, IssuePlacementStatus>();

  for (const issue of visibleIssues) {
    const match = findHighlightMatch(textItems, issue);
    const highlightRects = filterSafeHighlightRects(page, match
      ? match.highlights
          .map((highlight) => {
            const textItem = indexedItems.find((item) => item === textItems[highlight.itemIndex]);
            return textItem ? textItemToHighlightRect(page, textItem, highlight) : null;
          })
          .filter((rect): rect is Rect => Boolean(rect))
      : [], contentWidth);
    const effectiveMatch = highlightRects.length > 0 ? match : null;

    if (highlightRects.length > 0) {
      drawHighlightRects(page, highlightRects);
      const anchor = unionRects(highlightRects);
      if (anchor) {
        drawIssueBadge(page, anchor, issue.issueNumber, contentWidth, fonts.bold, placedBadges);
      }
    }

    preparedIssues.push({
      issue,
      match: effectiveMatch,
      highlightRects,
    });
    placements.set(issue.id, effectiveMatch ? "highlighted" : "page_only");
  }

  for (const issue of issues.slice(maxCards)) {
    placements.set(issue.id, "not_placed");
  }

  const cardX = contentWidth + ANNOTATION_MARGIN_GAP;
  const cardWidth = page.getWidth() - cardX - ANNOTATION_MARGIN_INSET;
  let cardY = page.getHeight() - 56 - ISSUE_CARD_HEIGHT;

  for (const preparedIssue of preparedIssues) {
    drawIssueCard(page, preparedIssue, {
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: ISSUE_CARD_HEIGHT,
    }, fonts);
    cardY -= ISSUE_CARD_HEIGHT + ISSUE_CARD_GAP;
  }

  drawOverflowNote(page, skipped, fonts.regular, contentWidth);

  return { annotated: preparedIssues.length, skipped, placements };
}

function drawPageIssueCardsOnly(
  page: PDFPage,
  issues: NumberedIssue[],
  fonts: { regular: PDFFont; bold: PDFFont },
  contentWidth: number,
): { annotated: number; skipped: number; placements: Map<string, IssuePlacementStatus> } {
  const maxCards = Math.max(1, Math.floor((page.getHeight() - 74) / (ISSUE_CARD_HEIGHT + ISSUE_CARD_GAP)));
  const visibleIssues = issues.slice(0, maxCards);
  const skipped = issues.length - visibleIssues.length;
  const placements = new Map<string, IssuePlacementStatus>();
  const cardX = contentWidth + ANNOTATION_MARGIN_GAP;
  const cardWidth = page.getWidth() - cardX - ANNOTATION_MARGIN_INSET;
  let cardY = page.getHeight() - 56 - ISSUE_CARD_HEIGHT;

  for (const issue of visibleIssues) {
    drawIssueCard(
      page,
      {
        issue,
        match: null,
        highlightRects: [],
      },
      {
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: ISSUE_CARD_HEIGHT,
      },
      fonts,
    );
    placements.set(issue.id, "page_only");
    cardY -= ISSUE_CARD_HEIGHT + ISSUE_CARD_GAP;
  }

  for (const issue of issues.slice(maxCards)) {
    placements.set(issue.id, "not_placed");
  }

  drawOverflowNote(page, skipped, fonts.regular, contentWidth);

  return { annotated: visibleIssues.length, skipped, placements };
}

function drawIssueIndexHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  pageNumber: number,
): number {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  page.drawText("QC Issue Index", {
    x: 42,
    y: pageHeight - 48,
    size: 18,
    font: fonts.bold,
    color: rgb(0.09, 0.11, 0.16),
  });
  page.drawText(`Appendix page ${pageNumber}`, {
    x: pageWidth - 140,
    y: pageHeight - 44,
    size: 8,
    font: fonts.regular,
    color: rgb(0.36, 0.4, 0.47),
  });
  page.drawText(
    "This appendix lists every QC issue in the export. Some issues cannot be highlighted because the issue text",
    {
      x: 42,
      y: pageHeight - 70,
      size: 8.5,
      font: fonts.regular,
      color: rgb(0.26, 0.3, 0.36),
    },
  );
  page.drawText(
    "was not found in the extracted PDF text, the page reference was missing, or the source page had too many issue cards.",
    {
      x: 42,
      y: pageHeight - 82,
      size: 8.5,
      font: fonts.regular,
      color: rgb(0.26, 0.3, 0.36),
    },
  );
  page.drawLine({
    start: { x: 42, y: pageHeight - 100 },
    end: { x: pageWidth - 42, y: pageHeight - 100 },
    thickness: 0.7,
    color: rgb(0.82, 0.85, 0.89),
  });

  return pageHeight - 126;
}

function drawIssueIndexRow(
  page: PDFPage,
  issue: NumberedIssue,
  status: IssuePlacementStatus,
  fonts: { regular: PDFFont; bold: PDFFont },
  y: number,
): number {
  const x = 42;
  const width = page.getWidth() - 84;
  const rowHeight = 86;
  const statusColor =
    status === "highlighted"
      ? rgb(0.2, 0.48, 0.24)
      : status === "page_only"
        ? rgb(0.72, 0.39, 0.05)
        : rgb(0.44, 0.48, 0.55);

  page.drawRectangle({
    x,
    y: y - rowHeight + 10,
    width,
    height: rowHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.84, 0.87, 0.91),
    borderWidth: 0.7,
  });
  page.drawRectangle({
    x,
    y: y - rowHeight + 10,
    width: 5,
    height: rowHeight,
    color: statusColor,
  });
  page.drawText(`#${issue.issueNumber}`, {
    x: x + 14,
    y: y - 9,
    size: 9,
    font: fonts.bold,
    color: rgb(0.09, 0.11, 0.16),
  });
  page.drawText(formatIssueType(issue.type), {
    x: x + 52,
    y: y - 9,
    size: 9,
    font: fonts.bold,
    color: rgb(0.09, 0.11, 0.16),
  });
  page.drawText(issue.pageNumber == null ? "Page unknown" : `Page ${issue.pageNumber}`, {
    x: x + 230,
    y: y - 9,
    size: 8,
    font: fonts.regular,
    color: rgb(0.36, 0.4, 0.47),
  });
  page.drawText(issuePlacementLabel(status), {
    x: x + 330,
    y: y - 9,
    size: 8,
    font: fonts.bold,
    color: statusColor,
  });

  let cursorY = y - 28;
  cursorY = drawWrappedText(page, issue.description || "Issue detected.", {
    x: x + 14,
    y: cursorY,
    maxWidth: width - 28,
    font: fonts.regular,
    size: 8,
    lineHeight: 9.5,
    maxLines: 2,
  });
  drawWrappedText(page, `Evidence: ${issue.context || issue.location || "No evidence snippet available."}`, {
    x: x + 14,
    y: cursorY - 3,
    maxWidth: width - 28,
    font: fonts.regular,
    size: 7.2,
    color: rgb(0.36, 0.4, 0.47),
    lineHeight: 8.4,
    maxLines: 2,
  });

  return y - rowHeight - 10;
}

function drawIssueIndexAppendix(
  pdfDoc: PDFDocument,
  issues: NumberedIssue[],
  placements: Map<string, IssuePlacementStatus>,
  fonts: { regular: PDFFont; bold: PDFFont },
): void {
  if (issues.length === 0) {
    return;
  }

  let pageIndex = 1;
  let page = pdfDoc.addPage([612, 792]);
  let cursorY = drawIssueIndexHeader(page, fonts, pageIndex);

  for (const issue of issues) {
    if (cursorY < 116) {
      pageIndex += 1;
      page = pdfDoc.addPage([612, 792]);
      cursorY = drawIssueIndexHeader(page, fonts, pageIndex);
    }

    cursorY = drawIssueIndexRow(page, issue, placements.get(issue.id) ?? "not_placed", fonts, cursorY);
  }
}

export async function buildAnnotatedPdfExport(params: AnnotatedPdfExportParams): Promise<AnnotatedPdfExportResult> {
  const generatedAt = params.generatedAt ?? new Date();
  const sourceBytes = await params.sourceFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const numberedIssues = params.issues.map((issue, index) => ({ ...issue, issueNumber: index + 1 }));
  const issuesByPage = new Map<number, NumberedIssue[]>();
  const placements = new Map<string, IssuePlacementStatus>();
  let skippedIssueCount = 0;

  for (const issue of numberedIssues) {
    if (issue.pageNumber == null || issue.pageNumber < 1 || issue.pageNumber > pages.length) {
      placements.set(issue.id, "not_placed");
      skippedIssueCount += 1;
      continue;
    }

    const pageIssues = issuesByPage.get(issue.pageNumber) ?? [];
    pageIssues.push(issue);
    issuesByPage.set(issue.pageNumber, pageIssues);
  }

  const pageNumbers = Array.from(issuesByPage.keys()).sort((a, b) => a - b);
  const textItemsByPage = await readPdfTextItemsByPage(sourceBytes, pageNumbers);
  let annotatedIssueCount = 0;

  for (const pageNumber of pageNumbers) {
    const page = pages[pageNumber - 1];
    const pageIssues = issuesByPage.get(pageNumber) ?? [];
    if (!page || pageIssues.length === 0) {
      continue;
    }

    if (getNormalizedPageRotationAngle(page) !== 0) {
      const normalized = await replaceRotatedPageWithUprightAnnotationPage(pdfDoc, pageNumber - 1, page);
      drawAnnotationMargin(normalized.page, normalized.contentWidth, pageIssues.length, bold);
      const result = drawPageIssueCardsOnly(normalized.page, pageIssues, { regular, bold }, normalized.contentWidth);
      annotatedIssueCount += result.annotated;
      skippedIssueCount += result.skipped;
      for (const [issueId, placement] of result.placements) {
        placements.set(issueId, placement);
      }
      continue;
    }

    const originalWidth = page.getWidth();
    drawAnnotationMargin(page, originalWidth, pageIssues.length, bold);
    const result = drawPageIssues(page, pageIssues, textItemsByPage.get(pageNumber) ?? [], { regular, bold }, originalWidth);
    annotatedIssueCount += result.annotated;
    skippedIssueCount += result.skipped;
    for (const [issueId, placement] of result.placements) {
      placements.set(issueId, placement);
    }
  }

  drawIssueIndexAppendix(pdfDoc, numberedIssues, placements, { regular, bold });

  const annotatedBytes = await pdfDoc.save();
  return {
    blob: new Blob([toArrayBuffer(annotatedBytes)], { type: "application/pdf" }),
    fileName: buildAnnotatedFileName(params.reportFileName, params.reportId, generatedAt),
    annotatedIssueCount,
    skippedIssueCount,
  };
}
