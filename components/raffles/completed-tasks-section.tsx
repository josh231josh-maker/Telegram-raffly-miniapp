"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { isPassActive } from "@/lib/raffly-pass";
import { CompletedTaskRow } from "@/components/raffles/completed-task-row";
import { CHANNEL_TASK_REWARD_TICKETS } from "@/lib/channel-task";

// Lists finished tasks below the active task list: Daily Check-in once
// claimed for today, and Join Channel once verified -- built to hold more
// as they're added rather than hardcoding rows inline on the page.
export function CompletedTasksSection() {
  const { user } = useTelegram();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = user.last_checkin_date === today;
  const channelJoined = !!user.channel_joined_at;

  if (!checkedInToday && !channelJoined) return null;

  // After a successful check-in, streak_count holds exactly the reward-cycle
  // day just claimed (see app/api/checkin/route.ts) -- the same value
  // DailyCheckIn's rewardLabel would have shown before it disappeared.
  const hasPass = isPassActive(user.raffly_pass_expires_at);
  const dailyReward = hasPass ? (user.streak_count ?? 0) * 2 : user.streak_count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-dim">Completed</h2>
      {checkedInToday && <CompletedTaskRow label="Daily Check-in" rewardAmount={dailyReward} />}
      {channelJoined && (
        <CompletedTaskRow label="Join Our Channel" rewardAmount={CHANNEL_TASK_REWARD_TICKETS} />
      )}
    </div>
  );
}
