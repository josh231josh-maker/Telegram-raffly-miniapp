/**
 * P(win) = 1 - C(T-M, W) / C(T, W) -- the exact probability that at least
 * one of your M tickets is among the W winning draws out of T total
 * tickets. Computed as a running product rather than raw factorials/C(n,k)
 * so it stays numerically stable for large ticket pools:
 *   C(T-M, W) / C(T, W) = product[i=0..W-1] of (T-M-i) / (T-i)
 *
 * The ticket pool alone isn't the whole story, though: pickWinners (see
 * lib/raffle-draw.ts) draws winners one *entrant* at a time without
 * replacement, so it can never draw more winners than there are distinct
 * participants -- with fewer entrants than winner slots, the draw empties
 * the whole pool and every entrant wins, regardless of ticket weighting.
 * participants caps how many draws will actually happen; the ticket pool
 * still decides who wins among those draws once there are more entrants
 * than slots.
 */
export function winProbabilityPct(
  yourTickets: number,
  totalTickets: number,
  participants: number,
  winnerSlots: number
): number {
  if (totalTickets <= 0 || yourTickets <= 0) return 0;

  // At most `participants` winners will ever be drawn -- once entrants no
  // longer outnumber the slots, everyone who entered is guaranteed a win.
  if (participants <= winnerSlots) return 100;

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
