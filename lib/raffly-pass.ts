// TODO: raise back to 500 before launch — reduced for testing.
export const RAFFLY_PASS_STARS = 10;
export const RAFFLY_PASS_DURATION_DAYS = 30;
export const RAFFLY_PASS_DAILY_TICKETS = 20;

export function isPassActive(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() > Date.now();
}
