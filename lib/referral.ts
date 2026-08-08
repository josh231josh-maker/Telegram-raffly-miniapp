import { SupabaseClient } from "@supabase/supabase-js";

export const REFERRAL_TICKET_THRESHOLD = 500;
export const REFERRAL_REWARD_TICKETS = 50;

/**
 * Computed live from `referred_by` rather than a stored counter, so it can
 * never drift out of sync. Any endpoint that returns a `user` object to the
 * client must go through this, or referral_count/referral_reached_count come
 * back undefined and silently overwrite the real values already in context.
 */
export async function withReferralCount<T extends { id: string }>(
  supabase: SupabaseClient,
  user: T
) {
  const [{ count }, { count: reachedCount }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("referred_by", user.id),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id)
      .eq("referral_reward_given", true),
  ]);
  return { ...user, referral_count: count ?? 0, referral_reached_count: reachedCount ?? 0 };
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