"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function WithdrawCard() {
  const { user, requestWithdrawal, loadingUser } = useTelegram();
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || !user) return null;

  const balance = user.usdt_balance ?? 0;

  const handleSubmit = async () => {
    setMessage(null);
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setMessage("Enter a valid amount");
      return;
    }
    if (numAmount > balance) {
      setMessage("Amount exceeds your balance");
      return;
    }
    if (!wallet || wallet.trim().length < 6) {
      setMessage("Enter a valid wallet address");
      return;
    }

    setStatus("loading");
    const result = await requestWithdrawal(numAmount, wallet.trim());
    if (result.success) {
      setStatus("done");
      setMessage("Withdrawal requested! It will be processed manually.");
      setAmount("");
      setWallet("");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("idle");
      setMessage(result.error ?? "Something went wrong");
    }
  };

  return (
    <section className="card-glow rounded-2xl border border-emerald-400/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Withdraw USDT</span>
        <span className="text-xs text-indigo-200/50">Balance: ${balance.toFixed(2)}</span>
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Amount (USDT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={status === "loading"}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-indigo-200/30 focus:outline-none"
        />
        <input
          type="text"
          placeholder="USDT wallet address (TRC20)"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          disabled={status === "loading"}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-indigo-200/30 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={status === "loading" || balance <= 0}
          className="mt-1 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-indigo-950 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Submitting..." : "Request Withdrawal"}
        </button>
        {message && <p className="text-xs text-indigo-200/60">{message}</p>}
      </div>
    </section>
  );
}