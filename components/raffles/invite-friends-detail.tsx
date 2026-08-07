"use client";

import { useState } from "react";
import { shareURL } from "@telegram-apps/sdk";
import { REFERRAL_REWARD_TICKETS, REFERRAL_TICKET_THRESHOLD } from "@/lib/referral";
import { CloseIcon, TicketIcon } from "@/components/icons";

type InviteFriendsDetailProps = {
  referralLink: string;
  referralCount: number;
  referralReachedCount: number;
  onClose: () => void;
};

export function InviteFriendsDetail({
  referralLink,
  referralCount,
  referralReachedCount,
  onClose,
}: InviteFriendsDetailProps) {
  const [copied, setCopied] = useState(false);

  const totalProfit = referralReachedCount * REFERRAL_REWARD_TICKETS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available, ignore silently
    }
  };

  const handleShare = () => {
    try {
      if (shareURL.isAvailable()) {
        shareURL(referralLink, "Join me on Raffly and win weekly USDT raffles!");
      }
    } catch {
      // sharing unavailable outside Telegram, ignore silently
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-text">
      <div className="flex items-center gap-3 px-5 pt-6">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-text-dim"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
        <h1 className="font-heading text-lg font-bold text-text">Invite Friends</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <div className="grid grid-cols-2 divide-x divide-border rounded-2xl border border-border bg-card p-4 text-center">
          <div>
            <p className="font-heading text-2xl font-bold text-text">{referralCount}</p>
            <p className="mt-0.5 text-xs text-text-faint">Friends You Invited</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-text">{referralReachedCount}</p>
            <p className="mt-0.5 text-xs text-text-faint">Reached {REFERRAL_TICKET_THRESHOLD} Tickets</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-green/25 bg-green-soft px-5 py-4">
          <span className="text-sm font-semibold text-text">Total profit</span>
          <span className="flex items-center gap-1.5 font-heading text-xl font-bold text-green">
            {totalProfit}
            <TicketIcon className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-accent transition"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleShare}
            className="btn-accent rounded-xl py-3 text-sm font-semibold transition"
          >
            Invite Friends
          </button>
        </div>

        <div className="mt-7">
          <h2 className="mb-2 font-heading text-base font-bold text-text">How does it work?</h2>
          <p className="text-sm leading-relaxed text-text-dim">
            Share your invite link with friends. When someone joins Raffly through your link and earns{" "}
            {REFERRAL_TICKET_THRESHOLD} tickets, you get{" "}
            <span className="font-semibold text-text">{REFERRAL_REWARD_TICKETS} tickets</span> added to
            your balance — automatically, with no limit on how many friends you can invite.
          </p>
        </div>
      </div>
    </div>
  );
}
