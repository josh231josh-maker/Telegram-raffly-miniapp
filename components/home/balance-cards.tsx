"use client";

import { useTelegram } from "@/components/providers/telegram-provider";

function TicketIcon() {
  return (
    <span className="text-xl text-gold" aria-hidden="true">
      🎟️
    </span>
  );
}

function UsdtIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6 text-emerald-400"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.88 2.4-1.52 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
    </svg>
  );
}

type BalanceCardProps = {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: "gold" | "emerald";
};

function BalanceCard({ label, value, sublabel, icon, accent }: BalanceCardProps) {
  const accentBorder =
    accent === "gold" ? "border-gold/20" : "border-emerald-400/20";

  return (
    <article
      className={`card-glow rounded-2xl border bg-card p-5 backdrop-blur-sm ${accentBorder}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-indigo-200/50">{sublabel}</p>
    </article>
  );
}

export function BalanceCards() {
  const { user, loadingUser } = useTelegram();

  const ticketBalance = user?.ticket_balance ?? 0;
  const usdtBalance = (user?.usdt_balance ?? 0).toFixed(2);

  return (
    <section className="grid grid-cols-2 gap-3" aria-label="Your balances">
      <BalanceCard
        label="Tickets"
        value={loadingUser ? "…" : String(ticketBalance)}
        sublabel="Never expire"
        icon={<TicketIcon />}
        accent="gold"
      />
      <BalanceCard
        label="USDT"
        value={loadingUser ? "…" : `$${usdtBalance}`}
        sublabel="Withdraw at $30"
        icon={<UsdtIcon />}
        accent="emerald"
      />
    </section>
  );
}