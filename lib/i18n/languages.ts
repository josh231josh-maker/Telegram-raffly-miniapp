export type LanguageCode = "en" | "ru" | "es" | "pt-BR" | "id";

export const LANGUAGES: { code: LanguageCode; nativeLabel: string }[] = [
  { code: "en", nativeLabel: "English" },
  { code: "ru", nativeLabel: "Русский" },
  { code: "es", nativeLabel: "Español" },
  { code: "pt-BR", nativeLabel: "Português (BR)" },
  { code: "id", nativeLabel: "Bahasa Indonesia" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";
