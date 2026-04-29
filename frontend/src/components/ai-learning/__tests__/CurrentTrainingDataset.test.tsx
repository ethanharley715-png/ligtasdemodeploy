import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentTrainingDataset } from "../CurrentTrainingDataset";

const { mockListExamples } = vi.hoisted(() => ({
  mockListExamples: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  aiLearningApi: {
    listExamples: mockListExamples,
  },
}));

const mockItems = [
  { id: "ex-1", fileName: "good-report.pdf", uploadDate: "2026-01-15", issues: 0, type: "good" as const, status: "PROCESSED" },
  { id: "ex-2", fileName: "bad-report.pdf", uploadDate: "2026-01-16", issues: 3, type: "bad" as const, status: "PROCESSED" },
];

describe("CurrentTrainingDataset", () => {
  beforeEach(() => {
    mockListExamples.mockReset();
  });

  it("shows empty state when API returns empty array", async () => {
    mockListExamples.mockResolvedValueOnce([]);
    render(<CurrentTrainingDataset />);

    expect(await screen.findByText("No training examples uploaded yet.")).toBeInTheDocument();
  });

  it("renders TrainingDatasetItem for each example", async () => {
    mockListExamples.mockResolvedValueOnce(mockItems);
    render(<CurrentTrainingDataset />);

    expect(await screen.findByText("good-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("bad-report.pdf")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockListExamples.mockReturnValue(new Promise(() => {}));
    render(<CurrentTrainingDataset />);

    expect(screen.getByText("Loading training dataset...")).toBeInTheDocument();
  });
});
