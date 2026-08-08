import { RAFFLY_PASS_STARS } from "@/lib/raffly-pass";

// TODO: raise back to real prices (10/50/100/250/500/1000) before launch — set to 1 for testing
export const STARS_TIERS: Record<string, { stars: number; tickets: number; label: string }> = {
  raffle10: { stars: 1, tickets: 12, label: "12 Raffle Tickets" },
  raffle50: { stars: 1, tickets: 70, label: "70 Raffle Tickets" },
  raffle100: { stars: 1, tickets: 150, label: "150 Raffle Tickets" },
  raffle250: { stars: 1, tickets: 400, label: "400 Raffle Tickets" },
  raffle500: { stars: 1, tickets: 850, label: "850 Raffle Tickets" },
  raffle1000: { stars: 1, tickets: 1800, label: "1800 Raffle Tickets" },
  pass: { stars: RAFFLY_PASS_STARS, tickets: 0, label: "Raffly Pass — 30 Days" },
};
