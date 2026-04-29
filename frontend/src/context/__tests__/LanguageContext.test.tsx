import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../LanguageContext";
import { useLanguage } from "../useLanguage";

function TestComponent() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <div data-testid="language-value">{language}</div>
      <div data-testid="translated-language-label">{t("language")}</div>
      <button type="button" onClick={() => setLanguage("cy")}>
        Switch to Welsh
      </button>
      <button type="button" onClick={() => setLanguage("en")}>
        Switch to English
      </button>
    </div>
  );
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses stored language from localStorage when available", () => {
    localStorage.setItem("ligtas-language", "cy");

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("language-value").textContent).toBe("cy");
  });

  it("falls back to browser language when nothing is stored", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("cy-GB");

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("language-value").textContent).toBe("cy");
  });

  it("defaults to en when browser language is unsupported and nothing is stored", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("fr-FR");

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("language-value").textContent).toBe("en");
  });

  it("updates the language when setLanguage is called", () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /switch to welsh/i }));

    expect(screen.getByTestId("language-value").textContent).toBe("cy");
  });

  it("persists language changes to localStorage", async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /switch to welsh/i }));

    await waitFor(() => {
      expect(localStorage.getItem("ligtas-language")).toBe("cy");
    });
  });

  it("returns translated values from t()", () => {
    localStorage.setItem("ligtas-language", "en");

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("translated-language-label").textContent).toBe("Language");
  });
});