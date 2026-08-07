"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { UsdtIcon } from "@/components/icons";
import { IconBadge } from "@/components/icon-badge";
import { TicketImage } from "@/components/ticket-image";

type BalanceCardProps = {
  label: string;
  value: string;
  sublabel?: string;
  icon?: React.ReactNode;
  flatIcon?: React.ReactNode;
  accent: "gold" | "green";
};

function BalanceCard({ label, value, sublabel, icon, flatIcon, accent }: BalanceCardProps) {
  const accentBorder = accent === "gold" ? "border-gold/25" : "border-green/25";

  return (
    <article className={`card-soft rounded-2xl border bg-card p-5 ${accentBorder}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-dim">{label}</span>
        {flatIcon ?? <IconBadge icon={icon} tone={accent} size="sm" />}
      </div>
      <p className="font-heading text-3xl font-bold tracking-tight text-text">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-text-faint">{sublabel}</p>}
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
        flatIcon={<TicketImage size={36} />}
        accent="gold"
      />
      <BalanceCard
        label="USDT"
        value={loadingUser ? "…" : `$${usdtBalance}`}
        icon={<UsdtIcon />}
        accent="green"
      />
    </section>
  );
}
