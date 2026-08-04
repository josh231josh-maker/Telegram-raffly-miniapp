"use client";

import { init, miniApp, themeParams } from "@telegram-apps/sdk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type TelegramContextValue = {
  isReady: boolean;
  isTelegram: boolean;
};

const TelegramContext = createContext<TelegramContextValue>({
  isReady: false,
  isTelegram: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
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
    } catch {
      // Running outside Telegram (local browser dev)
      setIsTelegram(false);
    } finally {
      setIsReady(true);
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ isReady, isTelegram }}>
      {children}
    </TelegramContext.Provider>
  );
}
