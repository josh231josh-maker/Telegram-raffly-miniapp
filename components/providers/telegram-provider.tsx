"use client";

import { init, miniApp, themeParams, retrieveRawInitData } from "@telegram-apps/sdk";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type RafflyUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  ticket_balance: number;
  usdt_balance: number;
  streak_count: number;
  last_checkin_date: string | null;
};

type CheckInResult = {
  alreadyCheckedIn?: boolean;
  ticketsEarned?: number;
  streak?: number;
  user?: RafflyUser;
  error?: string;
};

type WithdrawResult = {
  success?: boolean;
  user?: RafflyUser;
  error?: string;
};

type TelegramContextValue = {
  isReady: boolean;
  isTelegram: boolean;
  user: RafflyUser | null;
  loadingUser: boolean;
  checkIn: () => Promise<CheckInResult>;
  refreshUser: () => Promise<void>;
  requestWithdrawal: (amount: number, walletAddress: string) => Promise<WithdrawResult>;
};

const TelegramContext = createContext<TelegramContextValue>({
  isReady: false,
  isTelegram: false,
  user: null,
  loadingUser: true,
  checkIn: async () => ({ error: "Not ready" }),
  refreshUser: async () => {},
  requestWithdrawal: async () => ({ error: "Not ready" }),
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<RafflyUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const initDataRef = useRef("");

  const fetchUser = async () => {
    if (!initDataRef.current) return;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current }),
      });
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch (err) {
      console.error("Auth fetch error:", err);
    }
  };

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

      try {
        rawInitData = retrieveRawInitData() ?? "";
      } catch {
        rawInitData = "";
      }
    } catch (err) {
      console.error("Telegram init error:", err);
      setIsTelegram(false);
    } finally {
      setIsReady(true);
    }

    initDataRef.current = rawInitData;

    if (rawInitData) {
      let startParam: string | null = null;
      try {
        const params = new URLSearchParams(rawInitData);
        startParam = params.get("start_param");
      } catch {
        startParam = null;
      }

      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: rawInitData, startParam }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user);
        })
        .catch((err) => {
          console.error("Auth fetch error:", err);
        })
        .finally(() => setLoadingUser(false));
    } else {
      setLoadingUser(false);
    }
  }, []);

  const checkIn = async (): Promise<CheckInResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current }),
      });
      const data: CheckInResult = await res.json();
      if (data.user) setUser(data.user);
      return data;
    } catch (err) {
      console.error("Check-in fetch error:", err);
      return { error: "Network error" };
    }
  };

  const requestWithdrawal = async (
    amount: number,
    walletAddress: string
  ): Promise<WithdrawResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current, amount, walletAddress }),
      });
      const data: WithdrawResult = await res.json();
      if (data.user) setUser(data.user);
      return data;
    } catch (err) {
      console.error("Withdraw fetch error:", err);
      return { error: "Network error" };
    }
  };

  return (
    <TelegramContext.Provider
      value={{
        isReady,
        isTelegram,
        user,
        loadingUser,
        checkIn,
        refreshUser: fetchUser,
        requestWithdrawal,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}