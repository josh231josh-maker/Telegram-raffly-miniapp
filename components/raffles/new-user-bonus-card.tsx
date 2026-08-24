"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { GiftIcon } from "@/components/icons";
import { TaskRow } from "@/components/raffles/task-row";
import { TaskRowSkeleton } from "@/components/raffles/task-row-skeleton";
import { NEW_USER_BONUS_TICKETS } from "@/lib/new-user-bonus";

export function NewUserBonusCard() {
  const { user, claimNewUserBonus, loadingUser } = useTelegram();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || !user) return <TaskRowSkeleton />;
  // One-time task -- once claimed it moves to the Completed section
  // (see CompletedTasksSection) instead of staying tappable here.
  if (user.new_user_bonus_claimed_at) return null;

  const handleClaim = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await claimNewUserBonus();
    setStatus("idle");
    if (result.error) {
      setMessage(result.error);
    }
  };

  return (
    <>
      <TaskRow
        icon={<GiftIcon />}
        tone="pink"
        label={status === "loading" ? t("newUserBonus.claiming") : t("newUserBonus.label")}
        sublabel={t("newUserBonus.sublabel")}
        rewardLabel={`+${NEW_USER_BONUS_TICKETS}`}
        onClick={handleClaim}
        disabled={status === "loading"}
      />
      {message && <p className="mt-1 px-2 text-xs text-text-faint">{message}</p>}
    </>
  );
}
