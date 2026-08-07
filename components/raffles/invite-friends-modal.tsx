"use client";

import { useState } from "react";
import { CloseIcon, GiftIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";

type InviteFriendsModalProps = {
  referralLink: string;
  referralCount: number;
  onClose: () => void;
};

export function InviteFriendsModal({ referralLink, referralCount, onClose }: InviteFriendsModalProps) {
  const [copied, setCopied] = useState(false);

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
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-t-3xl bg-card p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-text">Invite Friends</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-text-dim"
            aria-label="Close"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 py-4">
          <IconBadge icon={<GiftIcon />} tone="gold" size="lg" />
          <span className="font-heading text-2xl font-bold text-text">{referralCount}</span>
          <span className="text-xs text-text-faint">friends invited</span>
        </div>

        <p className="mb-4 text-center text-xs text-text-dim">
          Earn <span className="font-semibold text-text">50 tickets</span> for every friend you invite once
          they reach 10 tickets. No limit on how many friends you can invite.
        </p>

        <button
          onClick={handleCopy}
          className="btn-accent w-full rounded-xl px-4 py-3 text-sm font-semibold transition"
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
