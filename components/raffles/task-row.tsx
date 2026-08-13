"use client";

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

// No badge/circle behind the icon or pill behind the reward anymore -- both
// used to sit in a colored, cropped container, which fights any icon (SVG or
// a real image like the Watch Ads one) that's already a complete, colorful
// piece of art on its own. Tone now only tints plain-stroke SVG icons
// (via currentColor) and the reward text -- it's a no-op className on
// something like a full-color raster icon, which is exactly the point.
const TONE_TEXT: Record<NonNullable<TaskRowProps["tone"]>, string> = {
  purple: "text-purple",
  orange: "text-accent",
  pink: "text-pink",
  green: "text-green",
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
      className="card-soft flex w-full items-center gap-3 rounded-[28px] border border-border bg-card px-4 py-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] ${TONE_TEXT[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text">{label}</span>
        {sublabel && <span className="block text-xs text-text-faint">{sublabel}</span>}
      </span>
      <span
        className={`flex shrink-0 items-center gap-1.5 text-base font-bold ${
          disabled ? "text-text-faint" : TONE_TEXT[tone]
        }`}
      >
        {rewardLabel}
        <TicketImage size={22} />
      </span>
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-faint" />}
    </button>
  );
}
