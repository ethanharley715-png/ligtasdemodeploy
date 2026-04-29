import React, { useEffect, useMemo, useState } from "react";
import { translations, type Language, type TranslationKey } from "../i18n/translations";
import { LanguageContext, type LanguageContextType } from "./language-context";
import { detectBrowserLanguage } from "../utils/language";

// Persisted storage key for the selected language.
const LANGUAGE_STORAGE_KEY = "ligtas-language";

function getStoredLanguage(): Language {
  // Default to English when running outside the browser.
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (storedLanguage === "en" || storedLanguage === "cy") {
    return storedLanguage;
  }

  // Fall back to the browser language when no stored preference exists.
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    // Keep the selected language persisted between sessions.
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextType>(() => {
    const currentTranslations = translations[language] as Record<TranslationKey, string>;

    return {
      language,
      setLanguage,
      // Return the translation for the active language, with the key as fallback.
      t: (key: TranslationKey) => currentTranslations[key] ?? key,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}