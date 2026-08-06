"use client";

import { useState } from "react";
import { BottomNav, type TabId } from "@/components/layout/bottom-nav";
import { HomeHeader } from "@/components/home/home-header";
import { HeroCountdown } from "@/components/home/hero-countdown";
import { PassBanner } from "@/components/home/pass-banner";
import { OddsRingCard } from "@/components/home/odds-ring-card";
import { PreviousWinners } from "@/components/home/previous-winners";
import { DailyCheckIn } from "@/components/raffles/daily-checkin";
import { WatchAdCard } from "@/components/raffles/watch-ad-card";
import { ReferralCard } from "@/components/raffles/referral-card";
import { BuyTicketsCard } from "@/components/raffles/buy-tickets-card";
import { BalanceCards } from "@/components/profile/balance-cards";
import { WithdrawButton } from "@/components/profile/withdraw-button";
import { ProfileCard } from "@/components/profile/profile-card";
import { RecentActivity } from "@/components/profile/recent-activity";
import { RafflyPassDetail } from "@/components/raffly-pass/raffly-pass-detail";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("home");
  const [passOpen, setPassOpen] = useState(false);

  return (
    <main className="app-bg-gradient min-h-dvh pb-28">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6">
        {tab === "home" && (
          <>
            <HomeHeader />
            <HeroCountdown />
            <PassBanner onOpen={() => setPassOpen(true)} />
            <OddsRingCard />
            <PreviousWinners />
          </>
        )}

        {tab === "raffles" && (
          <>
            <h1 className="font-heading text-2xl font-bold text-text">Raffles</h1>
            <DailyCheckIn />
            <WatchAdCard />
            <ReferralCard />
            <BuyTicketsCard />
          </>
        )}

        {tab === "profile" && (
          <>
            <h1 className="font-heading text-2xl font-bold text-text">Profile</h1>
            <BalanceCards />
            <WithdrawButton />
            <ProfileCard />
            <RecentActivity />
          </>
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {passOpen && <RafflyPassDetail onClose={() => setPassOpen(false)} />}
    </main>
  );
}
