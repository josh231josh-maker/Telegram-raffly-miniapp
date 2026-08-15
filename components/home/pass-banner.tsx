"use client";

import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { RAFFLY_PASS_DAILY_TICKETS, isPassActive } from "@/lib/raffly-pass";
import { ChevronRightIcon } from "@/components/icons";

type PassBannerProps = {
  onOpen: () => void;
};

export function PassBanner({ onOpen }: PassBannerProps) {
  const { user } = useTelegram();
  const hasPass = isPassActive(user?.raffly_pass_expires_at ?? null);

  const banner = (
    <button
      onClick={onOpen}
      className="pass-banner-gradient relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/25 text-white">
        <Image src="/images/crown-icon.png" alt="" width={24} height={17} />
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
        <span className="block text-xs text-white/70">{RAFFLY_PASS_DAILY_TICKETS} tickets/day · 2x rewards</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-white/60" />
    </button>
  );

  // The rotating glow ring is an upsell cue -- once someone already has the
  // pass, it's just noise, so only non-subscribers see it.
  if (hasPass) return banner;

  return <div className="pass-banner-glow">{banner}</div>;
}
