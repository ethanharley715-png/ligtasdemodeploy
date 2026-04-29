import { useContext } from "react";
import { LanguageContext } from "./language-context";

export function useLanguage() {
  const context = useContext(LanguageContext);

  // Ensure the hook is only used within the matching provider.
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}