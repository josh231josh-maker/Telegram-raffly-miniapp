"use client";

type PassBannerProps = {
  onOpen: () => void;
};

export function PassBanner({ onOpen }: PassBannerProps) {
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
        <span className="block font-heading text-sm font-semibold text-text">Raffly Pass</span>
        <span className="block text-xs text-text-dim">20 tickets/day · 2× ad rewards</span>
      </span>
      <span className="text-text-faint" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
