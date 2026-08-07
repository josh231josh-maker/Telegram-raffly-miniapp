"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { GiftIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { InviteFriendsDetail } from "@/components/raffles/invite-friends-detail";

export function ReferralCard() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return null;

  const referralLink = `https://t.me/Rafflyapp_bot/Raffly?startapp=${user.telegram_id}`;

  return (
    <>
      <TaskRow
        icon={<GiftIcon />}
        tone="pink"
        label="Invite Friends"
        sublabel="Earn tickets per referral"
        rewardLabel="+50"
        onClick={() => setOpen(true)}
        chevron
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
