"use client";

import Image from "next/image";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
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
        <span className="flex shrink-0 items-center justify-center">{icon}</span>
      </div>
      <p className="font-heading text-2xl font-bold tracking-tight">{value}</p>
    </article>
  );
}

export function BalanceCards() {
  const { user, loadingUser } = useTelegram();
  const { t } = useLanguage();

  const ticketBalance = user?.ticket_balance ?? 0;
  const usdtBalance = (user?.usdt_balance ?? 0).toFixed(2);

  return (
    <section className="grid grid-cols-2 gap-3" aria-label={t("profile.balancesAria")}>
      <BalanceCard
        label={t("nav.raffles")}
        value={loadingUser ? "…" : String(ticketBalance)}
        icon={<TicketImage size={30} />}
        variant="purple"
      />
      <BalanceCard
        label="USDT"
        value={loadingUser ? "…" : `$${usdtBalance}`}
        icon={<Image src="/images/usdt-icon-3d.png" alt="" width={30} height={30} />}
        variant="green"
      />
    </section>
  );
}
