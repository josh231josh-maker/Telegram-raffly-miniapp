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

  const label = status === "loading" ? "..." : status === "failed" ? "Retry" : "Claim";

  return (
    <div className="pass-banner-glow shrink-0 self-stretch">
      <button
        onClick={handleClaim}
        disabled={status === "loading"}
        aria-label={`Claim today's ${RAFFLY_PASS_DAILY_TICKETS} Raffly Pass tickets`}
        className="pass-banner-gradient relative flex h-full w-[72px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-white transition active:scale-[0.98] disabled:opacity-70"
      >
        <TicketImage size={22} />
        <span className="text-[11px] font-bold leading-none">{label}</span>
      </button>
    </div>
  );
}
