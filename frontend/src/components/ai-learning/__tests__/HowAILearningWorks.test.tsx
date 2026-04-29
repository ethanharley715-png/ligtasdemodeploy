import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowAILearningWorks } from "../HowAILearningWorks";

describe("HowAILearningWorks", () => {
  it("renders heading", () => {
    render(<HowAILearningWorks />);
    expect(screen.getByText("How AI Learning Works")).toBeInTheDocument();
  });

  it("renders all three step cards with titles", () => {
    render(<HowAILearningWorks />);
    expect(screen.getByText(/Upload Examples/)).toBeInTheDocument();
    expect(screen.getByText(/AI Learns Patterns/)).toBeInTheDocument();
    expect(screen.getByText(/Improves Detection/)).toBeInTheDocument();
  });
});
