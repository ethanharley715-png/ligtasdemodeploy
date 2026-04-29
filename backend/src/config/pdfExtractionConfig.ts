export type PdfExtractionProvider = "pdf_parse" | "pymupdf";

function readProviderEnv(): PdfExtractionProvider {
  const rawValue = process.env.PDF_EXTRACTOR_PROVIDER?.trim().toLowerCase();

  if (rawValue === "pymupdf" || rawValue === "pdf_parse") {
    return rawValue;
  }

  return "pdf_parse";
}

export const pdfExtractionConfig = {
  provider: readProviderEnv(),
  pythonCommand: process.env.PYMUPDF_PYTHON_BIN?.trim() || "python",
  scriptPath: process.env.PYMUPDF_EXTRACT_SCRIPT_PATH?.trim() || "scripts/pymupdf_extract.py",
};
