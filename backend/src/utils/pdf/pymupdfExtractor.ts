import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pdfExtractionConfig } from "../../config/pdfExtractionConfig";
import { ApiError } from "../../errors/apiError";
import type { ExtractedReportText } from "./extractReportText";

type PythonExtractorBlock = {
  text: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  block_index?: number;
};

type PythonExtractorPage = {
  page_number: number;
  width?: number;
  height?: number;
  text: string;
  blocks?: PythonExtractorBlock[];
};

type PythonExtractorResult = {
  text: string;
  pages: PythonExtractorPage[];
};

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function resolveScriptPath(): string {
  if (path.isAbsolute(pdfExtractionConfig.scriptPath)) {
    return pdfExtractionConfig.scriptPath;
  }

  return path.resolve(process.cwd(), pdfExtractionConfig.scriptPath);
}

async function runPythonExtractor(pdfPath: string): Promise<PythonExtractorResult> {
  const child = spawn(
    pdfExtractionConfig.pythonCommand,
    [resolveScriptPath(), pdfPath],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);

    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `PyMuPDF extractor failed with exit code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as PythonExtractorResult);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function mapExtractorResult(result: PythonExtractorResult): ExtractedReportText {
  const pages = (result.pages ?? []).map((page) => ({
    pageNumber: Number(page.page_number),
    text: normalizeText(page.text),
    width: Number.isFinite(page.width) ? Number(page.width) : undefined,
    height: Number.isFinite(page.height) ? Number(page.height) : undefined,
  }));

  return {
    text: normalizeText(pages.map((page) => page.text).join("\n\n") || result.text || ""),
    pages,
  };
}

export async function extractReportTextWithPyMuPdf(pdfBuffer: Buffer): Promise<ExtractedReportText> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ligtas-pymupdf-"));
  const pdfPath = path.join(tempDir, "upload.pdf");

  try {
    await writeFile(pdfPath, pdfBuffer);
    return mapExtractorResult(await runPythonExtractor(pdfPath));
  } catch (error) {
    console.warn("[pdf-extract] pymupdf extraction failed", {
      scriptPath: resolveScriptPath(),
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new ApiError(500, "internal_error", "Failed to extract text from uploaded PDF.");
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
