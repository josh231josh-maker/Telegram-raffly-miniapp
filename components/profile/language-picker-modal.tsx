"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { LANGUAGES } from "@/lib/i18n/languages";
import { CheckIcon, CloseIcon } from "@/components/icons";

type LanguagePickerModalProps = {
  onClose: () => void;
};

export function LanguagePickerModal({ onClose }: LanguagePickerModalProps) {
  const { language, setLanguage, t } = useLanguage();
  useTelegramBackButton(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" onClick={onClose}>
      <div
        className="card-soft w-full max-w-sm rounded-[28px] border border-border bg-card p-5 text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-balance">{t("profile.languagePickerTitle")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text-dim"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col divide-y divide-border">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                onClose();
              }}
              className="flex items-center justify-between py-3 text-left text-sm font-medium text-text"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-lg leading-none" aria-hidden="true">
                  {lang.flag}
                </span>
                {lang.nativeLabel}
              </span>
              {language === lang.code && <CheckIcon className="h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
