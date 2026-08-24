export type LanguageCode = "en" | "es" | "pt-BR" | "fr" | "ru" | "ar" | "id" | "de";

export const LANGUAGES: { code: LanguageCode; nativeLabel: string; flag: string }[] = [
  { code: "en", nativeLabel: "English", flag: "🇬🇧" },
  { code: "es", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "pt-BR", nativeLabel: "Português (BR)", flag: "🇧🇷" },
  { code: "fr", nativeLabel: "Français", flag: "🇫🇷" },
  { code: "ru", nativeLabel: "Русский", flag: "🇷🇺" },
  { code: "ar", nativeLabel: "العربية", flag: "🇸🇦" },
  { code: "id", nativeLabel: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "de", nativeLabel: "Deutsch", flag: "🇩🇪" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";
