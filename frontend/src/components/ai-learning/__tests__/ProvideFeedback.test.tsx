import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProvideFeedback } from "../ProvideFeedback";

const { mockPendingReview, mockFeedbackStats, mockSubmitFeedback } = vi.hoisted(() => ({
  mockPendingReview: vi.fn(),
  mockFeedbackStats: vi.fn(),
  mockSubmitFeedback: vi.fn(),
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../services/api", () => ({
  aiLearningApi: {
    pendingReview: mockPendingReview,
    feedbackStats: mockFeedbackStats,
    submitFeedback: mockSubmitFeedback,
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

const mockPending = {
  reportId: "RPT-001",
  fileName: "test-report.pdf",
  issuesDetected: 5,
  criticalIssues: 2,
};

const mockStats = { positive: 10, negative: 3, satisfactionRate: 76.9 };

describe("ProvideFeedback", () => {
  beforeEach(() => {
    mockPendingReview.mockReset();
    mockFeedbackStats.mockReset();
    mockSubmitFeedback.mockReset();
    mockToast.error.mockReset();
  });

  it("renders heading and description", async () => {
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    render(<ProvideFeedback />);
    expect(screen.getByText("Help Improve AI Accuracy")).toBeInTheDocument();
  });

  it("shows ReviewReportCard when pending review exists", async () => {
    mockPendingReview.mockResolvedValueOnce(mockPending);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    render(<ProvideFeedback />);

    expect(await screen.findByText("Review Report: RPT-001")).toBeInTheDocument();
    expect(screen.getByText("test-report.pdf")).toBeInTheDocument();
  });

  it('shows "No reports pending review" when pendingReview is null', async () => {
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    render(<ProvideFeedback />);

    expect(await screen.findByText("No reports pending review at this time.")).toBeInTheDocument();
  });

  it("renders three FeedbackStatCards with correct values", async () => {
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    render(<ProvideFeedback />);

    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("76.9%")).toBeInTheDocument();
  });

  it('calls submitFeedback with "correct" when correct button is clicked', async () => {
    mockPendingReview.mockResolvedValueOnce(mockPending);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    // After submission, return updated data
    mockSubmitFeedback.mockResolvedValueOnce({});
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);

    const user = userEvent.setup();
    render(<ProvideFeedback />);

    const correctBtn = await screen.findByText("Yes, Issues Correct");
    await user.click(correctBtn);

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith("RPT-001", "correct");
    });
  });

  it('calls submitFeedback with "needs_improvement" when improvement button is clicked', async () => {
    mockPendingReview.mockResolvedValueOnce(mockPending);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    mockSubmitFeedback.mockResolvedValueOnce({});
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);

    const user = userEvent.setup();
    render(<ProvideFeedback />);

    const improvementBtn = await screen.findByText("No, Needs Improvement");
    await user.click(improvementBtn);

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith("RPT-001", "needs_improvement");
    });
  });

  it("shows toast.error when submission fails", async () => {
    mockPendingReview.mockResolvedValueOnce(mockPending);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    mockSubmitFeedback.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    render(<ProvideFeedback />);

    const correctBtn = await screen.findByText("Yes, Issues Correct");
    await user.click(correctBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Feedback failed", {
        description: "Network error",
      });
    });
  });

  it("calls onDataChanged after successful feedback submission", async () => {
    mockPendingReview.mockResolvedValueOnce(mockPending);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);
    mockSubmitFeedback.mockResolvedValueOnce({});
    mockPendingReview.mockResolvedValueOnce(null);
    mockFeedbackStats.mockResolvedValueOnce(mockStats);

    const onDataChanged = vi.fn();
    const user = userEvent.setup();
    render(<ProvideFeedback onDataChanged={onDataChanged} />);

    const correctBtn = await screen.findByText("Yes, Issues Correct");
    await user.click(correctBtn);

    await waitFor(() => {
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
  });
});
