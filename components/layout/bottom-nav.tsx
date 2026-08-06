"use client";

export type TabId = "home" | "raffles" | "profile";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "raffles", label: "Raffles" },
  { id: "profile", label: "Profile" },
];

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.3a1.5 1.5 0 0 0 0 3.4V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.3a1.5 1.5 0 0 0 0-3.4Z" />
      <path d="M14 7.5v9" strokeDasharray="2 2.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </svg>
  );
}

const ICONS: Record<TabId, (props: { className?: string }) => React.ReactElement> = {
  home: HomeIcon,
  raffles: TicketIcon,
  profile: UserIcon,
};

type BottomNavProps = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <nav className="nav-shadow flex w-full max-w-xs items-center justify-around rounded-full border border-border bg-card/90 px-2 py-2 backdrop-blur-md">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const Icon = ICONS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 transition"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute -top-1 h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              )}
              <Icon className={`h-5 w-5 ${isActive ? "text-accent" : "text-text-faint"}`} />
              <span
                className={`text-[10px] font-medium ${isActive ? "text-accent" : "text-text-faint"}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
