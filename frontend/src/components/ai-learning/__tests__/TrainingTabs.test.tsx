import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingTabs } from "../TrainingTabs";

const { mockUploadExample } = vi.hoisted(() => ({
  mockUploadExample: vi.fn(),
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../services/api", () => ({
  aiLearningApi: {
    uploadExample: mockUploadExample,
    listExamples: vi.fn().mockResolvedValue([]),
    stats: vi.fn().mockResolvedValue({}),
    pendingReview: vi.fn().mockResolvedValue(null),
    feedbackStats: vi.fn().mockResolvedValue({ positive: 0, negative: 0, satisfactionRate: 0 }),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

function getFileInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="file"]'));
}

describe("TrainingTabs", () => {
  beforeEach(() => {
    mockUploadExample.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("renders three tab triggers", () => {
    render(<TrainingTabs />);
    expect(screen.getByText("Upload Training Examples")).toBeInTheDocument();
    expect(screen.getByText("Training Dataset")).toBeInTheDocument();
    expect(screen.getByText("Provide Feedback")).toBeInTheDocument();
  });

  it("shows upload tab content by default", () => {
    render(<TrainingTabs />);
    expect(screen.getAllByText("Upload Good Example").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Upload Bad Example").length).toBeGreaterThanOrEqual(1);
  });

  it("switches to Training Dataset tab on click", async () => {
    const user = userEvent.setup();
    render(<TrainingTabs />);
    await user.click(screen.getByText("Training Dataset"));
    expect(screen.getByText("Current Training Dataset")).toBeInTheDocument();
  });

  it("switches to Provide Feedback tab on click", async () => {
    const user = userEvent.setup();
    render(<TrainingTabs />);
    await user.click(screen.getByText("Provide Feedback"));
    expect(screen.getByText("Help Improve AI Accuracy")).toBeInTheDocument();
  });

  it("shows toast.error when a non-PDF file is selected", async () => {
    render(<TrainingTabs />);
    const inputs = getFileInputs();
    const txtFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    fireEvent.change(inputs[0], { target: { files: [txtFile] } });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid file type", {
        description: 'Only PDF files are accepted. You selected "notes.txt".',
      });
    });
    expect(mockUploadExample).not.toHaveBeenCalled();
  });

  it("shows toast.error when file exceeds 50MB limit", async () => {
    render(<TrainingTabs />);
    const inputs = getFileInputs();
    const bigFile = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 60 * 1024 * 1024 });

    fireEvent.change(inputs[0], { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("File too large", {
        description: "The file exceeds the 50MB limit. Please upload a smaller PDF.",
      });
    });
    expect(mockUploadExample).not.toHaveBeenCalled();
  });

  it("calls uploadExample and toast.success on valid PDF upload", async () => {
    mockUploadExample.mockResolvedValueOnce({ id: "1", fileName: "report.pdf", type: "good", status: "PROCESSED", uploadedAt: "2026-01-01" });
    render(<TrainingTabs />);
    const inputs = getFileInputs();
    const pdfFile = new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" });

    fireEvent.change(inputs[0], { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(mockUploadExample).toHaveBeenCalledWith(pdfFile, "good");
      expect(mockToast.success).toHaveBeenCalledWith("Good example uploaded", {
        description: '"report.pdf" has been added to the training dataset.',
      });
    });
  });

  it("shows toast.error when uploadExample API rejects", async () => {
    mockUploadExample.mockRejectedValueOnce(new Error("Server error"));
    render(<TrainingTabs />);
    const inputs = getFileInputs();
    const pdfFile = new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" });

    fireEvent.change(inputs[0], { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Upload failed", {
        description: "Server error",
      });
    });
  });

  it("calls onDataChanged after successful upload", async () => {
    mockUploadExample.mockResolvedValueOnce({ id: "1", fileName: "report.pdf", type: "good", status: "PROCESSED", uploadedAt: "2026-01-01" });
    const onDataChanged = vi.fn();
    render(<TrainingTabs onDataChanged={onDataChanged} />);
    const inputs = getFileInputs();
    const pdfFile = new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" });

    fireEvent.change(inputs[0], { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("uploads bad example when using the second file input", async () => {
    mockUploadExample.mockResolvedValueOnce({ id: "2", fileName: "bad-report.pdf", type: "bad", status: "PROCESSED", uploadedAt: "2026-01-01" });
    render(<TrainingTabs />);
    const inputs = getFileInputs();
    const pdfFile = new File(["%PDF-1.4"], "bad-report.pdf", { type: "application/pdf" });

    fireEvent.change(inputs[1], { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(mockUploadExample).toHaveBeenCalledWith(pdfFile, "bad");
      expect(mockToast.success).toHaveBeenCalledWith("Bad example uploaded", {
        description: '"bad-report.pdf" has been added to the training dataset.',
      });
    });
  });
});
