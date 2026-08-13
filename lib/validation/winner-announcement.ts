const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_WEEK_LABEL_LENGTH = 40;
// Generous relative to the standard weekly prize (lib/raffle-week.ts's
// PRIZE_PER_WINNER_USDT) -- admins can legitimately announce a one-off
// bonus prize, so this just catches obvious typos/garbage, not enforces a
// specific business amount.
const MAX_PRIZE_AMOUNT = 1_000_000;

type WinnerAnnouncementFields = {
  display_name?: unknown;
  prize_amount?: unknown;
  week_label?: unknown;
};

/** Returns an error message if any provided field is invalid, otherwise null. */
export function validateWinnerAnnouncementFields(fields: WinnerAnnouncementFields): string | null {
  if (fields.display_name !== undefined) {
    if (typeof fields.display_name !== "string" || fields.display_name.trim().length === 0) {
      return "display_name must be a non-empty string";
    }
    if (fields.display_name.length > MAX_DISPLAY_NAME_LENGTH) {
      return `display_name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer`;
    }
  }

  if (fields.prize_amount !== undefined) {
    const amount = Number(fields.prize_amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_PRIZE_AMOUNT) {
      return `prize_amount must be a number between 0 and ${MAX_PRIZE_AMOUNT}`;
    }
  }

  if (fields.week_label !== undefined && fields.week_label !== null) {
    if (typeof fields.week_label !== "string") {
      return "week_label must be a string";
    }
    if (fields.week_label.length > MAX_WEEK_LABEL_LENGTH) {
      return `week_label must be ${MAX_WEEK_LABEL_LENGTH} characters or fewer`;
    }
  }

  return null;
}
