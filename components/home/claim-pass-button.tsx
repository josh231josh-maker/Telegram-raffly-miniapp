"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { RAFFLY_PASS_DAILY_TICKETS, isPassActive, hasClaimedPassToday } from "@/lib/raffly-pass";
import { TicketImage } from "@/components/ticket-image";
import { useLanguage } from "@/components/providers/language-provider";

type Status = "idle" | "loading" | "failed";

// Only ever visible for subscribers who haven't claimed today's pass
// tickets yet -- once claimPassTickets() succeeds, the context's `user`
// updates (raffly_pass_last_claim_date becomes today), so this component
// re-evaluates and unmounts itself on the next render. No local "claimed"
// state needed, same reasoning as the "Active" badge on PassBanner.
export function ClaimPassButton() {
  const { user, loadingUser, claimPassTickets } = useTelegram();
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");

  const hasPass = !loadingUser && isPassActive(user?.raffly_pass_expires_at ?? null);
  const alreadyClaimedToday = hasClaimedPassToday(user?.raffly_pass_last_claim_date ?? null);

  if (!hasPass || alreadyClaimedToday) return null;

  const handleClaim = async () => {
    setStatus("loading");
    const result = await claimPassTickets();
    // A successful, non-duplicate claim unmounts this component on the next
    // render (see above) -- only failure paths need to resolve to a status.
    if (result.error || !result.ticketsEarned) {
      setStatus("failed");
    }
  };

  const label =
    status === "loading"
      ? t("home.claimPassLoading")
      : status === "failed"
      ? t("home.claimPassRetry")
      : t("home.claimPassClaim");

  return (
    // The outer div owns the absolute positioning (overlapping PassBanner --
    // requires the parent in app/page.tsx to be `position: relative`); the
    // inner one owns `.pass-banner-glow`'s own `position: relative`, which
    // it needs for its own ::before ring to position against. Both on the
    // same element would collide -- position is a single property, and the
    // plain CSS class's `relative` beats the `absolute` utility class in
    // the cascade regardless of which is listed first in `className`.
    <div className="absolute right-3 top-1/2 z-[1] -translate-y-1/2">
      <div className="pass-banner-glow pass-banner-glow-pill">
        <button
          onClick={handleClaim}
          disabled={status === "loading"}
          aria-label={t("home.claimPassAriaLabel", { n: RAFFLY_PASS_DAILY_TICKETS })}
          className="pass-banner-gradient relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-70"
        >
          {label}
          <TicketImage size={18} />
        </button>
      </div>
    </div>
  );
}
