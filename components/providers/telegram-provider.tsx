"use client";

import { init, miniApp, themeParams, backButton, retrieveRawInitData } from "@telegram-apps/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchWithRetry } from "@/lib/fetch-retry";

type RafflyUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  ticket_balance: number;
  usdt_balance: number;
  streak_count: number;
  last_checkin_date: string | null;
  ton_wallet_address: string | null;
  raffly_pass_expires_at: string | null;
  raffly_pass_last_claim_date: string | null;
  referral_count: number;
  referral_reached_count: number;
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

type RaffleEntry = {
  raffleId: string;
  weekEnd: string;
  status: string;
  ticketsEntered: number;
};

type EnterRaffleResult = {
  success?: boolean;
  ticketsEntered?: number;
  user?: RafflyUser;
  error?: string;
};

type ClaimPassResult = {
  alreadyClaimed?: boolean;
  ticketsEarned?: number;
  user?: RafflyUser;
  error?: string;
};

type TelegramContextValue = {
  isReady: boolean;
  isTelegram: boolean;
  user: RafflyUser | null;
  loadingUser: boolean;
  checkIn: () => Promise<CheckInResult>;
  refreshUser: () => Promise<RafflyUser | null>;
  requestWithdrawal: () => Promise<WithdrawResult>;
  getInitData: () => string;
  raffleEntry: RaffleEntry | null;
  loadingRaffleEntry: boolean;
  enterRaffle: (ticketsToEnter: number) => Promise<EnterRaffleResult>;
  refreshRaffleEntry: () => Promise<void>;
  claimPassTickets: () => Promise<ClaimPassResult>;
};

const TelegramContext = createContext<TelegramContextValue>({
  isReady: false,
  isTelegram: false,
  user: null,
  loadingUser: true,
  checkIn: async () => ({ error: "Not ready" }),
  refreshUser: async () => null,
  requestWithdrawal: async () => ({ error: "Not ready" }),
  getInitData: () => "",
  raffleEntry: null,
  loadingRaffleEntry: true,
  enterRaffle: async () => ({ error: "Not ready" }),
  refreshRaffleEntry: async () => {},
  claimPassTickets: async () => ({ error: "Not ready" }),
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<RafflyUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [raffleEntry, setRaffleEntry] = useState<RaffleEntry | null>(null);
  const [loadingRaffleEntry, setLoadingRaffleEntry] = useState(true);
  const initDataRef = useRef("");

  // Every handler below reads only from initDataRef (a ref) and calls
  // useState setters -- both stable across renders -- so each is wrapped in
  // useCallback with an empty dep array: a stable function identity that
  // never changes. That's what lets the context value below be memoized
  // meaningfully, instead of recomputing (and re-rendering every consumer)
  // on every TelegramProvider render regardless of what actually changed.
  const fetchUser = useCallback(async (): Promise<RafflyUser | null> => {
    if (!initDataRef.current) return null;
    try {
      const res = await fetchWithRetry("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        return data.user;
      }
      return null;
    } catch (err) {
      console.error("Auth fetch error:", err);
      return null;
    }
  }, []);

  const fetchRaffleEntry = useCallback(async () => {
    if (!initDataRef.current) return;
    try {
      const res = await fetchWithRetry(
        `/api/raffle-entry?initData=${encodeURIComponent(initDataRef.current)}`
      );
      const data = await res.json();
      if (data.raffleId) {
        setRaffleEntry({
          raffleId: data.raffleId,
          weekEnd: data.weekEnd,
          status: data.status,
          ticketsEntered: data.ticketsEntered,
        });
      }
    } catch (err) {
      console.error("Raffle entry fetch error:", err);
    } finally {
      setLoadingRaffleEntry(false);
    }
  }, []);

  useEffect(() => {
    let rawInitData = "";

    try {
      init();

      if (miniApp.ready.isAvailable()) {
        miniApp.ready();
      }
      if (miniApp.setHeaderColor.isAvailable()) {
        miniApp.setHeaderColor("#070b16");
      }
      if (miniApp.setBackgroundColor.isAvailable()) {
        miniApp.setBackgroundColor("#070b16");
      }
      if (themeParams.mount.isAvailable()) {
        themeParams.mount();
      }
      // Mounted once here so individual screens only ever need to call
      // show()/hide()/onClick() -- mounting is a one-time prerequisite the
      // SDK requires before those will work.
      if (backButton.mount.isAvailable()) {
        backButton.mount();
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
      // The referrer's start_param travels inside rawInitData itself (and is
      // covered by its HMAC signature) -- the server reads it from there
      // rather than trusting a second, unsigned copy from the client.
      fetchWithRetry("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: rawInitData }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user);
        })
        .catch((err) => {
          console.error("Auth fetch error:", err);
        })
        .finally(() => setLoadingUser(false));

      fetchRaffleEntry();
    } else {
      setLoadingUser(false);
      setLoadingRaffleEntry(false);
    }
    // fetchRaffleEntry is a stable (useCallback) reference -- this still
    // only runs once on mount, same as before.
  }, [fetchRaffleEntry]);

  const checkIn = useCallback(async (): Promise<CheckInResult> => {
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
  }, []);

  const requestWithdrawal = useCallback(async (): Promise<WithdrawResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      // amount and the destination wallet are both derived server-side
      // (from the caller's own balance and saved ton_wallet_address) --
      // the client was never able to specify either, so it doesn't send them.
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current }),
      });
      const data: WithdrawResult = await res.json();
      if (data.user) setUser(data.user);
      return data;
    } catch (err) {
      console.error("Withdraw fetch error:", err);
      return { error: "Network error" };
    }
  }, []);

  const enterRaffle = useCallback(async (ticketsToEnter: number): Promise<EnterRaffleResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      const res = await fetch("/api/raffle-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current, ticketsToEnter }),
      });
      const data: EnterRaffleResult = await res.json();
      if (data.user) setUser(data.user);
      if (data.success) {
        setRaffleEntry((prev) =>
          prev ? { ...prev, ticketsEntered: data.ticketsEntered ?? prev.ticketsEntered } : prev
        );
      }
      return data;
    } catch (err) {
      console.error("Raffle entry fetch error:", err);
      return { error: "Network error" };
    }
  }, []);

  const claimPassTickets = useCallback(async (): Promise<ClaimPassResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      const res = await fetch("/api/raffly-pass/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current }),
      });
      const data: ClaimPassResult = await res.json();
      if (data.user) setUser(data.user);
      return data;
    } catch (err) {
      console.error("Claim pass tickets fetch error:", err);
      return { error: "Network error" };
    }
  }, []);

  const getInitData = useCallback(() => initDataRef.current, []);

  // The consumer set is large (nearly every screen reads from this context),
  // so an unmemoized value object here would re-render the whole app on
  // every provider render regardless of what actually changed. All the
  // functions above are themselves stable (useCallback, empty deps), so the
  // only real dependencies are the pieces of state.
  const value = useMemo<TelegramContextValue>(
    () => ({
      isReady,
      isTelegram,
      user,
      loadingUser,
      checkIn,
      refreshUser: fetchUser,
      requestWithdrawal,
      getInitData,
      raffleEntry,
      loadingRaffleEntry,
      enterRaffle,
      refreshRaffleEntry: fetchRaffleEntry,
      claimPassTickets,
    }),
    [
      isReady,
      isTelegram,
      user,
      loadingUser,
      checkIn,
      fetchUser,
      requestWithdrawal,
      getInitData,
      raffleEntry,
      loadingRaffleEntry,
      enterRaffle,
      fetchRaffleEntry,
      claimPassTickets,
    ]
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}