import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackStatCard } from "../FeedbackStatCard";

describe("FeedbackStatCard", () => {
  it("renders value and label", () => {
    render(<FeedbackStatCard value="42" label="Positive Feedback" />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Positive Feedback")).toBeInTheDocument();
  });
});
