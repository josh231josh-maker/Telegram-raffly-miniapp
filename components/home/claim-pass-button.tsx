"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { RAFFLY_PASS_DAILY_TICKETS, isPassActive, hasClaimedPassToday } from "@/lib/raffly-pass";
import { TicketImage } from "@/components/ticket-image";

type Status = "idle" | "loading" | "failed";

// Only ever visible for subscribers who haven't claimed today's pass
// tickets yet -- once claimPassTickets() succeeds, the context's `user`
// updates (raffly_pass_last_claim_date becomes today), so this component
// re-evaluates and unmounts itself on the next render. No local "claimed"
// state needed, same reasoning as the "Active" badge on PassBanner.
export function ClaimPassButton() {
  const { user, loadingUser, claimPassTickets } = useTelegram();
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

  const label = status === "loading" ? "..." : status === "failed" ? "Retry" : "Get";

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
          aria-label={`Claim today's ${RAFFLY_PASS_DAILY_TICKETS} Raffly Pass tickets`}
          className="pass-banner-gradient relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-70"
        >
          {label}
          <TicketImage size={14} />
        </button>
      </div>
    </div>
  );
}
