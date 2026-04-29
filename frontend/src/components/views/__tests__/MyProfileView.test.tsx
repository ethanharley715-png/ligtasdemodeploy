import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import "@testing-library/jest-dom";

import { MyProfileView } from "../MyProfileView";

// Mock API services for testing.
vi.mock("../../services/api", () => ({
  reportsApi: {
    stats: vi.fn().mockResolvedValue({
      totalReports: 10,
      completedReports: 8,
      failedReports: 2,
      processingReports: 0,
      totalIssues: 20,
      passRate: 80,
    }),
    recent: vi.fn().mockResolvedValue([]),
  },
  authApi: {
    changePassword: vi.fn(),
  },
  usersApi: {
    updateMe: vi.fn(),
  },
}));

vi.mock("../../context/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

const mockUser = {
  name: "Admin User",
  email: "admin@ligtas.com",
  role: "admin" as const,
};

describe("MyProfileView", () => {
  test("renders profile info", () => {
    render(<MyProfileView user={mockUser} onUserUpdate={vi.fn()} />);
    expect(screen.getAllByText("Admin User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("admin@ligtas.com").length).toBeGreaterThan(0);
  });

  test("keeps profile and password actions scoped to their sections", () => {
    render(<MyProfileView user={mockUser} onUserUpdate={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /edit profile/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /change password/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^update$/i })).not.toBeInTheDocument();
  });

  test("opens password form when clicking change password", async () => {
    render(<MyProfileView user={mockUser} onUserUpdate={vi.fn()} />);
    const button = screen.getByRole("button", { name: /change password/i });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /save password/i })).toBeInTheDocument();
  });

  test("shows error when passwords don't match", async () => {
    render(<MyProfileView user={mockUser} onUserUpdate={vi.fn()} />);

    const button = screen.getByRole("button", { name: /change password/i });
    await userEvent.click(button);

    const inputs = screen.getAllByDisplayValue("");

    await userEvent.type(inputs[0], "oldpass123");
    await userEvent.type(inputs[1], "StrongPass123!");
    await userEvent.type(inputs[2], "WrongPass123!");

    await userEvent.click(screen.getByRole("button", { name: /save password/i }));

    expect(await screen.findByText(/match/i)).toBeInTheDocument();
  });

  test("blocks weak password submission", async () => {
    render(<MyProfileView user={mockUser} onUserUpdate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /change password/i }));

    const inputs = screen.getAllByDisplayValue("");

    await userEvent.type(inputs[0], "oldpass123");
    await userEvent.type(inputs[1], "aaaaaaaa");
    await userEvent.type(inputs[2], "aaaaaaaa");

    await userEvent.click(screen.getByRole("button", { name: /save password/i }));

    const errors = await screen.findAllByText(/weak|least|invalid/i);
    expect(errors.length).toBeGreaterThan(0);
  });
});
