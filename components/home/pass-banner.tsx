"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { CrownIcon, ChevronRightIcon } from "@/components/icons";

type PassBannerProps = {
  onOpen: () => void;
};

export function PassBanner({ onOpen }: PassBannerProps) {
  const { user } = useTelegram();
  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);

  return (
    <button
      onClick={onOpen}
      className="btn-accent flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition active:scale-[0.99]"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-gold"
        aria-hidden="true"
      >
        <CrownIcon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2 font-heading text-sm font-semibold">
          Raffly Pass
          {hasPass && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
              Active
            </span>
          )}
        </span>
        <span className="block text-xs text-white/70">20 tickets/day · 2x rewards</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-white/60" />
    </button>
  );
}
