"use client";

import { useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useRaffleInfo } from "@/hooks/useRaffleInfo";
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
import { WelcomeBonusToast } from "@/components/welcome-bonus-toast";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("home");
  const [passOpen, setPassOpen] = useState(false);
  const { raffleEntry } = useTelegram();
  // Fetched once here rather than separately inside OddsRingCard and
  // PreviousWinners, which both need data from this same endpoint. Still
  // refetches when ticketsEntered changes, same trigger OddsRingCard used on
  // its own before.
  const raffleInfo = useRaffleInfo(raffleEntry?.ticketsEntered);

  return (
    <main className="min-h-dvh pb-28">
      <WelcomeBonusToast />
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6">
        {tab === "home" && (
          <>
            <HomeHeader />
            <HeroCountdown />
            <PassBanner onOpen={() => setPassOpen(true)} />
            <OddsRingCard onGetMore={() => setTab("raffles")} info={raffleInfo} />
            <PreviousWinners winners={raffleInfo?.winners ?? null} />
          </>
        )}

        {tab === "raffles" && (
          <>
            <BuyRaffleBar />
            <h1 className="flex items-center justify-center gap-2 text-center font-heading text-xl font-bold text-text">
              Complete tasks and receive
              <TicketImage size={22} />
            </h1>
            <DailyCheckIn />
            <WatchAdCard />
            <ReferralCard />
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
