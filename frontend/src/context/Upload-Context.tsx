import { createContext } from "react";
import {
    type UploadReportSuccess
} from "../api/reportUpload";

type UploadState = "idle" | "uploading" | "success" | "error";


export interface UploadContextType {
    uploadState: UploadState;
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;

    abortControllerRef: React.RefObject<AbortController>

    uploadProgress: number;

    errorMessage: string;
    setErrorMessage: React.Dispatch<React.SetStateAction<string>>;

    result: UploadReportSuccess | null;
    setResult: React.Dispatch<React.SetStateAction<UploadReportSuccess | null>>;

    startTime: number | null;
    setStartTime: React.Dispatch<React.SetStateAction<number | null>>;

    startUpload: (file: File) => Promise<void>;
    cancelUpload: () => void;
}

export const UploadContext = createContext<UploadContextType | null>(null);
