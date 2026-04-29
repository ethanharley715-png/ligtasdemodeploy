import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../context/LanguageContext";
import AboutPage from "../AboutPage";
import HelpPage from "../HelpPage";
import { CookiesPage, PrivacyPage, TermsPage } from "../LegalPage";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from "../../App";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      validateResetToken: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  };
});

function renderPublic(ui: React.ReactElement, initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>,
  );
}

describe("Public information pages", () => {
  it("renders the About page with product overview content and CTA", () => {
    renderPublic(<AboutPage />);

    expect(
      screen.getByRole("heading", {
        name: /quality control support for report review, without burying teams in manual checks/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /visit help center/i })).toHaveAttribute("href", "/help");
  });

  it("renders the Help page with the required user guidance sections", () => {
    renderPublic(<HelpPage />);

    expect(screen.getAllByRole("heading", { name: /getting started/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /uploading a report/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /understanding qc results/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /user documentation/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/support@ligtas\.com/i).length).toBeGreaterThan(0);
  });

  it("renders simple legal handover pages", () => {
    renderPublic(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/client should replace it with their own data protection/i)).toBeInTheDocument();

    renderPublic(<TermsPage />);
    expect(screen.getByRole("heading", { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/decision-support tool, not a replacement for professional judgement/i)).toBeInTheDocument();

    renderPublic(<CookiesPage />);
    expect(screen.getByRole("heading", { name: /cookie policy/i })).toBeInTheDocument();
    expect(screen.getByText(/does not intentionally use advertising cookies/i)).toBeInTheDocument();
  });
});

describe("Auth page public links", () => {
  it("shows About and Help Center links on the login page", () => {
    renderPublic(<LoginPage/>);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /help center/i })).toHaveAttribute("href", "/help");
  });

  it("shows About and Help Center links on the forgot-password page", () => {
    renderPublic(<ForgotPasswordPage />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /help center/i })).toHaveAttribute("href", "/help");
  });

  it("shows About and Help Center links on the reset-password page", () => {
    renderPublic(<ResetPasswordPage />, ["/reset-password"]);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /help center/i })).toHaveAttribute("href", "/help");
  });
});
