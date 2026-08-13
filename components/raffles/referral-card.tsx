"use client";

import { useState } from "react";
import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { TaskRow } from "@/components/raffles/task-row";
import { InviteFriendsDetail } from "@/components/raffles/invite-friends-detail";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";
import { REFERRAL_REWARD_TICKETS } from "@/lib/referral";

export function ReferralCard() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return <TaskRowSkeleton />;

  const referralLink = `https://t.me/Rafflyapp_bot/Raffly?startapp=${user.telegram_id}`;

  return (
    <>
      <TaskRow
        icon={<Image src="/images/referral-icon.png" alt="" width={36} height={35} />}
        tone="pink"
        label="Invite Friends"
        sublabel="Earn tickets per referral"
        rewardLabel={`+${REFERRAL_REWARD_TICKETS}`}
        onClick={() => setOpen(true)}
      />
      {open && (
        <InviteFriendsDetail
          referralLink={referralLink}
          referralCount={user.referral_count}
          referralReachedCount={user.referral_reached_count}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
