"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { SendIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";
import { JoinChannelDetail } from "@/components/raffles/join-channel-detail";
import { CHANNEL_TASK_REWARD_TICKETS } from "@/lib/channel-task";

export function JoinChannelCard() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return <TaskRowSkeleton />;
  // One-time task -- once claimed it moves to the Completed section
  // (see CompletedTasksSection) instead of staying tappable here.
  if (user.channel_joined_at) return null;

  return (
    <>
      <TaskRow
        icon={<SendIcon className="h-[18px] w-[18px]" />}
        tone="purple"
        label="Join Our Channel"
        sublabel="Official Raffly Announcement channel"
        rewardLabel={`+${CHANNEL_TASK_REWARD_TICKETS}`}
        onClick={() => setOpen(true)}
      />
      {open && <JoinChannelDetail onClose={() => setOpen(false)} />}
    </>
  );
}
