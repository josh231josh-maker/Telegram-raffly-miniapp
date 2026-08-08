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
import { BuyRaffleBar } from "@/components/raffles/buy-raffle-bar";
import { BalanceCards } from "@/components/profile/balance-cards";
import { WithdrawButton } from "@/components/profile/withdraw-button";
import { ProfileCard } from "@/components/profile/profile-card";
import { RecentActivity } from "@/components/profile/recent-activity";
import { RafflyPassDetail } from "@/components/raffly-pass/raffly-pass-detail";
import { TicketImage } from "@/components/ticket-image";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("home");
  const [passOpen, setPassOpen] = useState(false);

  return (
    <main className="app-bg-gradient min-h-dvh pb-28">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6">
        {tab === "home" && (
          <>
            <HomeHeader />
            <div className="rise-in" style={{ animationDelay: "0.02s" }}>
              <HeroCountdown />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.08s" }}>
              <PassBanner onOpen={() => setPassOpen(true)} />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.14s" }}>
              <OddsRingCard />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.2s" }}>
              <PreviousWinners />
            </div>
          </>
        )}

        {tab === "raffles" && (
          <>
            <div className="rise-in" style={{ animationDelay: "0.02s" }}>
              <BuyRaffleBar />
            </div>
            <h1 className="rise-in flex items-center justify-center gap-2 text-center font-heading text-xl font-bold text-text" style={{ animationDelay: "0.06s" }}>
              Complete tasks and receive
              <TicketImage size={22} />
            </h1>
            <div className="rise-in" style={{ animationDelay: "0.1s" }}>
              <DailyCheckIn />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.14s" }}>
              <WatchAdCard />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.18s" }}>
              <ReferralCard />
            </div>
          </>
        )}

        {tab === "profile" && (
          <>
            <h1 className="rise-in font-heading text-2xl font-bold text-text" style={{ animationDelay: "0.02s" }}>
              Profile
            </h1>
            <div className="rise-in" style={{ animationDelay: "0.06s" }}>
              <BalanceCards />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.1s" }}>
              <WithdrawButton />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.14s" }}>
              <ProfileCard />
            </div>
            <div className="rise-in" style={{ animationDelay: "0.18s" }}>
              <RecentActivity />
            </div>
          </>
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {passOpen && <RafflyPassDetail onClose={() => setPassOpen(false)} />}
    </main>
  );
}
