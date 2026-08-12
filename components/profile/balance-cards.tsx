"use client";

import { useTelegram } from "@/components/providers/telegram-provider";
import { UsdtIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

type BalanceCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "purple" | "green";
};

function BalanceCard({ label, value, icon, variant }: BalanceCardProps) {
  const cardClass = variant === "purple" ? "card-purple" : "card-green";

  return (
    <article className={`${cardClass} rounded-[24px] p-4 text-white`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          {icon}
        </span>
      </div>
      <p className="font-heading text-2xl font-bold tracking-tight">{value}</p>
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
        icon={<TicketImage size={22} />}
        variant="purple"
      />
      <BalanceCard
        label="USDT"
        value={loadingUser ? "…" : `$${usdtBalance}`}
        icon={<UsdtIcon className="h-4 w-4" />}
        variant="green"
      />
    </section>
  );
}
