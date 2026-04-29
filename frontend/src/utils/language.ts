export function detectBrowserLanguage(): "en" | "cy" {
  if (typeof window === "undefined") {
    return "en";
  }

  const browserLanguage = window.navigator.language.toLowerCase();

  if (browserLanguage.startsWith("cy")) {
    return "cy";
  }

  return "en";
}