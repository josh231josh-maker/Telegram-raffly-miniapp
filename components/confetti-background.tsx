"use client";

import { usePathname } from "next/navigation";

// Ambient confetti -- meant only for the player-facing mini app, not the
// admin dashboard (which shares this same root layout). Split into its own
// client component so it can check the current route: the root layout
// itself is a server component and has no way to know the pathname without
// one.
export function ConfettiBackground() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="pointer-events-none fixed inset-0 opacity-40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/confetti-bg.gif" alt="" className="h-full w-full object-cover" />
    </div>
  );
}
