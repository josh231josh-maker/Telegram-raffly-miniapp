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

  const sublabel =
    status === "loading" ? "Claiming..." : status === "failed" ? "Failed, tap to retry" : "Tap to claim";

  return (
    <div className="pass-banner-glow">
      <button
        onClick={handleClaim}
        disabled={status === "loading"}
        aria-label={`Claim today's ${RAFFLY_PASS_DAILY_TICKETS} Raffly Pass tickets`}
        className="pass-banner-gradient relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition active:scale-[0.99] disabled:opacity-70"
      >
        <TicketImage size={30} />
        <span className="flex-1">
          <span className="block font-heading text-sm font-semibold">Daily Pass Tickets Ready</span>
          <span className="block text-xs text-white/70">{sublabel}</span>
        </span>
        <span className="font-heading text-base font-bold">+{RAFFLY_PASS_DAILY_TICKETS}</span>
      </button>
    </div>
  );
}
