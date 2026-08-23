export const RAFFLY_PASS_STARS = 500;
export const RAFFLY_PASS_DURATION_DAYS = 30;
export const RAFFLY_PASS_DAILY_TICKETS = 15;

export function isPassActive(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() > Date.now();
}

// Shared with raffly-pass-detail.tsx and claim-pass-button.tsx so both
// agree on what "already claimed today" means -- the server's own gate
// (try_claim_pass_tickets) compares against the same UTC calendar date.
export function hasClaimedPassToday(lastClaimDate: string | null): boolean {
  return lastClaimDate === new Date().toISOString().slice(0, 10);
}
