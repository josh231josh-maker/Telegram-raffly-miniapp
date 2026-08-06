"use client";

import { useTelegram } from "@/components/providers/telegram-provider";

const SETTINGS_ROWS: { label: string; href?: string }[] = [
  { label: "Support", href: "https://t.me/RafflySupportBot" },
  { label: "Terms & Privacy" },
];

function initials(firstName: string | null, username: string | null): string {
  const source = firstName || username || "?";
  return source.slice(0, 2).toUpperCase();
}

export function ProfileCard() {
  const { user, loadingUser } = useTelegram();

  if (loadingUser || !user) return null;

  const displayName = user.first_name || user.username || "Raffler";

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft font-heading text-lg font-bold text-accent">
          {initials(user.first_name, user.username)}
        </div>
        <div>
          <p className="font-heading text-base font-semibold text-text">{displayName}</p>
          <p className="text-xs text-text-faint">
            {user.username ? `@${user.username}` : `ID ${user.telegram_id}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border py-4 text-center">
        <div>
          {/* Referral count isn't tracked on the user record yet — shown once the backend exposes it. */}
          <p className="font-heading text-lg font-bold text-text">—</p>
          <p className="text-xs text-text-faint">Referrals</p>
        </div>
        <div>
          <p className="font-heading text-lg font-bold text-text">{user.streak_count}</p>
          <p className="text-xs text-text-faint">Day streak</p>
        </div>
        <div>
          {/* Lifetime winnings aren't tracked separately from the spendable usdt_balance yet. */}
          <p className="font-heading text-lg font-bold text-text">—</p>
          <p className="text-xs text-text-faint">Total won</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {SETTINGS_ROWS.map((row) =>
          row.href ? (
            <a
              key={row.label}
              href={row.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-3 text-sm text-text"
            >
              <span>{row.label}</span>
              <span className="text-text-faint" aria-hidden="true">
                ›
              </span>
            </a>
          ) : (
            <div key={row.label} className="flex items-center justify-between py-3 text-sm text-text">
              <span>{row.label}</span>
              <span className="text-text-faint" aria-hidden="true">
                ›
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}
