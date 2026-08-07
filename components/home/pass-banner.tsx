"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { CrownIcon, ChevronRightIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

type PassBannerProps = {
  onOpen: () => void;
};

export function PassBanner({ onOpen }: PassBannerProps) {
  const { user } = useTelegram();
  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);

  return (
    <button
      onClick={onOpen}
      className="pass-banner-gradient flex items-center gap-3 rounded-2xl border border-[rgba(255,209,102,0.18)] px-4 py-3 text-left text-white transition active:scale-[0.99]"
    >
      <IconBadge icon={<CrownIcon />} tone="gold" size="md" />
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
