"use client";

import { cloneElement, isValidElement, useId } from "react";

type IconBadgeProps = {
  icon: React.ReactNode;
  tone?: "accent" | "gold" | "green" | "ruby";
  size?: "sm" | "md" | "lg";
};

/** Layered radial gradients rendered as a metal medallion, standing in for a photographed coin/badge instead of a flat emoji-style icon. */
const GRADIENT_STOPS: Record<string, [string, string, string, string]> = {
  gold: ["#fff3d1", "#f7cf6b", "#d89a2e", "#8a5c14"],
  green: ["#d6fff0", "#5be3ae", "#1fae7c", "#0d6a4c"],
  ruby: ["#ffd7e6", "#f27fa8", "#c23f74", "#6e1d43"],
};

const RING_COLOR: Record<string, string> = {
  gold: "#6b4610",
  green: "#0d6a4c",
  ruby: "#4a1030",
};

const ICON_COLOR: Record<string, string> = {
  gold: "#6b4610",
  green: "#0d3d2c",
  ruby: "#4a1030",
};

const CONTAINER_SIZE_CLASSES: Record<NonNullable<IconBadgeProps["size"]>, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

const ICON_SIZE_CLASSES: Record<NonNullable<IconBadgeProps["size"]>, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function IconBadge({ icon, tone = "accent", size = "md" }: IconBadgeProps) {
  const key = tone === "accent" ? "gold" : tone;
  const gradId = useId();
  const [c1, c2, c3, c4] = GRADIENT_STOPS[key];

  const sizedIcon = isValidElement<{ className?: string }>(icon)
    ? cloneElement(icon, {
        className: `${ICON_SIZE_CLASSES[size]} ${icon.props.className ?? ""}`.trim(),
      })
    : icon;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${CONTAINER_SIZE_CLASSES[size]}`}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <radialGradient id={gradId} cx="35%" cy="28%" r="75%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="38%" stopColor={c2} />
            <stop offset="72%" stopColor={c3} />
            <stop offset="100%" stopColor={c4} />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="19" fill={`url(#${gradId})`} stroke={RING_COLOR[key]} strokeWidth="0.75" />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
      </svg>
      <span className="relative" style={{ color: ICON_COLOR[key] }}>
        {sizedIcon}
      </span>
    </span>
  );
}
