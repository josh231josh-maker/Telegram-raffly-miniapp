"use client";

import { IconBadge } from "@/components/icon-badge";
import { TicketIcon, ChevronRightIcon } from "@/components/icons";

type TaskRowProps = {
  icon: React.ReactNode;
  tone?: "gold" | "green" | "ruby";
  label: string;
  sublabel?: string;
  rewardLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  chevron?: boolean;
};

export function TaskRow({
  icon,
  tone = "gold",
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
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold">
        {rewardLabel}
        <TicketIcon className="h-3.5 w-3.5" />
      </span>
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-faint" />}
    </button>
  );
}
