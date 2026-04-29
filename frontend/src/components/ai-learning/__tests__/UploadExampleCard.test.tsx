import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { UploadExampleCard } from "../UploadExampleCard";

describe("UploadExampleCard", () => {
  it("renders title, description, button label, and example text", () => {
    render(
      <UploadExampleCard
        variant="good"
        icon={ThumbsUp}
        title="Upload Good Example"
        description="Upload a good report"
        buttonLabel="Upload Good"
        exampleText="Example: Complete FRA"
      />,
    );

    expect(screen.getByText("Upload Good Example")).toBeInTheDocument();
    expect(screen.getByText("Upload a good report")).toBeInTheDocument();
    expect(screen.getByText("Upload Good")).toBeInTheDocument();
    expect(screen.getByText("Example: Complete FRA")).toBeInTheDocument();
  });

  it("calls onUpload when button is clicked", async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup();
    render(
      <UploadExampleCard
        variant="good"
        icon={ThumbsUp}
        title="Upload Good Example"
        description="desc"
        buttonLabel="Upload Good"
        exampleText="example"
        onUpload={onUpload}
      />,
    );

    await user.click(screen.getByText("Upload Good"));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('applies green styling for "good" variant', () => {
    const { container } = render(
      <UploadExampleCard
        variant="good"
        icon={ThumbsUp}
        title="Good"
        description="desc"
        buttonLabel="Upload"
        exampleText="ex"
      />,
    );

    expect(container.querySelector(".bg-green-100")).toBeInTheDocument();
  });

  it('applies red styling for "bad" variant', () => {
    const { container } = render(
      <UploadExampleCard
        variant="bad"
        icon={ThumbsDown}
        title="Bad"
        description="desc"
        buttonLabel="Upload"
        exampleText="ex"
      />,
    );

    expect(container.querySelector(".bg-red-100")).toBeInTheDocument();
  });
});
