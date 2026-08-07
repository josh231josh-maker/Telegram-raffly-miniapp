type IconBadgeProps = {
  icon: React.ReactNode;
  tone?: "accent" | "gold" | "purple" | "orange" | "pink" | "ruby" | "green";
  size?: "sm" | "md" | "lg";
};

const TONE_ALIAS: Record<string, "purple" | "orange" | "pink" | "green"> = {
  accent: "orange",
  gold: "orange",
  orange: "orange",
  ruby: "pink",
  pink: "pink",
  purple: "purple",
  green: "green",
};

const TONE_CLASSES: Record<"purple" | "orange" | "pink" | "green", string> = {
  purple: "bg-purple-soft text-purple",
  orange: "bg-accent-soft text-accent",
  pink: "bg-pink-soft text-pink",
  green: "bg-green-soft text-green",
};

const SIZE_CLASSES: Record<NonNullable<IconBadgeProps["size"]>, string> = {
  sm: "h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]",
  md: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-16 w-16 [&>svg]:h-8 [&>svg]:w-8",
};

export function IconBadge({ icon, tone = "accent", size = "md" }: IconBadgeProps) {
  const key = TONE_ALIAS[tone];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[key]} ${SIZE_CLASSES[size]}`}
    >
      {icon}
    </span>
  );
}
