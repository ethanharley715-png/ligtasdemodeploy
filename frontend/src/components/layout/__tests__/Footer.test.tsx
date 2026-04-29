import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../context/LanguageContext";
import { Footer } from "../Footer";

function renderFooter(props?: React.ComponentProps<typeof Footer>) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <Footer {...props} />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("Footer", () => {
  it("links Help Center to the public help page", () => {
    renderFooter();

    const helpLinks = screen.getAllByRole("link", { name: /help center/i });
    expect(helpLinks.some((link) => link.getAttribute("href") === "/help")).toBe(true);
  });

  it("links Documentation to the user-documentation anchor", () => {
    renderFooter();

    const documentationLinks = screen.getAllByRole("link", { name: /documentation/i });
    expect(documentationLinks.some((link) => link.getAttribute("href") === "/help#user-documentation")).toBe(true);
  });
});
