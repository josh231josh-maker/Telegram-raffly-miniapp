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

export async function checkAndRewardReferral(supabase: SupabaseClient, userId: string) {
  const { data: user } = await supabase
    .from("users")
    .select("id, referred_by, referral_reward_given, ticket_balance")
    .eq("id", userId)
    .single();

  if (!user || !user.referred_by || user.referral_reward_given) {
    return;
  }

  if (user.ticket_balance < REFERRAL_TICKET_THRESHOLD) {
    return;
  }

  const { data: referrer } = await supabase
    .from("users")
    .select("id, ticket_balance")
    .eq("id", user.referred_by)
    .single();

  if (!referrer) {
    return;
  }

  await supabase
    .from("users")
    .update({ ticket_balance: referrer.ticket_balance + REFERRAL_REWARD_TICKETS })
    .eq("id", referrer.id);

  await supabase
    .from("users")
    .update({ referral_reward_given: true })
    .eq("id", user.id);
}