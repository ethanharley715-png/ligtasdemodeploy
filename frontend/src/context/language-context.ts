import { createContext } from "react";
import { translations, type Language, type TranslationKey } from "../i18n/translations";

export type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

// Default context values provide safe fallbacks before the provider is mounted.
export const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.en[key] ?? key,
});