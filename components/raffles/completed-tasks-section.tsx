"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { CompletedTaskRow } from "@/components/raffles/completed-task-row";
import { CHANNEL_TASK_REWARD_TICKETS } from "@/lib/channel-task";

// Lists finished one-time tasks below the active task list -- currently
// just Join Channel, but built to hold more as they're added rather than
// hardcoding a single row inline on the page.
export function CompletedTasksSection() {
  const { user } = useTelegram();

  if (!user?.channel_joined_at) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-dim">Completed</h2>
      <CompletedTaskRow label="Join Our Channel" rewardAmount={CHANNEL_TASK_REWARD_TICKETS} />
    </div>
  );
}
