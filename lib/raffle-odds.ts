/**
 * P(win) = 1 - C(T-M, W) / C(T, W) -- the exact probability that at least
 * one of your M tickets is among the W winning draws out of T total
 * tickets. Computed as a running product rather than raw factorials/C(n,k)
 * so it stays numerically stable for large ticket pools:
 *   C(T-M, W) / C(T, W) = product[i=0..W-1] of (T-M-i) / (T-i)
 *
 * Deliberately a function of the ticket pool alone -- how many distinct
 * people have entered doesn't factor in, by design, even though the real
 * draw (pickWinners in lib/raffle-draw.ts) can only ever draw as many
 * winners as there are entrants.
 */
export function winProbabilityPct(yourTickets: number, totalTickets: number, winnerSlots: number): number {
  if (totalTickets <= 0 || yourTickets <= 0) return 0;

  const M = Math.min(yourTickets, totalTickets);
  const T = totalTickets;
  const W = Math.min(winnerSlots, T);

  // Fewer than W tickets remain outside your own -- you're guaranteed a win.
  if (T - M < W) return 100;

  let missRatio = 1;
  for (let i = 0; i < W; i++) {
    missRatio *= (T - M - i) / (T - i);
  }

  return Math.min(100, Math.max(0, (1 - missRatio) * 100));
}
