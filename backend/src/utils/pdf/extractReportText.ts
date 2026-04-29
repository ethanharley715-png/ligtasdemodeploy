import pdfParse from "pdf-parse";
import { ApiError } from "../../errors/apiError";
import { pdfExtractionConfig } from "../../config/pdfExtractionConfig";
import { extractReportTextWithPyMuPdf } from "./pymupdfExtractor";

const PAGE_MARKER_PREFIX = "[[LIGTAS_PAGE:";
const PAGE_MARKER_PATTERN = /^\[\[LIGTAS_PAGE:(\d+)\]\]$/;

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
};

export type ExtractedReportText = {
  text: string;
  pages: ExtractedPdfPage[];
};

function normalizeExtractedPageText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function areSameVisualLine(previousY: number | undefined, currentY: number): boolean {
  if (previousY == null) {
    return true;
  }

  return Math.abs(previousY - currentY) <= 3;
}

export function serializeExtractedReportText(extracted: ExtractedReportText): string {
  if (extracted.pages.length === 0) {
    return extracted.text;
  }

  return extracted.pages
    .map((page) => `${PAGE_MARKER_PREFIX}${page.pageNumber}]]\n${page.text}`)
    .join("\n\n");
}

export function parseStoredExtractedReportText(storedText: string): ExtractedReportText {
  if (!storedText.includes(PAGE_MARKER_PREFIX)) {
    return {
      text: storedText,
      pages: [],
    };
  }

  const lines = storedText.replace(/\r\n/g, "\n").split("\n");
  const pages: ExtractedPdfPage[] = [];
  let currentPageNumber: number | null = null;
  let currentLines: string[] = [];

  const flushCurrentPage = () => {
    if (currentPageNumber == null) {
      return;
    }

    pages.push({
      pageNumber: currentPageNumber,
      text: normalizeExtractedPageText(currentLines.join("\n")),
    });
  };

  for (const line of lines) {
    const markerMatch = line.trim().match(PAGE_MARKER_PATTERN);
    if (markerMatch) {
      flushCurrentPage();
      currentPageNumber = Number(markerMatch[1]);
      currentLines = [];
      continue;
    }

    if (currentPageNumber != null) {
      currentLines.push(line);
    }
  }

  flushCurrentPage();

  if (pages.length === 0) {
    return {
      text: storedText,
      pages: [],
    };
  }

  return {
    text: pages.map((page) => page.text).join("\n\n").trim(),
    pages,
  };
}

async function extractReportTextWithPdfParse(pdfBuffer: Buffer): Promise<ExtractedReportText> {
  try {
    const pages: ExtractedPdfPage[] = [];

    await pdfParse(pdfBuffer, {
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });

        let lastY: number | undefined;
        let pageText = "";

        for (const item of textContent.items as Array<{ str: string; transform: number[] }>) {
          const currentY = item.transform[5];
          if (areSameVisualLine(lastY, currentY)) {
            pageText += item.str;
          } else {
            pageText += `\n${item.str}`;
          }
          lastY = currentY;
        }

        const normalized = normalizeExtractedPageText(pageText);
        pages.push({
          pageNumber: (pageData.pageIndex ?? pages.length) + 1,
          text: normalized,
        });

        return normalized;
      },
    });

    return {
      text: pages.map((page) => page.text).join("\n\n").trim(),
      pages,
    };
  } catch {
    throw new ApiError(500, "internal_error", "Failed to extract text from uploaded PDF.");
  }
}

export async function extractReportTextWithPages(pdfBuffer: Buffer): Promise<ExtractedReportText> {
  if (pdfExtractionConfig.provider === "pymupdf") {
    return extractReportTextWithPyMuPdf(pdfBuffer);
  }

  return extractReportTextWithPdfParse(pdfBuffer);
}

export async function extractReportText(pdfBuffer: Buffer): Promise<string> {
  const extracted = await extractReportTextWithPages(pdfBuffer);
  return extracted.text;
}
