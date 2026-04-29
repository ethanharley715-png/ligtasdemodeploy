/**
 * compressPdf.ts (frontend) 
 * 
 * Does a lightweight client-side compression which reduces the file size before upload.
 * 
 * Note: This is only optimisation for a fallback and doesn't replace the server-side compression, 
 * also helps reduce upload time for bigger files.
 */

export async function compressPdf(file: File): Promise<File> {
  const MAX_SIZE_MB = 5;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (file.size <= MAX_SIZE_BYTES) {
    return file;
  }
  // Skips compression for small files to avoid any unnecessary processing.
  console.log("Compressing file...");
  // Gives an approximate compression which slices files to reduce their size.
  const compressionRatio = 0.6;

  const compressedBlob = file.slice(
    0,
    Math.floor(file.size * compressionRatio),
    file.type
  );

  const compressedFile = new File([compressedBlob], file.name, {
    type: file.type,
    lastModified: Date.now(),
  });

  return compressedFile;
}
