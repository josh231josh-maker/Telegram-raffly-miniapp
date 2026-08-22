import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAndRewardReferral, withReferralCount } from "@/lib/referral";
import { checkChatMembership } from "@/lib/telegram-bot";
import { CHANNEL_TASK_REWARD_TICKETS, CHANNEL_TASK_USERNAME } from "@/lib/channel-task";
import { RATE_LIMITS, rateLimitByIp, rateLimitByUser, rateLimitResponse } from "@/lib/rate-limit";
import { logger, safeServerError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ipCheck = await rateLimitByIp(req, "channelTask", RATE_LIMITS.channelTask.ip);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const { initData } = await req.json();
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const tgUser = verifyTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const userCheck = await rateLimitByUser(req, "channelTask", tgUser.id, RATE_LIMITS.channelTask.user);
  if (!userCheck.allowed) return rateLimitResponse(userCheck);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgUser.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.channel_joined_at) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  const membership = await checkChatMembership(botToken, CHANNEL_TASK_USERNAME, tgUser.id);
  if (!membership.ok) {
    // Most likely cause: the bot hasn't been added as an admin of the
    // channel yet, which Telegram also reports as a generic 400 -- logged
    // for that reason, but surfaced to the user as a retry-later rather
    // than a "you haven't joined" (which would be actively misleading if
    // it's actually a setup problem on our end, not theirs).
    logger.error("tasks.join_channel_membership_check_failed", {
      userId: existing.id,
      description: membership.description,
    });
    return NextResponse.json(
      { error: "Couldn't verify membership right now. Please try again shortly." },
      { status: 502 }
    );
  }

  if (!membership.isMember) {
    return NextResponse.json(
      { verified: false, error: "You haven't joined the channel yet. Join it, then try again." },
      { status: 400 }
    );
  }

  const { data: newBalance, error: rpcError } = await supabase.rpc("claim_channel_task", {
    p_user_id: existing.id,
    p_reward: CHANNEL_TASK_REWARD_TICKETS,
  });

  if (rpcError) {
    return NextResponse.json(
      safeServerError("tasks.join_channel_rpc_failed", rpcError, { userId: existing.id }),
      { status: 500 }
    );
  }

  if (newBalance === null) {
    return NextResponse.json({
      alreadyClaimed: true,
      user: await withReferralCount(supabase, existing),
    });
  }

  await checkAndRewardReferral(supabase, existing.id);

  const { data: updated } = await supabase.from("users").select("*").eq("id", existing.id).single();

  return NextResponse.json({
    verified: true,
    ticketsEarned: CHANNEL_TASK_REWARD_TICKETS,
    user: await withReferralCount(supabase, updated),
  });
}
