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
  // True for exactly one auth response: the one that just created this
  // account. Never flips back once set -- it's a one-time "you just signed
  // up" signal, not a persistent user attribute.
  isNewUser: boolean;
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
  isNewUser: false,
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
  const [isNewUser, setIsNewUser] = useState(false);
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
        if (data.isNewUser) setIsNewUser(true);
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
          if (data.isNewUser) setIsNewUser(true);
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

  useEffect(() => {
    // No /admin check needed here anymore -- this whole provider is only
    // ever mounted for the mini app now (see components/mini-app-shell.tsx),
    // so there's no route this could fire on except the ones it's meant for.
    //
    // The `img { -webkit-touch-callout: none }` rule in globals.css only
    // suppresses the long-press "save/share image" menu on iOS Safari --
    // that property is WebKit-specific and does nothing on Android Chrome
    // (which is what Telegram's Android app uses for mini apps). Android
    // fires a real `contextmenu` event on long-press, so blocking it here
    // is the only thing that also works there.
    //
    // e.target is only the actual <img> when the touch's hit-test resolves
    // exactly onto its rendered box. A small icon inside a padded button
    // (like TaskRow's leading icons) can have its box not quite fill the
    // button/span around it -- a long-press landing in that sliver of
    // padding resolves e.target to the wrapper, not the <img>, so the
    // direct instanceof check misses it and the native menu still shows,
    // even though an image is clearly what got long-pressed. Falling back
    // to "does the nearest button/link contain an <img>" catches that case
    // too, bounded to the closest interactive ancestor rather than
    // searching the whole document (which would also swallow long-presses
    // on unrelated text elsewhere on the page, since some image or other
    // exists on nearly every screen).
    const blockImageContextMenu = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target instanceof HTMLImageElement || target.closest("button, a")?.querySelector("img")) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", blockImageContextMenu);
    return () => document.removeEventListener("contextmenu", blockImageContextMenu);
  }, []);

  const checkIn = useCallback(async (): Promise<CheckInResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      // Safe to retry: try_daily_checkin is gated on last_checkin_date, so a
      // retried call after a dropped response just no-ops instead of double-
      // crediting the streak bonus.
      const res = await fetchWithRetry("/api/checkin", {
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
      // Safe to retry: process_withdrawal is a single-shot "withdraw my
      // whole balance" call backed by withdrawals_one_active_per_user, so a
      // retry after a dropped response either succeeds once or gets a clean
      // 409 for "already requested" -- never a second real withdrawal.
      const res = await fetchWithRetry("/api/withdraw", {
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
      // Unlike checkin/withdraw/pass-claim, ticketsToEnter is a delta ("add
      // N more"), not a fixed one-shot action -- if the write actually
      // succeeded server-side but the response was lost, blindly retrying
      // the same body would spend N tickets a second time. Still worth the
      // timeout fetchWithRetry provides (a hung connection shouldn't spin
      // forever), just without its automatic retries.
      const res = await fetchWithRetry(
        "/api/raffle-entry",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: initDataRef.current, ticketsToEnter }),
        },
        1
      );
      const data: EnterRaffleResult = await res.json();
      if (data.user) setUser(data.user);
      if (data.success) {
        let hadPriorEntry = true;
        setRaffleEntry((prev) => {
          if (prev) return { ...prev, ticketsEntered: data.ticketsEntered ?? prev.ticketsEntered };
          // The initial GET fetch (fetchRaffleEntry) hadn't resolved yet when
          // this entry landed, so there's no raffleId/weekEnd/status here to
          // patch ticketsEntered onto -- the POST response only carries the
          // ticket count. Silently dropping the update here (as this used to)
          // left raffleEntry stuck at null for the rest of the session: no
          // "your tickets", and nothing to change to re-trigger the total
          // pool's refetch either. Fetch the real thing instead of guessing.
          hadPriorEntry = false;
          return prev;
        });
        if (!hadPriorEntry) fetchRaffleEntry();
      }
      return data;
    } catch (err) {
      console.error("Raffle entry fetch error:", err);
      return { error: "Network error" };
    }
  }, [fetchRaffleEntry]);

  const claimPassTickets = useCallback(async (): Promise<ClaimPassResult> => {
    if (!initDataRef.current) {
      return { error: "Not ready" };
    }
    try {
      // Safe to retry: date-gated the same way checkin is (see above).
      const res = await fetchWithRetry("/api/raffly-pass/claim", {
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
      isNewUser,
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
      isNewUser,
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