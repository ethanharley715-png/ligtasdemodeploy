import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserLanguage } from "../language";

describe("detectBrowserLanguage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cy when browser language is cy", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("cy");

    expect(detectBrowserLanguage()).toBe("cy");
  });

  it("returns cy when browser language starts with cy", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("cy-GB");

    expect(detectBrowserLanguage()).toBe("cy");
  });

  it("returns en when browser language is en-GB", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");

    expect(detectBrowserLanguage()).toBe("en");
  });

  it("falls back to en for unsupported browser languages", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("fr-FR");

    expect(detectBrowserLanguage()).toBe("en");
  });
});