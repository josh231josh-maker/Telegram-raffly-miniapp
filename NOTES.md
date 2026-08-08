# Raffly — Architecture Notes

> Reference doc for consistent development. Update as features ship.

## Overview

**Raffly** is a Telegram Mini App for weekly random raffles. Every week, **5 random winners** each receive **$100 USDT**.

- **Bot:** [@Rafflyapp_bot](https://t.me/Rafflyapp_bot)
- **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel
- **Repo:** `Telegram-raffly-miniapp`

---

## Product Rules

| Rule | Detail |
|------|--------|
| Draw frequency | Weekly — 5 winners × $100 USDT |
| Ticket sources | Ads (3 ads = 1 ticket), daily check-in, referrals, Telegram Stars, TON (TON Connect) |
| Ad limit | No daily cap for now |
| Ticket expiry | Tickets do **not** carry over — reset each week |
| Winnings | Credited to in-app USDT balance |
| Withdrawals | Manual, no minimum |

---

## Tech Stack

```
Telegram Client
      ↓
Next.js Mini App (Vercel)
      ↓
Supabase (Postgres + Auth)
      ↑
Telegram Bot API (webhooks, Stars, notifications)
```

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 App Router, React 19, Tailwind CSS v4 |
| Telegram | `@telegram-apps/sdk` — initialized in `TelegramProvider` |
| Database | Supabase (existing schema — do not recreate) |
| Hosting | Vercel |
| Payments (future) | Telegram Stars, TON Connect |
| Ads (future) | AdsGram / Adsoner |

---

## Supabase Schema (existing)

All tables use **snake_case** and **uuid** primary keys. Do not recreate — connect only.

| Table | Purpose |
|-------|---------|
| `users` | Telegram user profiles, ticket balance, USDT balance |
| `raffles` | Weekly raffle periods |
| `raffle_entries` | User ticket entries per raffle |
| `raffle_winners` | Selected winners per draw — `status`: pending/approved/rejected/revoked |
| `winner_announcements` | Public "Previous Winners" list — has its own `publish_at` for scheduled visibility, decoupled from `raffle_winners` |
| `ad_views` | Ad watch events (3 = 1 ticket) |
| `transactions` | Stars, TON, and internal ledger |
| `withdrawals` | USDT withdrawal requests — `status`: pending/approved/paid/rejected |

Client: `lib/supabase.ts` → `getSupabase()` using anon key + RLS.

### Withdrawal & raffle-winner approval workflow

Both withdrawals and raffle winnings go through a manual admin approval step before any money moves, and users see **no trace of the pending state** anywhere in the app:

The two flows are intentionally different, because winning and withdrawing aren't the same event — winning credits an internal balance (reversible, no money has moved), withdrawing is the one point where real crypto actually leaves the admin's wallet (needs a tx hash):

1. **Withdrawals**: user requests → `withdrawals` row inserted as `pending`, balance untouched → admin approves/rejects in `/admin` (only Pending/Approved/Sent are shown as tabs — rejected withdrawals still exist in the DB but aren't surfaced anywhere) → reject leaves balance untouched → admin sends funds manually outside the app → admin clicks "Mark Sent" with a tx hash → **only then** is the balance debited by the withdrawn amount (not zeroed outright, since the balance may have grown from other sources in the meantime).
2. **Raffle winners**: the weekly cron (`lib/raffle-draw.ts`) still does the weighted random draw (no repeat winner in the same week), but inserts winners into `raffle_winners` as `pending` — no balance credit. Admin **approves** → this immediately credits the prize to the user's in-app balance (no tx hash, since no real money has moved — it's spendable balance now, same as any other balance). Admin **rejects** → nothing happens, balance untouched. Admin can also **revoke** an already-approved winner (e.g. approved by mistake) — this reverses the balance credit (floored at $0 if some/all was already withdrawn). Only Pending/Approved are shown as tabs — rejected/revoked winners still exist in the DB but aren't surfaced anywhere, since they're not actionable once resolved. The user later withdraws that balance through the normal withdrawal flow above, which is where the real payout happens.
3. **Previous Winners editor**: fully decoupled and 100% manual — approving a raffle winner does **not** touch `winner_announcements` at all. Admin adds/edits/deletes entries independently with a scheduled `publish_at`, in batches of up to 5 (one per weekly draw) sharing a single "goes live at" time. The public list only ever changes when the admin explicitly edits it here.

Since `raffle_winners` and `withdrawals` are never queried by any user-facing API (`/api/raffle-info` only reads `winner_announcements` filtered by `publish_at <= now()`), there is no pending/rejected state exposed to end users.

---

## Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (RLS-protected) |
| `TELEGRAM_BOT_TOKEN` | **Server only** | Bot API, webhooks, Stars invoices |
| `NEXT_PUBLIC_APP_URL` | Public | App base URL for callbacks |

Copy `.env.example` → `.env.local` for local dev. Mirror keys in Vercel project settings.

---

## Project Structure

```
app/
  layout.tsx          # Root layout + TelegramProvider
  page.tsx            # Home — balances + countdown
  globals.css         # Blue/purple theme, gold accents
components/
  providers/
    telegram-provider.tsx
  home/
    home-header.tsx
    balance-cards.tsx
    draw-countdown.tsx
lib/
  supabase.ts         # Supabase client singleton
```

---

## Design System

- **Colors:** Deep indigo/purple background (`#0f0a1e` → `#4c1d95`), gold accents (`#fbbf24`)
- **Motifs:** Tickets 🎟️, stars ⭐, trophy 🏆
- **Style:** Clean, modern, mobile-first (Telegram WebView)

---

## Build Phases (roadmap)

- [x] **Phase 0 — Skeleton** (this commit): Next.js scaffold, Telegram SDK, home UI placeholders, Supabase client
- [ ] **Phase 1 — Auth:** Validate Telegram `initData`, upsert `users` row
- [ ] **Phase 2 — Balances:** Fetch real ticket + USDT balances from Supabase
- [ ] **Phase 3 — Earn tickets:** Ads, check-in, referrals
- [ ] **Phase 4 — Payments:** Telegram Stars + TON Connect
- [ ] **Phase 5 — Raffle engine:** Weekly draw, winner selection, notifications
- [ ] **Phase 6 — Withdrawals:** No-minimum USDT payout flow

---

## Conventions

- TypeScript strict mode
- `@/*` import alias
- Client components only where needed (`"use client"`)
- Server secrets (`TELEGRAM_BOT_TOKEN`) never in client bundles
- Snake_case in DB, camelCase in TypeScript
- API routes under `app/api/` for webhooks and server logic
