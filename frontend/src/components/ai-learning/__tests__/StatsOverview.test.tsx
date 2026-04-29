import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatsOverview } from "../StatsOverview";

const { mockStats } = vi.hoisted(() => ({
  mockStats: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  aiLearningApi: {
    stats: mockStats,
  },
}));

const statsData = {
  modelAccuracy: 92.5,
  accuracyChange: 4.1,
  totalExamples: 150,
  goodExamples: 100,
  badExamples: 50,
  lastTrainingDate: new Date().toISOString(),
  feedbackReceivedThisMonth: 25,
};

describe("StatsOverview", () => {
  beforeEach(() => {
    mockStats.mockReset();
  });

  it("renders stats from API after resolve", async () => {
    mockStats.mockResolvedValueOnce(statsData);
    render(<StatsOverview />);

    expect(await screen.findByText("92.5%")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it('shows "Never" when lastTrainingDate is null', async () => {
    mockStats.mockResolvedValueOnce({ ...statsData, lastTrainingDate: null });
    render(<StatsOverview />);

    expect(await screen.findByText("Never")).toBeInTheDocument();
  });

  it("shows Today for today's training date", async () => {
    mockStats.mockResolvedValueOnce(statsData);
    render(<StatsOverview />);

    expect(await screen.findByText("Today")).toBeInTheDocument();
  });

  it("renders four stat card labels", async () => {
    mockStats.mockResolvedValueOnce(statsData);
    render(<StatsOverview />);

    expect(await screen.findByText("Model Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Training Examples")).toBeInTheDocument();
    expect(screen.getByText("Last Training")).toBeInTheDocument();
    expect(screen.getByText("Feedback Received")).toBeInTheDocument();
  });

  it("shows good and bad example counts", async () => {
    mockStats.mockResolvedValueOnce(statsData);
    render(<StatsOverview />);

    expect(await screen.findByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});