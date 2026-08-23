type IconProps = {
  className?: string;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function TicketIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.3a1.5 1.5 0 0 0 0 3.4V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.3a1.5 1.5 0 0 0 0-3.4Z" />
      <path d="M14 7.5v9" strokeDasharray="2 2.5" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className} aria-hidden="true">
      <path d="M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4" />
      <path d="M12 13v3M9 20h6M9.5 20c0-1.8.7-3 2.5-3s2.5 1.2 2.5 3" />
    </svg>
  );
}

export function CrownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 9h-13Z" />
      <path d="M5.5 20h13" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CalendarCheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
      <path d="M9 14.5l2 2 4-4.2" />
    </svg>
  );
}

export function PlayCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 9.2v5.6l4.6-2.8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GiftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
      <path d="M4 13.5h16M12 9.5v10.5" />
      <path d="M12 9.5c-1-3-3-4.5-4.3-3.3-1.3 1.2.3 3.3 4.3 3.3ZM12 9.5c1-3 3-4.5 4.3-3.3 1.3 1.2-.3 3.3-4.3 3.3Z" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowDownCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v7M8.7 12.3 12 15.5l3.3-3.2" />
    </svg>
  );
}
