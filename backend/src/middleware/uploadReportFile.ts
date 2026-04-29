import multer from "multer";
import { reportUploadConfig } from "../config/reportUploadConfig";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: reportUploadConfig.maxReportFileSizeBytes,
    files: 1,
  },
});

/*Compress PDF using Ghostscript*/
export async function compressPdf(buffer: Buffer): Promise<Buffer> {
  const tempDir = os.tmpdir();

  const inputPath = path.join(tempDir, `input-${Date.now()}.pdf`);
  const outputPath = path.join(tempDir, `output-${Date.now()}.pdf`);

  const command = `gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

  try {
    await fs.promises.writeFile(inputPath, buffer);
    await execAsync(command);

    const compressed = await fs.promises.readFile(outputPath);

    return compressed;
  } catch {
    console.warn("PDF compression has failed, using original file");
    return buffer; 
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
  }
}

export const uploadReportFile = [
  upload.single("file"),

  async (req: any, res: any, next: any) => {
    if (!req.file) return next();

    try {
      const originalSize = req.file.buffer.length;

      const compressedBuffer = await compressPdf(req.file.buffer);

      const compressedSize = compressedBuffer.length;

      console.log(
        `📦 PDF compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
      );

      req.file.buffer = compressedBuffer;

      next();
    } catch (err) {
      console.error("Compression error:", err);
      next(); 
    }
  },
];
