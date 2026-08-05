"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function EnterRaffleCard() {
  const { user, raffleEntry, loadingUser, loadingRaffleEntry, enterRaffle } = useTelegram();
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (loadingUser || loadingRaffleEntry || !user) return null;

  const available = user.ticket_balance;
  const alreadyEntered = raffleEntry?.ticketsEntered ?? 0;
  const raffleClosed = raffleEntry?.status != null && raffleEntry.status !== "open";
  const clampedAmount = Math.min(Math.max(amount, 0), available);

  const setClamped = (value: number) => {
    setAmount(Math.min(Math.max(Math.round(value), 0), available));
  };

  const handleEnter = async () => {
    if (clampedAmount <= 0) return;
    setMessage(null);
    setStatus("loading");
    const result = await enterRaffle(clampedAmount);
    setStatus("idle");
    if (result.success) {
      setMessage(`Entered ${clampedAmount} ticket${clampedAmount === 1 ? "" : "s"} into this week's draw!`);
      setAmount(0);
    } else {
      setMessage(result.error ?? "Something went wrong");
    }
  };

  return (
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Enter This Week&apos;s Raffle</span>
        <span className="text-xs text-indigo-200/50">{alreadyEntered} entered so far</span>
      </div>

      {raffleClosed ? (
        <p className="text-center text-xs text-indigo-200/60">
          Entries are closed while this week&apos;s draw is in progress.
        </p>
      ) : available <= 0 ? (
        <p className="text-center text-xs text-indigo-200/60">
          You have no tickets to enter. Earn tickets from check-ins, ads, or referrals.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              onClick={() => setClamped(clampedAmount - 1)}
              disabled={status === "loading" || clampedAmount <= 0}
              className="h-9 w-9 rounded-full border border-white/10 bg-black/20 text-lg text-indigo-100 transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease amount"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={available}
              value={clampedAmount}
              onChange={(e) => setClamped(Number(e.target.value))}
              disabled={status === "loading"}
              className="w-20 rounded-lg border border-white/10 bg-black/20 py-2 text-center text-lg font-semibold text-indigo-100"
            />
            <button
              onClick={() => setClamped(clampedAmount + 1)}
              disabled={status === "loading" || clampedAmount >= available}
              className="h-9 w-9 rounded-full border border-white/10 bg-black/20 text-lg text-indigo-100 transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increase amount"
            >
              +
            </button>
            <button
              onClick={() => setClamped(available)}
              disabled={status === "loading" || clampedAmount >= available}
              className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Max
            </button>
          </div>

          <p className="mb-3 text-center text-xs text-indigo-200/50">
            {available} ticket{available === 1 ? "" : "s"} available
          </p>

          <button
            onClick={handleEnter}
            disabled={status === "loading" || clampedAmount <= 0}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-indigo-950 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Entering..." : `Enter ${clampedAmount || ""} ticket${clampedAmount === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-center text-xs text-indigo-200/60">{message}</p>}
    </section>
  );
}