import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReviewReportCard } from "../ReviewReportCard";

describe("ReviewReportCard", () => {
  const defaultProps = {
    reportId: "RPT-001",
    fileName: "test-report.pdf",
    issuesDetected: 5,
  };

  it("renders report ID, file name, and issue counts", () => {
    render(<ReviewReportCard {...defaultProps} />);

    expect(screen.getByText("Review Report: RPT-001")).toBeInTheDocument();
    expect(screen.getByText("test-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("AI detected 5 issues")).toBeInTheDocument();
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
  });

  it("calls onCorrect when correct button is clicked", async () => {
    const onCorrect = vi.fn();
    const user = userEvent.setup();
    render(<ReviewReportCard {...defaultProps} onCorrect={onCorrect} />);

    await user.click(screen.getByText("Yes, Issues Correct"));
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it("calls onNeedsImprovement when improvement button is clicked", async () => {
    const onNeedsImprovement = vi.fn();
    const user = userEvent.setup();
    render(<ReviewReportCard {...defaultProps} onNeedsImprovement={onNeedsImprovement} />);

    await user.click(screen.getByText("No, Needs Improvement"));
    expect(onNeedsImprovement).toHaveBeenCalledTimes(1);
  });
});
