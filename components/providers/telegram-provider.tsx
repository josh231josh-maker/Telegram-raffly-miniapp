"use client";

import { init, miniApp, themeParams } from "@telegram-apps/sdk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type RafflyUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  ticket_balance: number;
  usdt_balance: number;
};

type TelegramContextValue = {
  isReady: boolean;
  isTelegram: boolean;
  user: RafflyUser | null;
  loadingUser: boolean;
};

const TelegramContext = createContext<TelegramContextValue>({
  isReady: false,
  isTelegram: false,
  user: null,
  loadingUser: true,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<RafflyUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let rawInitData = "";

    try {
      init();

      if (miniApp.ready.isAvailable()) {
        miniApp.ready();
      }
      if (miniApp.setHeaderColor.isAvailable()) {
        miniApp.setHeaderColor("#1e1b4b");
      }
      if (miniApp.setBackgroundColor.isAvailable()) {
        miniApp.setBackgroundColor("#0f0a1e");
      }
      if (themeParams.mount.isAvailable()) {
        themeParams.mount();
      }

      setIsTelegram(true);

      const win = window as unknown as {
        Telegram?: { WebApp?: { initData?: string } };
      };
      rawInitData = win.Telegram?.WebApp?.initData ?? "";
    } catch {
      setIsTelegram(false);
    } finally {
      setIsReady(true);
    }

    if (rawInitData) {
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: rawInitData }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user);
        })
        .catch(() => {})
        .finally(() => setLoadingUser(false));
    } else {
      setLoadingUser(false);
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ isReady, isTelegram, user, loadingUser }}>
      {children}
    </TelegramContext.Provider>
  );
}