"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";

type PassBannerProps = {
  onOpen: () => void;
};

export function PassBanner({ onOpen }: PassBannerProps) {
  const { user } = useTelegram();
  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 rounded-2xl border border-border bg-accent-soft px-4 py-3 text-left transition active:scale-[0.99]"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-white"
        aria-hidden="true"
      >
        👑
      </span>
      <span className="flex-1">
        <span className="block font-heading text-sm font-semibold text-text">
          Raffly Pass
          {hasPass && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
              Active
            </span>
          )}
        </span>
        <span className="block text-xs text-text-dim">20 tickets/day · 2x rewards</span>
      </span>
      <span className="text-text-faint" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
