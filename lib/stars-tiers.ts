import { RAFFLY_PASS_STARS } from "@/lib/raffly-pass";

// Production pricing. This is the server-side source of truth: both
// /api/stars/create-invoice (sets the invoice price) and the webhook's
// pre_checkout_query / successful_payment handlers (validate the paid
// amount) read from this table, so the client can never determine or alter
// the trusted price.
export const STARS_TIERS: Record<string, { stars: number; tickets: number; label: string }> = {
  raffle50: { stars: 50, tickets: 70, label: "70 Raffle Tickets" },
  raffle100: { stars: 100, tickets: 140, label: "140 Raffle Tickets" },
  raffle250: { stars: 250, tickets: 350, label: "350 Raffle Tickets" },
  raffle500: { stars: 500, tickets: 700, label: "700 Raffle Tickets" },
  raffle1000: { stars: 1000, tickets: 1400, label: "1400 Raffle Tickets" },
  raffle3000: { stars: 3000, tickets: 4200, label: "4200 Raffle Tickets" },
  pass: { stars: RAFFLY_PASS_STARS, tickets: 0, label: "Raffly Pass — 30 Days" },
};
