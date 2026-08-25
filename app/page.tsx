"use client";

import { useEffect, useRef, useState } from "react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { useRaffleInfo } from "@/hooks/useRaffleInfo";
import { BottomNav, type TabId } from "@/components/layout/bottom-nav";
import { HomeHeader } from "@/components/home/home-header";
import { HeroCountdown } from "@/components/home/hero-countdown";
import { PassBanner } from "@/components/home/pass-banner";
import { ClaimPassButton } from "@/components/home/claim-pass-button";
import { OddsRingCard } from "@/components/home/odds-ring-card";
import { PreviousWinners } from "@/components/home/previous-winners";
import { DailyCheckIn } from "@/components/raffles/daily-checkin";
import { DailyCheckInPopup } from "@/components/raffles/daily-checkin-popup";
import { WatchAdCard } from "@/components/raffles/watch-ad-card";
import { ReferralCard } from "@/components/raffles/referral-card";
import { JoinChannelCard } from "@/components/raffles/join-channel-card";
import { NewUserBonusCard } from "@/components/raffles/new-user-bonus-card";
import { CompletedTasksSection } from "@/components/raffles/completed-tasks-section";
import { BuyRaffleBar } from "@/components/raffles/buy-raffle-bar";
import { BalanceCards } from "@/components/profile/balance-cards";
import { WithdrawButton } from "@/components/profile/withdraw-button";
import { ProfileCard } from "@/components/profile/profile-card";
import { RafflyPassDetail } from "@/components/raffly-pass/raffly-pass-detail";
import { TicketImage } from "@/components/ticket-image";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("home");
  const [passOpen, setPassOpen] = useState(false);
  const [checkInPopupOpen, setCheckInPopupOpen] = useState(false);
  const { user, loadingUser, raffleEntry } = useTelegram();
  const { t } = useLanguage();
  // Fetched once here rather than separately inside OddsRingCard and
  // PreviousWinners, which both need data from this same endpoint. Still
  // refetches when ticketsEntered changes, same trigger OddsRingCard used on
  // its own before.
  const raffleInfo = useRaffleInfo(raffleEntry?.ticketsEntered);

  // Auto-opens once per app session if today's check-in hasn't happened yet
  // -- gated by a ref (not just loadingUser/user in the dep array) so a
  // later user-object update elsewhere in the app (any balance change
  // re-fetches the full user row) can't re-trigger this and pop the modal
  // back open right after someone closes it.
  //
  // Delayed slightly past the automatic interstitial's own 3s fire point
  // (see ad-session-lock's INITIAL_GRACE_MS) so that ad reliably shows
  // first on a fresh open instead of this popup covering the screen first.
  const hasCheckedCheckInPopupRef = useRef(false);
  useEffect(() => {
    if (loadingUser || !user || hasCheckedCheckInPopupRef.current) return;
    hasCheckedCheckInPopupRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    if (user.last_checkin_date !== today) {
      const timeout = setTimeout(() => setCheckInPopupOpen(true), 4000);
      return () => clearTimeout(timeout);
    }
  }, [loadingUser, user]);

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6">
        {tab === "home" && (
          <>
            <HomeHeader />
            <HeroCountdown />
            <div className="relative">
              <PassBanner onOpen={() => setPassOpen(true)} />
              <ClaimPassButton />
            </div>
            <OddsRingCard onGetMore={() => setTab("raffles")} info={raffleInfo} />
            <PreviousWinners winners={raffleInfo?.winners ?? null} />
          </>
        )}

        {tab === "raffles" && (
          <>
            <BuyRaffleBar />
            <h1 className="flex items-center justify-center gap-2 text-center font-heading text-xl font-bold text-text">
              {t("raffles.heading")}
              <TicketImage size={22} />
            </h1>
            <NewUserBonusCard />
            <DailyCheckIn />
            <WatchAdCard />
            <ReferralCard />
            <JoinChannelCard />
            <CompletedTasksSection />
          </>
        )}

        {tab === "profile" && (
          <>
            <h1 className="font-heading text-2xl font-bold text-text">{t("profile.heading")}</h1>
            <BalanceCards />
            <WithdrawButton />
            <ProfileCard />
          </>
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {passOpen && <RafflyPassDetail onClose={() => setPassOpen(false)} />}
      {checkInPopupOpen && <DailyCheckInPopup onClose={() => setCheckInPopupOpen(false)} />}
    </main>
  );
}
