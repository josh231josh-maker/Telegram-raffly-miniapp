import { SupabaseClient } from "@supabase/supabase-js";

export const REFERRAL_TICKET_THRESHOLD = 200;
export const REFERRAL_REWARD_TICKETS = 100;

/**
 * Computed live from `referred_by` rather than a stored counter, so it can
 * never drift out of sync. Any endpoint that returns a `user` object to the
 * client must go through this, or referral_count/referral_reached_count come
 * back undefined and silently overwrite the real values already in context.
 *
 * This is on the hottest path in the app -- called on every /api/auth
 * request (every app open, plus every refreshUser() poll while watching an
 * ad) as well as check-in, raffle entry, withdraw, and pass-claim. It used
 * to run two separate head-count queries; get_referral_counts folds both
 * into a single indexed aggregate query (idx_users_referred_by) so each of
 * those requests costs one Supabase round trip here instead of two.
 */
export async function withReferralCount<T extends { id: string }>(
  supabase: SupabaseClient,
  user: T
) {
  const { data } = (await supabase
    .rpc("get_referral_counts", { p_user_id: user.id })
    .maybeSingle()) as { data: { referral_count: number; referral_reached_count: number } | null };
  return {
    ...user,
    referral_count: Number(data?.referral_count ?? 0),
    referral_reached_count: Number(data?.referral_reached_count ?? 0),
  };
}

/**
 * Called from many different endpoints (check-in, ad rewards, raffle entry,
 * Stars purchases, pass claims) any time a user's balance might have just
 * crossed the threshold, so concurrent calls for the same user are routine,
 * not an edge case. The whole check-and-pay sequence runs atomically inside
 * claim_referral_reward (row-locked), so it can't double-pay a referrer.
 */
export async function checkAndRewardReferral(supabase: SupabaseClient, userId: string) {
  await supabase.rpc("claim_referral_reward", {
    p_user_id: userId,
    p_threshold: REFERRAL_TICKET_THRESHOLD,
    p_reward: REFERRAL_REWARD_TICKETS,
  });
}