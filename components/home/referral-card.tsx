"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function ReferralCard() {
  const { user, loadingUser } = useTelegram();
  const [copied, setCopied] = useState(false);

  if (loadingUser || !user) return null;

  const referralLink = `https://t.me/Rafflyapp_bot/Raffly?startapp=${user.telegram_id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available, ignore silently
    }
  };

  return (
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">Invite Friends</span>
        <span className="text-xs text-indigo-200/50">+50 tickets each</span>
      </div>
      <p className="mb-3 text-xs text-indigo-200/50">
        Earn 50 tickets when a friend you invite reaches 10 tickets.
      </p>
      <button
        onClick={handleCopy}
        className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-indigo-950 transition"
      >
        {copied ? "Link copied!" : "Copy invite link"}
      </button>
    </section>
  );
}