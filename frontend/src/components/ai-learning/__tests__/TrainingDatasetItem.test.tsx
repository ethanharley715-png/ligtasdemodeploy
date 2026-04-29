import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrainingDatasetItem } from "../TrainingDatasetItem";

describe("TrainingDatasetItem", () => {
  const goodProps = {
    fileName: "good-report.pdf",
    id: "ex-1",
    uploadDate: "2026-01-15",
    type: "good" as const,
    status: "PROCESSED",
  };

  const badProps = {
    fileName: "bad-report.pdf",
    id: "ex-2",
    uploadDate: "2026-01-16",
    type: "bad" as const,
    status: "PENDING",
  };

  it("renders fileName and uploadDate without the issue count", () => {
    render(<TrainingDatasetItem {...goodProps} />);

    expect(screen.getByText("good-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("Uploaded: 2026-01-15")).toBeInTheDocument();
    expect(screen.queryByText(/Issues:/)).not.toBeInTheDocument();
  });

  it('shows "GOOD" badge for type good', () => {
    render(<TrainingDatasetItem {...goodProps} />);
    expect(screen.getByText("GOOD")).toBeInTheDocument();
  });

  it('shows "BAD" badge for type bad', () => {
    render(<TrainingDatasetItem {...badProps} />);
    expect(screen.getByText("BAD")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    render(<TrainingDatasetItem {...goodProps} />);
    expect(screen.getByText("PROCESSED")).toBeInTheDocument();
  });
});
