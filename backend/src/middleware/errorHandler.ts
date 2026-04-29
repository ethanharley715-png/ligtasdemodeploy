import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ApiError } from "../errors/apiError";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
    });
  }

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      code: "file_too_large",
      message: "Uploaded file exceeds the maximum allowed size.",
    });
  }

  const fallbackMessage = "An unexpected server error occurred.";

  console.error("[api] unhandled error", {
    path: req.path,
    method: req.method,
    errorName: err instanceof Error ? err.name : "unknown_error",
  });

  return res.status(500).json({
    code: "internal_error",
    message: fallbackMessage,
  });
};
