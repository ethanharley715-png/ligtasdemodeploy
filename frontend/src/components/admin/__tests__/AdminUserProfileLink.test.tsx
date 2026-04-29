import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminUserProfileLink } from "../AdminUserProfileLink";

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("AdminUserProfileLink", () => {
  it("renders plain text when the viewer is not an admin", () => {
    renderWithRouter(
      <AdminUserProfileLink userId={1} isAdmin={false}>
        Jane Doe
      </AdminUserProfileLink>,
    );
    expect(screen.getByText("Jane Doe").tagName).toBe("SPAN");
  });

  it("renders plain text when user id is missing", () => {
    renderWithRouter(
      <AdminUserProfileLink userId={null} isAdmin>
        Jane Doe
      </AdminUserProfileLink>,
    );
    expect(screen.getByText("Jane Doe").tagName).toBe("SPAN");
  });

  it("renders plain text when user id is empty", () => {
    renderWithRouter(
      <AdminUserProfileLink userId="" isAdmin>
        Jane Doe
      </AdminUserProfileLink>,
    );
    expect(screen.getByText("Jane Doe").tagName).toBe("SPAN");
  });

  it("renders plain text when user id is not a finite number", () => {
    renderWithRouter(
      <AdminUserProfileLink userId="not-a-number" isAdmin>
        Jane Doe
      </AdminUserProfileLink>,
    );
    expect(screen.getByText("Jane Doe").tagName).toBe("SPAN");
  });

  it("renders a router link for admins with a numeric user id", () => {
    renderWithRouter(
      <AdminUserProfileLink userId={42} isAdmin>
        Jane Doe
      </AdminUserProfileLink>,
    );
    const link = screen.getByRole("link", { name: "Jane Doe" });
    expect(link).toHaveAttribute("href", "/admin/users/42/analytics");
  });

  it("renders a router link when user id is a numeric string", () => {
    renderWithRouter(
      <AdminUserProfileLink userId="99" isAdmin>
        Jane Doe
      </AdminUserProfileLink>,
    );
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute(
      "href",
      "/admin/users/99/analytics",
    );
  });

  it("stops click propagation for nested interactive parents", async () => {
    const user = userEvent.setup();
    const onOuterClick = vi.fn();
    renderWithRouter(
      <button type="button" onClick={onOuterClick}>
        <AdminUserProfileLink userId={7} isAdmin>
          inner
        </AdminUserProfileLink>
      </button>,
    );
    await user.click(screen.getByRole("link", { name: "inner" }));
    expect(onOuterClick).not.toHaveBeenCalled();
  });
});
