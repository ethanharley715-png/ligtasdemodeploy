import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../Sidebar";

function renderSidebar(
  overrides: Partial<ComponentProps<typeof Sidebar>> & Pick<ComponentProps<typeof Sidebar>, "userRole">,
) {
  return render(
    <MemoryRouter>
      <Sidebar activeView="dashboard" onViewChange={vi.fn()} {...overrides} />
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("shows the QC Trend Dashboard entry for admins", () => {
    renderSidebar({ userRole: "admin" });

    expect(screen.getByRole("button", { name: /QC Trend Dashboard/i })).toBeInTheDocument();
  });

  it("shows the Teams entry for admins", () => {
    renderSidebar({ userRole: "admin" });

    expect(screen.getByRole("button", { name: /^Teams$/i })).toBeInTheDocument();
  });

  it("shows the Team Analytics entry for admins", () => {
    renderSidebar({ userRole: "admin" });

    expect(screen.getByRole("button", { name: /^Team Analytics$/i })).toBeInTheDocument();
  });

  it("shows the Security Events entry for admins", () => {
    renderSidebar({ userRole: "admin" });

    expect(screen.getByRole("button", { name: /^Security Events$/i })).toBeInTheDocument();
  });

  it("shows the My Team Analytics entry for team managers", () => {
    renderSidebar({ userRole: "team_manager" });

    expect(screen.getByRole("button", { name: /^My Team Analytics$/i })).toBeInTheDocument();
  });

  it("hides the QC Trend Dashboard entry for consultants", () => {
    renderSidebar({ userRole: "consultant" });

    expect(screen.queryByRole("button", { name: /QC Trend Dashboard/i })).not.toBeInTheDocument();
  });

  it("hides the Teams entry for team managers", () => {
    renderSidebar({ userRole: "team_manager" });

    expect(screen.queryByRole("button", { name: /^Teams$/i })).not.toBeInTheDocument();
  });

  it("hides the Team Analytics entry for consultants", () => {
    renderSidebar({ userRole: "consultant" });

    expect(screen.queryByRole("button", { name: /Team Analytics/i })).not.toBeInTheDocument();
  });

  it("hides the Security Events entry for consultants", () => {
    renderSidebar({ userRole: "consultant" });

    expect(screen.queryByRole("button", { name: /^Security Events$/i })).not.toBeInTheDocument();
  });
});
