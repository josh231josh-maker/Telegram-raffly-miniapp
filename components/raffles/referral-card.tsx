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
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-dim">Invite Friends</span>
        <span className="text-xs text-text-faint">+50 tickets each</span>
      </div>
      <p className="mb-3 text-xs text-text-faint">
        Earn 50 tickets when a friend you invite reaches 10 tickets.
      </p>
      <button
        onClick={handleCopy}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition"
      >
        {copied ? "Link copied!" : "Copy invite link"}
      </button>
    </section>
  );
}
