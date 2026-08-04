"use client";

import { HomeHeader } from "@/components/home/home-header";
import { BalanceCards } from "@/components/home/balance-cards";
import { DrawCountdown } from "@/components/home/draw-countdown";
import { useTelegram } from "@/components/providers/telegram-provider";

export default function HomePage() {
  const { isTelegram, isReady, user, loadingUser } = useTelegram();

  return (
    <main className="raffly-gradient ticket-pattern min-h-dvh px-4 pb-8 pt-6">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <HomeHeader />
        <BalanceCards />
        <DrawCountdown />
        <p className="text-center text-xs text-indigo-200/50">
          Tickets reset each week · Winnings withdraw at $30 USDT
        </p>

        {/* TEMP DEBUG - remove after testing */}
        <div className="mt-4 rounded-lg bg-black/40 p-3 text-xs text-white break-all">
          <p>isReady: {String(isReady)}</p>
          <p>isTelegram: {String(isTelegram)}</p>
          <p>loadingUser: {String(loadingUser)}</p>
          <p>user: {user ? JSON.stringify(user) : "null"}</p>
        </div>
      </div>
    </main>
  );
}