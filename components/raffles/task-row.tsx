"use client";

import { IconBadge } from "@/components/icon-badge";
import { ChevronRightIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

type TaskRowProps = {
  icon: React.ReactNode;
  tone?: "purple" | "orange" | "pink" | "green";
  label: string;
  sublabel?: string;
  rewardLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  chevron?: boolean;
};

const REWARD_CLASSES: Record<NonNullable<TaskRowProps["tone"]>, string> = {
  purple: "bg-purple-soft text-purple",
  orange: "bg-accent-soft text-accent",
  pink: "bg-pink-soft text-pink",
  green: "bg-green-soft text-green",
};

export function TaskRow({
  icon,
  tone = "orange",
  label,
  sublabel,
  rewardLabel,
  onClick,
  disabled,
  chevron,
}: TaskRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card-soft flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <IconBadge icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{label}</span>
        {sublabel && <span className="block text-xs text-text-faint">{sublabel}</span>}
      </span>
      <span
        className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          disabled ? "bg-border text-text-faint" : REWARD_CLASSES[tone]
        }`}
      >
        {rewardLabel}
        <TicketImage size={14} />
      </span>
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-faint" />}
    </button>
  );
}
