"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { ArrowDownCircleIcon } from "@/components/icons";
import { WithdrawModal } from "@/components/profile/withdraw-modal";

export function WithdrawButton() {
  const { user, loadingUser } = useTelegram();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return null;

  const balance = user.usdt_balance ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-green flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition"
      >
        <ArrowDownCircleIcon className="h-4 w-4" />
        Withdraw ${balance.toFixed(2)}
      </button>
      {open && <WithdrawModal onClose={() => setOpen(false)} />}
    </>
  );
}
