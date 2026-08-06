"use client";

import { useState } from "react";

type RafflyPassDetailProps = {
  onClose: () => void;
};

const BENEFITS = [
  "20 tickets every day for 30 days",
  "2× tickets from watching ads",
  "Double daily check-in rewards",
];

export function RafflyPassDetail({ onClose }: RafflyPassDetailProps) {
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  const handleGetPass = () => {
    // Raffly Pass isn't wired to a payment tier on the backend yet, so
    // surface that plainly instead of pretending to charge Stars.
    setStatus("pending");
    setTimeout(() => setStatus("idle"), 1500);
  };

  return (
    <div className="pass-gradient fixed inset-0 z-50 flex flex-col text-white">
      <div className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-10 pt-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl"
          aria-hidden="true"
        >
          👑
        </div>
        <h1 className="font-heading mt-4 text-2xl font-bold">Raffly Pass</h1>
        <p className="font-heading mt-1 text-3xl font-bold text-gold">500 ⭐</p>
        <p className="text-xs text-white/50">one-time purchase</p>

        <div className="mt-6 w-full rounded-2xl bg-white/5 p-4 text-left">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3 py-2">
              <span className="mt-0.5 text-gold" aria-hidden="true">
                ✓
              </span>
              <span className="text-sm text-white/80">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 w-full rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-sm font-semibold text-gold">You&apos;ll receive 600+ tickets this month</p>
        </div>

        <button
          onClick={handleGetPass}
          disabled={status === "pending"}
          className="mt-6 w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-[#1a1238] transition disabled:opacity-60"
        >
          {status === "pending" ? "Coming soon" : "Get Raffly Pass"}
        </button>
        <p className="mt-3 text-[11px] text-white/40">Does not auto-renew.</p>
      </div>
    </div>
  );
}
