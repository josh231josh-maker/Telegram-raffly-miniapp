"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "@/lib/i18n/languages";
import { TRANSLATIONS, type TranslationKey } from "@/lib/i18n/translations";

const STORAGE_KEY = "raffly-language";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey) => string;
};

function translate(language: LanguageCode, key: TranslationKey): string {
  return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key];
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => translate(DEFAULT_LANGUAGE, key),
});

export function useLanguage() {
  return useContext(LanguageContext);
}

const LANGUAGE_CODES = new Set<string>(LANGUAGES.map((l) => l.code));

// Mini-app-only, same as ThemeProvider -- the admin dashboard has never
// asked for translated copy and always reads English regardless of what a
// mini-app user picked (see CLAUDE.md).
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && LANGUAGE_CODES.has(stored)) {
      setLanguageState(stored as LanguageCode);
    }
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled -- the choice just won't
      // persist across sessions, nothing else depends on it.
    }
  }, []);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
