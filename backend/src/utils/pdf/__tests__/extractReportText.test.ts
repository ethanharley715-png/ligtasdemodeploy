import { describe, expect, it, jest } from "@jest/globals";
import pdfParse from "pdf-parse";
import {
  extractReportText,
  extractReportTextWithPages,
  parseStoredExtractedReportText,
  serializeExtractedReportText,
} from "../extractReportText";

jest.mock("pdf-parse", () => jest.fn());

const mockedPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

describe("extractReportText", () => {
  it("returns extracted text when parsing succeeds", async () => {
    mockedPdfParse.mockImplementationOnce(async (_buffer, options) => {
      const pagerender = options?.pagerender;
      if (pagerender) {
        await pagerender({
          pageIndex: 0,
          getTextContent: async () => ({
            items: [
              { str: "Page 1 line 1", transform: [0, 0, 0, 0, 0, 100] },
              { str: "Page 1 line 2", transform: [0, 0, 0, 0, 0, 90] },
            ],
          }),
        });
      }
      return { text: "Extracted report text" } as never;
    });

    const result = await extractReportText(Buffer.from("%PDF-1.4\nDummy PDF", "ascii"));

    expect(result).toBe("Page 1 line 1\nPage 1 line 2");
    expect(mockedPdfParse).toHaveBeenCalledTimes(1);
  });

  it("returns per-page extracted text when requested", async () => {
    mockedPdfParse.mockImplementationOnce(async (_buffer, options) => {
      const pagerender = options?.pagerender;
      if (pagerender) {
        await pagerender({
          pageIndex: 0,
          getTextContent: async () => ({
            items: [{ str: "Page 1", transform: [0, 0, 0, 0, 0, 100] }],
          }),
        });
        await pagerender({
          pageIndex: 1,
          getTextContent: async () => ({
            items: [{ str: "Page 2", transform: [0, 0, 0, 0, 0, 100] }],
          }),
        });
      }
      return { text: "ignored" } as never;
    });

    const result = await extractReportTextWithPages(Buffer.from("%PDF-1.4\nDummy PDF", "ascii"));

    expect(result).toEqual({
      text: "Page 1\n\nPage 2",
      pages: [
        { pageNumber: 1, text: "Page 1" },
        { pageNumber: 2, text: "Page 2" },
      ],
    });
  });

  it("keeps small superscript-style vertical offsets on the same line", async () => {
    mockedPdfParse.mockImplementationOnce(async (_buffer, options) => {
      const pagerender = options?.pagerender;
      if (pagerender) {
        await pagerender({
          pageIndex: 0,
          getTextContent: async () => ({
            items: [
              { str: "Visit Date ", transform: [0, 0, 0, 0, 0, 100] },
              { str: "8", transform: [0, 0, 0, 0, 0, 100] },
              { str: "th", transform: [0, 0, 0, 0, 0, 102] },
              { str: " July 2022", transform: [0, 0, 0, 0, 0, 100] },
            ],
          }),
        });
      }
      return { text: "ignored" } as never;
    });

    const result = await extractReportTextWithPages(Buffer.from("%PDF-1.4\nDummy PDF", "ascii"));

    expect(result.pages[0]?.text).toBe("Visit Date 8th July 2022");
  });

  it("round-trips stored page markers back into page text", () => {
    const stored = serializeExtractedReportText({
      text: "Page 1\n\nPage 2",
      pages: [
        { pageNumber: 1, text: "Page 1" },
        { pageNumber: 2, text: "Page 2" },
      ],
    });

    expect(parseStoredExtractedReportText(stored)).toEqual({
      text: "Page 1\n\nPage 2",
      pages: [
        { pageNumber: 1, text: "Page 1" },
        { pageNumber: 2, text: "Page 2" },
      ],
    });
  });

  it("throws internal_error when parsing fails", async () => {
    mockedPdfParse.mockRejectedValueOnce(new Error("corrupt pdf"));

    await expect(extractReportText(Buffer.from("not-a-pdf", "utf8"))).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });
  });
});
