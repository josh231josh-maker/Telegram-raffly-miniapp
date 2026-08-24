"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { ArrowDownCircleIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

// Code-split: pulls in TonConnect only when actually opened, not as part of
// every session's initial bundle.
const WithdrawModalWithProvider = dynamic(
  () => import("@/components/profile/withdraw-modal-with-provider"),
  { ssr: false }
);

export function WithdrawButton() {
  const { user, loadingUser } = useTelegram();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (loadingUser || !user) return <Skeleton className="h-[46px] w-full rounded-full" />;

  const balance = user.usdt_balance ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card-soft flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-green transition active:scale-[0.99]"
      >
        <ArrowDownCircleIcon className="h-4 w-4" />
        {t("withdraw.button", { amount: balance.toFixed(2) })}
      </button>
      {open && <WithdrawModalWithProvider onClose={() => setOpen(false)} />}
    </>
  );
}
