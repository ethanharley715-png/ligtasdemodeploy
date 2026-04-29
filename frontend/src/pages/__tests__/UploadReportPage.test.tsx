import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import UploadReportPage from "../UploadReportPage";
import { UploadContext, type UploadContextType } from "../../context/Upload-Context";

// Mock useLanguage
vi.mock("../../context/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));



function renderWithUploadContext(overrides = {}) {
  const defaultValue: UploadContextType = {
    startUpload: vi.fn(),
    uploadState: "idle",
    setUploadState: vi.fn(),
    errorMessage: "",
    setErrorMessage: vi.fn(),
    result: null,
    setResult: vi.fn(),
    cancelUpload: vi.fn(),
    uploadProgress: 0,
    abortControllerRef: { current: null },
    startTime: 0,
    setStartTime: vi.fn(),
    ...overrides,
  };

  return render(
    <UploadContext.Provider value={defaultValue}>
      <UploadReportPage />
    </UploadContext.Provider>
  );
}

describe("UploadReportPage", () => {
  it("renders and disables upload button initially", () => {
    renderWithUploadContext();

    const button = screen.getByRole("button", {
      name: /uploadReport/i,
    });

    expect(button).toBeDisabled();
  });

  it("enables upload button after selecting a file", () => {
    renderWithUploadContext();

    const file = new File(["dummy"], "test.pdf", {
      type: "application/pdf",
    });

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [file] },
    });

    const button = screen.getByRole("button", {
      name: /uploadReport/i,
    });

    expect(button).toBeEnabled();
  });

  it("shows selected file name", () => {
    renderWithUploadContext();

    const file = new File(["dummy"], "example.pdf", {
      type: "application/pdf",
    });

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(screen.getByText("example.pdf")).toBeInTheDocument();
  });
});