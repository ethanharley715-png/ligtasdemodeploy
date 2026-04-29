/**
 * compressPdf.ts 
 * 
 * Compresses uploaded PDF files using Ghostscript before storage.
 * 
 * . The design decisions I made here include:
 * . Compression which is applied to the server-side to ensure consistency regardless of the client's device.
 * . The original file is then replaced to avoid duplication and reduce storage usage.
 * 
 * Overall this improves performance, storage efficiency, and upload scalability.
 */

import { exec } from "child_process";
import fs from "fs";
import util from "util";

const execAsync = util.promisify(exec);

export async function compressPdf(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(".pdf", "-compressed.pdf");
  // The ghostscript command for PDF compression which uses ebook level quality, also balances file size reduction with readability.
  const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
-dPDFSETTINGS=/ebook \
-dNOPAUSE -dQUIET -dBATCH \
-sOutputFile="${outputPath}" "${inputPath}"`;

  try {
    await execAsync(command);

    
    fs.unlinkSync(inputPath); // Replace the original file with a compressed version which minimises storage usage.
    fs.renameSync(outputPath, inputPath);

    return inputPath;
  } catch (error) { // If the compression fails then the fallback to the original file occurs which prevents upload failure.
    console.error("PDF compression failed:", error);
    return inputPath; 
  }
}