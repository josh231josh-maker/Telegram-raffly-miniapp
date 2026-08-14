export const RAFFLY_PASS_STARS = 500;
export const RAFFLY_PASS_DURATION_DAYS = 30;
export const RAFFLY_PASS_DAILY_TICKETS = 25;

export function isPassActive(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() > Date.now();
}
