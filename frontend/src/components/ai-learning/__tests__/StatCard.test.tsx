import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Brain } from "lucide-react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders label, value, and footer", () => {
    render(
      <StatCard
        label="Model Accuracy"
        value="92.5%"
        icon={Brain}
        footer={<span>+3.2% this month</span>}
      />,
    );

    expect(screen.getByText("Model Accuracy")).toBeInTheDocument();
    expect(screen.getByText("92.5%")).toBeInTheDocument();
    expect(screen.getByText("+3.2% this month")).toBeInTheDocument();
  });

  it("applies custom valueClassName when provided", () => {
    const { container } = render(
      <StatCard
        label="Last Training"
        value="Today"
        icon={Brain}
        footer={<span>footer</span>}
        valueClassName="text-2xl"
      />,
    );

    const valueEl = container.querySelector(".text-2xl");
    expect(valueEl).toBeInTheDocument();
    expect(valueEl?.textContent).toBe("Today");
  });

  it("uses default text-4xl class when valueClassName is omitted", () => {
    const { container } = render(
      <StatCard
        label="Examples"
        value="150"
        icon={Brain}
        footer={<span>footer</span>}
      />,
    );

    const valueEl = container.querySelector(".text-4xl");
    expect(valueEl).toBeInTheDocument();
    expect(valueEl?.textContent).toBe("150");
  });
});
