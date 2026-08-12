# Raffly — repo notes for Claude

## Mini app vs. admin dashboard: keep changes scoped to the surface asked for

This app has two distinct surfaces sharing one Next.js app:

- **Mini app** (`app/page.tsx` and everything under it) — the player-facing
  Telegram Mini App: home/raffles/profile tabs.
- **Admin dashboard** (`app/admin/**`) — a plain browser page for the admin
  only, reached by username/password, never opened inside Telegram.

**Both are wrapped by the same root layout** (`app/layout.tsx`), because
that's the only layout Next.js gives you at the top of the tree. This is the
actual cause of two real bugs shipped in this repo:

1. A `contextmenu` listener meant to stop Android's long-press "save image"
   menu in the mini app was added at the root layout level with no route
   check, so it also fired on `/admin`.
2. An ambient confetti gif meant only for the mini app's background was
   added the same way, and rendered on the admin dashboard too.

**The rule going forward:** when a change is asked for "in the mini app" or
"on the admin page," it must render/run/apply on *only* that surface, even
though both currently share `app/layout.tsx`. Before adding anything to the
root layout (or to `TelegramProvider`, which also wraps both), ask: would
this fire on `/admin` too? If yes and it shouldn't, scope it.

**How to scope it** (the pattern already used twice in this repo — copy it):

```tsx
"use client";
import { usePathname } from "next/navigation";

export function SomeMiniAppOnlyThing() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null; // or skip the effect
  ...
}
```

Live examples: `components/confetti-background.tsx` (renders nothing under
`/admin`), and the `contextmenu` listener in
`components/providers/telegram-provider.tsx` (skips attaching under
`/admin`). The root layout itself stays a server component — the pathname
check lives in a small client component like these, not in
`app/layout.tsx` directly.

This applies in both directions: something built for the admin dashboard
should equally never leak onto the mini app.
