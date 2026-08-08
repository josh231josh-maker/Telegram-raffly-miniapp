"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { UsdtIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

type BalanceCardProps = {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  variant: "purple" | "gold";
};

const CARD_CLASSES: Record<BalanceCardProps["variant"], string> = {
  purple: "card-purple text-white",
  gold: "card-gold text-[#1a0a33]",
};
const SUBTLE_CLASSES: Record<BalanceCardProps["variant"], { icon: string; label: string; sub: string }> = {
  purple: { icon: "bg-white/20", label: "text-white/80", sub: "text-white/70" },
  gold: { icon: "bg-black/10", label: "text-[#1a0a33]/70", sub: "text-[#1a0a33]/60" },
};

function BalanceCard({ label, value, sublabel, icon, variant }: BalanceCardProps) {
  const cardClass = CARD_CLASSES[variant];
  const subtle = SUBTLE_CLASSES[variant];

  return (
    <article className={`${cardClass} rounded-[24px] p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`text-sm font-medium ${subtle.label}`}>{label}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${subtle.icon}`}>
          {icon}
        </span>
      </div>
      <p className="font-heading text-3xl font-bold tracking-tight">{value}</p>
      {sublabel && <p className={`mt-1 text-xs ${subtle.sub}`}>{sublabel}</p>}
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
        icon={<TicketImage size={22} />}
        variant="purple"
      />
      <BalanceCard
        label="USDT"
        value={loadingUser ? "…" : `$${usdtBalance}`}
        icon={<UsdtIcon className="h-4 w-4" />}
        variant="gold"
      />
    </section>
  );
}
