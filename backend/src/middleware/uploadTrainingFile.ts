import multer from "multer";
import { reportUploadConfig } from "../config/reportUploadConfig";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: reportUploadConfig.maxReportFileSizeBytes,
    files: 1,
  },
});

export const uploadTrainingFile = upload.single("file");
