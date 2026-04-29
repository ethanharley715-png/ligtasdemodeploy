
import { useContext } from "react";
import { UploadContext } from "./Upload-Context";
export function useUpload() {
    const ctx = useContext(UploadContext);
    if (!ctx) throw new Error("useUpload must be used inside UploadProvider");
    return ctx;
}