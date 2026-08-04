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
| Withdrawals | Manual, minimum **$30 USDT** |

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
| `raffle_winners` | Selected winners per draw |
| `ad_views` | Ad watch events (3 = 1 ticket) |
| `transactions` | Stars, TON, and internal ledger |
| `withdrawals` | USDT withdrawal requests |

Client: `lib/supabase.ts` → `getSupabase()` using anon key + RLS.

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
- [ ] **Phase 6 — Withdrawals:** $30 minimum USDT payout flow

---

## Conventions

- TypeScript strict mode
- `@/*` import alias
- Client components only where needed (`"use client"`)
- Server secrets (`TELEGRAM_BOT_TOKEN`) never in client bundles
- Snake_case in DB, camelCase in TypeScript
- API routes under `app/api/` for webhooks and server logic
