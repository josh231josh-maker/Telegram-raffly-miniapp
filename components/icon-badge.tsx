type IconBadgeProps = {
  icon: React.ReactNode;
  tone?: "accent" | "gold" | "green";
  size?: "sm" | "md";
};

const TONE_CLASSES: Record<NonNullable<IconBadgeProps["tone"]>, string> = {
  accent: "bg-accent-soft text-accent",
  gold: "bg-gold-soft text-gold",
  green: "bg-green-soft text-green",
};

const SIZE_CLASSES: Record<NonNullable<IconBadgeProps["size"]>, string> = {
  sm: "h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]",
  md: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5",
};

export function IconBadge({ icon, tone = "accent", size = "md" }: IconBadgeProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`}
    >
      {icon}
    </span>
  );
}
