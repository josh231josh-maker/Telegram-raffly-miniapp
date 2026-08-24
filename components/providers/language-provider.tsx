"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { retrieveRawInitData } from "@telegram-apps/sdk";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "@/lib/i18n/languages";
import { TRANSLATIONS, type TranslationKey } from "@/lib/i18n/translations";
import { extractTelegramLanguageCode, mapTelegramLanguageCode } from "@/lib/i18n/detect-language";

const STORAGE_KEY = "raffly-language";

type TranslateParams = Record<string, string | number>;

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
};

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/{{(\w+)}}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

// Falls back key-by-key to English rather than whole-locale -- a locale
// missing one newly-added key (translations lag a bit behind new features)
// still renders every other string in the user's own language instead of
// dropping to English for the whole app.
function translate(language: LanguageCode, key: TranslationKey, params?: TranslateParams): string {
  const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key];
  return interpolate(template, params);
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
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
      return;
    }

    // No explicit choice saved yet -- this is the very first time this
    // browser/device has opened the mini app, so detect from Telegram's own
    // language_code instead of silently defaulting to English for every
    // non-English user. Read directly off the raw initData string (doesn't
    // need init() to have run) so this works independently of whether
    // TelegramProvider's own effect has fired yet.
    let rawInitData = "";
    try {
      rawInitData = retrieveRawInitData() ?? "";
    } catch {
      rawInitData = "";
    }
    const detected = mapTelegramLanguageCode(extractTelegramLanguageCode(rawInitData));
    setLanguageState(detected);
    try {
      // Persisted immediately so a later session without Telegram context
      // (or a different detected result) doesn't flip the language on its
      // own -- once decided, "remembered" applies the same to an
      // auto-detected choice as to a manual one.
      localStorage.setItem(STORAGE_KEY, detected);
    } catch {
      // Private browsing / storage disabled -- detection still applies for
      // this session, it just won't be remembered for the next one.
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

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(language, key, params),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
