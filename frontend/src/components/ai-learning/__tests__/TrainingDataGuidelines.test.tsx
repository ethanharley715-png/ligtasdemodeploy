import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrainingDataGuidelines } from "../TrainingDataGuidelines";

describe("TrainingDataGuidelines", () => {
  it("renders heading", () => {
    render(<TrainingDataGuidelines />);
    expect(screen.getByText("Training Data Guidelines")).toBeInTheDocument();
  });

  it("renders all four guideline items", () => {
    render(<TrainingDataGuidelines />);
    expect(screen.getByText(/Ensure all reports are anonymized/)).toBeInTheDocument();
    expect(screen.getByText(/Clearly label examples/)).toBeInTheDocument();
    expect(screen.getByText(/For bad examples, document specific issues/)).toBeInTheDocument();
    expect(screen.getByText(/Upload a balanced mix/)).toBeInTheDocument();
  });
});
