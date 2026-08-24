"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { ChevronRightIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/profile/theme-toggle";
import { LanguagePickerModal } from "@/components/profile/language-picker-modal";
import { LANGUAGES } from "@/lib/i18n/languages";

function initials(firstName: string | null, username: string | null): string {
  const source = firstName || username || "?";
  return source.slice(0, 2).toUpperCase();
}

export function ProfileCard() {
  const { user, loadingUser } = useTelegram();
  const { language, t } = useLanguage();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const currentLanguageLabel = LANGUAGES.find((l) => l.code === language)?.nativeLabel ?? language;

  if (loadingUser || !user) {
    return (
      <section className="card-soft rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-border py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-5 w-8 rounded-full" />
              <Skeleton className="h-2.5 w-14 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-border">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <Skeleton className="h-3.5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const displayName = user.first_name || user.username || "Raffler";

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        {user.photo_url && !photoFailed ? (
          <img
            src={user.photo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="btn-accent flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold">
            {initials(user.first_name, user.username)}
          </div>
        )}
        <div>
          <p className="font-heading text-base font-semibold text-text">{displayName}</p>
          <p className="text-xs text-text-faint">
            {user.username ? `@${user.username}` : `ID ${user.telegram_id}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border py-4 text-center">
        <div>
          <p className="font-heading text-lg font-bold text-text">{user.referral_count}</p>
          <p className="text-xs text-text-faint">{t("profile.referrals")}</p>
        </div>
        <div>
          <p className="font-heading text-lg font-bold text-text">{user.streak_count}</p>
          <p className="text-xs text-text-faint">{t("profile.streak")}</p>
        </div>
        <div>
          {/* Lifetime winnings aren't tracked separately from the spendable usdt_balance yet. */}
          <p className="font-heading text-lg font-bold text-text">—</p>
          <p className="text-xs text-text-faint">{t("profile.totalWon")}</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border">
        <a
          href="https://t.me/RafflySupportBot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-3 text-sm text-text"
        >
          <span>{t("profile.support")}</span>
          <ChevronRightIcon className="h-4 w-4 text-text-faint" />
        </a>
        <ThemeToggle />
        <button
          onClick={() => setLanguagePickerOpen(true)}
          className="flex items-center justify-between py-3 text-left text-sm text-text"
        >
          <span>{t("profile.language")}</span>
          <span className="flex items-center gap-1.5 text-text-faint">
            {currentLanguageLabel}
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </button>
      </div>

      {languagePickerOpen && <LanguagePickerModal onClose={() => setLanguagePickerOpen(false)} />}
    </section>
  );
}
