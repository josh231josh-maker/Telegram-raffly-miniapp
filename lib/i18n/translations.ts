import type { LanguageCode } from "@/lib/i18n/languages";
import { TRANSLATION_KEYS, type TranslationKey } from "@/lib/i18n/keys";
import en from "@/lib/i18n/locales/en";
import es from "@/lib/i18n/locales/es";
import ptBR from "@/lib/i18n/locales/pt-BR";
import fr from "@/lib/i18n/locales/fr";
import ru from "@/lib/i18n/locales/ru";
import ar from "@/lib/i18n/locales/ar";
import id from "@/lib/i18n/locales/id";
import de from "@/lib/i18n/locales/de";

export { TRANSLATION_KEYS, type TranslationKey };

export const TRANSLATIONS: Record<LanguageCode, Record<TranslationKey, string>> = {
  en,
  es,
  "pt-BR": ptBR,
  fr,
  ru,
  ar,
  id,
  de,
};
