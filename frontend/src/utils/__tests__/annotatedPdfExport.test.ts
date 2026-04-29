import { describe, expect, it } from "vitest";
import { degrees, PDFDocument, StandardFonts } from "pdf-lib";

import { buildAnnotatedPdfExport } from "../annotatedPdfExport";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function makeSourcePdfFile(name = "source.pdf") {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([420, 560]);
  page.drawText("Review date is XX/XX/XX and assessor reference is REF.", {
    x: 48,
    y: 480,
    size: 12,
    font,
  });
  page.drawText("The building description still says [BUILDING DESCRIPTION].", {
    x: 48,
    y: 450,
    size: 12,
    font,
  });
  const bytes = await pdfDoc.save();
  return new File([toArrayBuffer(bytes)], name, { type: "application/pdf" });
}

async function makeRotatedSourcePdfFile(name = "rotated-source.pdf") {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([420, 560]);
  page.setRotation(degrees(90));
  page.drawText("The rotated page includes placeholder XX content.", {
    x: 48,
    y: 480,
    size: 12,
    font,
  });
  const bytes = await pdfDoc.save();
  return new File([toArrayBuffer(bytes)], name, { type: "application/pdf" });
}

describe("buildAnnotatedPdfExport", () => {
  it("creates an annotated copy on the original PDF pages", async () => {
    const sourceFile = await makeSourcePdfFile("Fire Risk Assessment.pdf");

    const result = await buildAnnotatedPdfExport({
      sourceFile,
      reportId: "rep_123",
      reportFileName: "Fire Risk Assessment.pdf",
      generatedAt: new Date("2026-03-20T12:00:00.000Z"),
      issues: [
        {
          id: "issue-1",
          type: "TEMPLATE_ARTIFACT",
          description: "Placeholder value detected.",
          location: "1. Summary",
          context: "Review date is XX/XX/XX and assessor reference is REF.",
          suggestion: "",
          pageNumber: 1,
        },
      ],
    });

    const outputBytes = new Uint8Array(await result.blob.arrayBuffer());

    expect(result.fileName).toBe(
      "Fire-Risk-Assessment__rep_123__annotated-qc__generated-2026-03-20T12-00-00Z.pdf",
    );
    expect(result.annotatedIssueCount).toBe(1);
    expect(result.skippedIssueCount).toBe(0);
    expect(new TextDecoder().decode(outputBytes.slice(0, 4))).toBe("%PDF");

    const sourcePdf = await PDFDocument.load(await sourceFile.arrayBuffer());
    const outputPdf = await PDFDocument.load(outputBytes);
    expect(outputPdf.getPageCount()).toBe(sourcePdf.getPageCount() + 1);
    expect(outputPdf.getPage(0).getWidth()).toBeGreaterThan(sourcePdf.getPage(0).getWidth());
    expect(outputBytes.byteLength).toBeGreaterThan(sourceFile.size);
  });

  it("counts issues that cannot be anchored to a source PDF page", async () => {
    const sourceFile = await makeSourcePdfFile();

    const result = await buildAnnotatedPdfExport({
      sourceFile,
      reportId: "rep_456",
      reportFileName: "Report.pdf",
      generatedAt: new Date("2026-03-20T12:00:00.000Z"),
      issues: [
        {
          id: "issue-no-page",
          type: "MISSING_INFORMATION",
          description: "Missing required detail.",
          location: "Unknown",
          context: "",
          suggestion: "Add the missing detail.",
          pageNumber: null,
        },
        {
          id: "issue-out-of-range",
          type: "CONTRADICTION",
          description: "Conflicting statements.",
          location: "Page 9",
          context: "",
          suggestion: "Resolve the conflict.",
          pageNumber: 9,
        },
      ],
    });

    expect(result.annotatedIssueCount).toBe(0);
    expect(result.skippedIssueCount).toBe(2);
    const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
    const sourcePdf = await PDFDocument.load(await sourceFile.arrayBuffer());
    const outputPdf = await PDFDocument.load(outputBytes);
    expect(outputPdf.getPageCount()).toBe(sourcePdf.getPageCount() + 1);
  });

  it("lists rotated source page issues in a side margin without source highlights", async () => {
    const sourceFile = await makeRotatedSourcePdfFile();

    const result = await buildAnnotatedPdfExport({
      sourceFile,
      reportId: "rep_rotated",
      reportFileName: "Rotated Report.pdf",
      generatedAt: new Date("2026-03-20T12:00:00.000Z"),
      issues: [
        {
          id: "issue-rotated",
          type: "TEMPLATE_ARTIFACT",
          description: "Placeholder on a rotated source page.",
          location: "Page 1",
          context: "The rotated page includes placeholder XX content.",
          suggestion: "Replace the placeholder.",
          pageNumber: 1,
        },
      ],
    });

    const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
    const sourcePdf = await PDFDocument.load(await sourceFile.arrayBuffer());
    const outputPdf = await PDFDocument.load(outputBytes);

    expect(result.annotatedIssueCount).toBe(1);
    expect(result.skippedIssueCount).toBe(0);
    expect(outputPdf.getPage(0).getWidth()).toBeGreaterThan(sourcePdf.getPage(0).getWidth());
    expect(outputPdf.getPage(0).getHeight()).toBe(sourcePdf.getPage(0).getWidth());
    expect(outputPdf.getPage(0).getRotation().angle).toBe(0);
    expect(outputPdf.getPageCount()).toBe(sourcePdf.getPageCount() + 1);
  });
});
