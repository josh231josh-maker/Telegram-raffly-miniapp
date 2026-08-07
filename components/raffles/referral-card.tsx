"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { GiftIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { InviteFriendsModal } from "@/components/raffles/invite-friends-modal";

export function ReferralCard() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return null;

  const referralLink = `https://t.me/Rafflyapp_bot/Raffly?startapp=${user.telegram_id}`;

  return (
    <>
      <TaskRow
        icon={<GiftIcon />}
        tone="gold"
        label="Invite Friends"
        sublabel="Earn tickets per referral"
        rewardLabel="+50"
        onClick={() => setOpen(true)}
        chevron
      />
      {open && (
        <InviteFriendsModal
          referralLink={referralLink}
          referralCount={user.referral_count}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
