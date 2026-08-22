"use client";

import { useState } from "react";
import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
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
        icon={<Image src="/images/telegram-channel-icon.png" alt="" width={28} height={28} />}
        tone="orange"
        label="Join Our Channel"
        rewardLabel={`+${CHANNEL_TASK_REWARD_TICKETS}`}
        onClick={() => setOpen(true)}
      />
      {open && <JoinChannelDetail onClose={() => setOpen(false)} />}
    </>
  );
}
