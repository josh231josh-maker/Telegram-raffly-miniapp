"use client";
import { HomeHeader } from "@/components/home/home-header";
import { BalanceCards } from "@/components/home/balance-cards";
import { DrawCountdown } from "@/components/home/draw-countdown";
import { DailyCheckIn } from "@/components/home/daily-checkin";
import { WatchAdCard } from "@/components/home/watch-ad-card";
import { ReferralCard } from "@/components/home/referral-card";
import { RaffleStats } from "@/components/home/raffle-stats";
import { PreviousWinners } from "@/components/home/previous-winners";
import { WithdrawCard } from "@/components/home/withdraw-card";

export default function HomePage() {
  return (
    <main className="raffly-gradient ticket-pattern min-h-dvh px-4 pb-8 pt-6">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <HomeHeader />
        <BalanceCards />
        <RaffleStats />
        <DailyCheckIn />
        <WatchAdCard />
        <ReferralCard />
        <WithdrawCard />
        <DrawCountdown />
        <PreviousWinners />
        <p className="text-center text-xs text-indigo-200/50">
          Tickets reset each week
        </p>
      </div>
    </main>
  );
}