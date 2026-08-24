import { DEFAULT_LANGUAGE, type LanguageCode } from "@/lib/i18n/languages";

// Telegram's own language codes are plain ISO 639-1 roots ("en", "ru", "pt",
// ...), occasionally with a region suffix ("pt-br") -- matched here on the
// root only. Any code Raffly doesn't have a locale file for (and Telegram
// covers far more than these 8) falls back to English, same as a missing
// key within a supported locale falls back to English in language-provider.
const TELEGRAM_LANGUAGE_MAP: Record<string, LanguageCode> = {
  en: "en",
  es: "es",
  pt: "pt-BR",
  fr: "fr",
  ru: "ru",
  ar: "ar",
  id: "id",
  de: "de",
};

export function mapTelegramLanguageCode(telegramLanguageCode: string | null | undefined): LanguageCode {
  if (!telegramLanguageCode) return DEFAULT_LANGUAGE;
  const root = telegramLanguageCode.toLowerCase().split("-")[0];
  return TELEGRAM_LANGUAGE_MAP[root] ?? DEFAULT_LANGUAGE;
}

// Reads language_code straight out of the raw initData query string rather
// than the SDK's parsed `user` signal -- this only ever feeds a display
// preference (which language to render in), never anything security- or
// balance-sensitive, so it doesn't need init()'s signal state to have been
// restored first, and works from the exact same raw string
// TelegramProvider already retrieves independently.
export function extractTelegramLanguageCode(rawInitData: string): string | null {
  try {
    const params = new URLSearchParams(rawInitData);
    const userJson = params.get("user");
    if (!userJson) return null;
    const parsed = JSON.parse(userJson) as { language_code?: unknown };
    return typeof parsed.language_code === "string" ? parsed.language_code : null;
  } catch {
    return null;
  }
}
