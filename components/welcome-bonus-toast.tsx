"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { TicketImage } from "@/components/ticket-image";
import { CloseIcon } from "@/components/icons";

const AUTO_DISMISS_MS = 6000;

// The +50 signup bonus (app/api/auth/route.ts) landed in every new user's
// balance with nothing on screen ever telling them so -- they'd only
// notice it as an unexplained number. isNewUser is a one-time signal from
// that same request (true only on the response that just created the
// account), so this only ever shows once, right when it's true.
export function WelcomeBonusToast() {
  const { isNewUser } = useTelegram();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNewUser) return;
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isNewUser]);

  if (!isNewUser || dismissed) return null;

  return (
    <div
      role="status"
      className="hero-rise fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <TicketImage size={30} />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold text-text">Welcome to Raffly!</p>
        <p className="text-xs text-text-dim">You got 50 free tickets to get started.</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-text-faint hover:text-text"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
