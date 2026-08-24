"use client";

import { useState } from "react";
import { shareURL } from "@telegram-apps/sdk";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { REFERRAL_REWARD_TICKETS, REFERRAL_TICKET_THRESHOLD } from "@/lib/referral";
import { CloseIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";
import { useLanguage } from "@/components/providers/language-provider";

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
  const { t } = useLanguage();
  useTelegramBackButton(onClose);
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
        shareURL(referralLink, t("referral.shareText"));
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
          aria-label={t("common.close")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-text-dim"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
        <h1 className="font-heading text-lg font-bold text-text">{t("referral.inviteFriends")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <div className="grid grid-cols-2 divide-x divide-border rounded-2xl border border-border bg-card p-4 text-center">
          <div>
            <p className="font-heading text-2xl font-bold text-text">{referralCount}</p>
            <p className="mt-0.5 text-xs text-text-faint">{t("referral.friendsInvited")}</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-text">{referralReachedCount}</p>
            <p className="mt-0.5 text-xs text-text-faint">
              {t("referral.reachedTickets", { n: REFERRAL_TICKET_THRESHOLD })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-green/25 bg-green-soft px-5 py-4">
          <span className="text-sm font-semibold text-text">{t("referral.totalProfit")}</span>
          <span className="flex items-center gap-1.5 font-heading text-xl font-bold text-green">
            {totalProfit}
            <TicketImage size={22} />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-accent transition"
          >
            {copied ? t("referral.copied") : t("referral.copyLink")}
          </button>
          <button
            onClick={handleShare}
            className="btn-accent rounded-xl py-3 text-sm font-semibold transition"
          >
            {t("referral.inviteFriends")}
          </button>
        </div>

        <div className="mt-7">
          <h2 className="mb-2 font-heading text-base font-bold text-text">{t("referral.howItWorks")}</h2>
          <p className="text-sm leading-relaxed text-text-dim">
            {t("referral.howItWorksBody", {
              threshold: REFERRAL_TICKET_THRESHOLD,
              reward: REFERRAL_REWARD_TICKETS,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
