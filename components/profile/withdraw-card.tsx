"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function WithdrawCard() {
  const { user, requestWithdrawal, loadingUser } = useTelegram();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || !user) return null;

  const balance = user.usdt_balance ?? 0;

  const handleWithdraw = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await requestWithdrawal(balance, "");
    if (result.success) {
      setStatus("done");
      setMessage("Withdrawal requested! We'll process it shortly.");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("idle");
      setMessage(result.error ?? "Something went wrong");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleWithdraw}
        disabled={status === "loading" || balance <= 0}
        className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "loading" ? "Processing..." : `Withdraw $${balance.toFixed(2)}`}
      </button>
      {message && <p className="text-center text-xs text-text-faint">{message}</p>}
    </div>
  );
}
