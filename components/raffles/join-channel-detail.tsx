"use client";

import { useState } from "react";
import Image from "next/image";
import { openTelegramLink } from "@telegram-apps/sdk";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { CHANNEL_TASK_REWARD_TICKETS, CHANNEL_TASK_URL } from "@/lib/channel-task";
import { TicketImage } from "@/components/ticket-image";
import { CloseIcon } from "@/components/icons";

type JoinChannelDetailProps = {
  onClose: () => void;
};

function openChannel() {
  if (openTelegramLink.isAvailable()) {
    openTelegramLink(CHANNEL_TASK_URL);
  } else {
    window.open(CHANNEL_TASK_URL, "_blank", "noopener,noreferrer");
  }
}

export function JoinChannelDetail({ onClose }: JoinChannelDetailProps) {
  const { claimChannelTask } = useTelegram();
  useTelegramBackButton(onClose);
  const [status, setStatus] = useState<"idle" | "verifying">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    setMessage(null);
    setStatus("verifying");
    const result = await claimChannelTask();
    setStatus("idle");
    if (result.verified || result.alreadyClaimed) {
      onClose();
      return;
    }
    setMessage(result.error ?? "Something went wrong. Please try again.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" onClick={onClose}>
      <div
        className="card-soft w-full max-w-sm rounded-[28px] border border-border bg-card p-5 text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Image src="/images/telegram-channel-icon.png" alt="" width={26} height={26} />
            </span>
            <h2 className="font-heading text-lg font-bold text-balance">Join Our Channel</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text-dim"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm text-text-dim text-pretty">
          Join the Raffly Announcement channel for raffle updates and winner announcements.
        </p>

        <div className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-background py-3 text-lg font-bold text-accent">
          +{CHANNEL_TASK_REWARD_TICKETS}
          <TicketImage size={20} />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={openChannel}
            className="btn-accent w-full rounded-full px-4 py-3 text-sm font-bold transition"
          >
            Join Channel
          </button>
          <button
            onClick={handleVerify}
            disabled={status === "verifying"}
            className="w-full rounded-full border border-border px-4 py-3 text-sm font-bold text-text transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "verifying" ? "Checking..." : "Already Did"}
          </button>
        </div>
        {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
      </div>
    </div>
  );
}
