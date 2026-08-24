"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { useLanguage } from "@/components/providers/language-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-text">{t("profile.appearance")}</span>
      <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
        {(["dark", "light"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTheme(option)}
            aria-pressed={theme === option}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              theme === option ? "bg-card text-text shadow-sm" : "text-text-faint"
            }`}
          >
            {t(option === "dark" ? "profile.appearanceDark" : "profile.appearanceLight")}
          </button>
        ))}
      </div>
    </div>
  );
}
