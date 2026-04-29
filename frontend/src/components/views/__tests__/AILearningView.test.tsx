import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AILearningView } from "../AILearningView";

// Mock all child components to isolate the view
vi.mock("../../ai-learning/StatsOverview", () => ({
  StatsOverview: () => <div data-testid="stats-overview">StatsOverview</div>,
}));

vi.mock("../../ai-learning/HowAILearningWorks", () => ({
  HowAILearningWorks: () => <div data-testid="how-ai-learning">HowAILearningWorks</div>,
}));

vi.mock("../../ai-learning/TrainingTabs", () => ({
  TrainingTabs: () => <div data-testid="training-tabs">TrainingTabs</div>,
}));

vi.mock("../../ai-learning/TrainingDataGuidelines", () => ({
  TrainingDataGuidelines: () => <div data-testid="training-guidelines">TrainingDataGuidelines</div>,
}));

describe("AILearningView", () => {
  it('renders page heading "AI Learning & Training"', () => {
    render(<AILearningView />);
    expect(screen.getByText("AI Learning & Training")).toBeInTheDocument();
  });

  it("renders all four child sections", () => {
    render(<AILearningView />);
    expect(screen.getByTestId("stats-overview")).toBeInTheDocument();
    expect(screen.getByTestId("how-ai-learning")).toBeInTheDocument();
    expect(screen.getByTestId("training-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("training-guidelines")).toBeInTheDocument();
  });
});
