"use client";

import { useEffect, useState } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/providers/telegram-provider";
import { UsdtIcon, CloseIcon } from "@/components/icons";

type WithdrawModalProps = {
  onClose: () => void;
};

export function WithdrawModal({ onClose }: WithdrawModalProps) {
  const { user, requestWithdrawal, getInitData, refreshUser } = useTelegram();
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const balance = user?.usdt_balance ?? 0;
  const walletConnected = !!user?.ton_wallet_address;

  // Whenever the browser's connected wallet doesn't match a DIFFERENT
  // wallet THIS Telegram account already has saved, disconnect it — this
  // guards against a stale TON Connect session left over from another
  // Telegram account on the same device. It must only fire when there's
  // an existing saved address to conflict with: right after a fresh
  // connect, user.ton_wallet_address is still null until the save below
  // completes, and treating that as a "mismatch" would immediately
  // disconnect every new connection.
  useEffect(() => {
    if (!user) return;
    if (address && user.ton_wallet_address && address !== user.ton_wallet_address) {
      tonConnectUI.disconnect();
    }
  }, [user, address, tonConnectUI]);

  useEffect(() => {
    if (!user) return;
    if (!address || address === user.ton_wallet_address) return;

    const initData = getInitData();
    if (!initData) return;

    fetch("/api/wallet/connect-ton", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, walletAddress: address }),
    })
      .then(() => refreshUser())
      .catch((err) => console.error("Save TON wallet error:", err));
  }, [address, user, getInitData, refreshUser]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      // TON Connect's own session may already be gone (expired, cleared,
      // never live in this app instance) even though our database still
      // has a saved address — that mismatch is exactly what this modal's
      // "connected" state is showing. Don't let an SDK-level disconnect
      // failure block clearing our own record.
      try {
        await tonConnectUI.disconnect();
      } catch (err) {
        console.error("TON Connect disconnect error (continuing anyway):", err);
      }

      const initData = getInitData();
      if (!initData) {
        throw new Error("Not ready — reopen the app and try again.");
      }

      const res = await fetch("/api/wallet/connect-ton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, walletAddress: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      await refreshUser();
      setMessage("Wallet disconnected.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not disconnect. Try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleWithdraw = async () => {
    setMessage(null);
    setStatus("loading");
    const result = await requestWithdrawal(balance, "");
    if (result.success) {
      setStatus("done");
      setMessage("Withdrawal requested! We'll process it shortly.");
    } else {
      setStatus("idle");
      setMessage(result.error ?? "Something went wrong");
    }
  };

  const canWithdraw = balance > 0 && walletConnected && status !== "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-t-3xl bg-card p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-text">Withdraw USDT</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-text-dim"
            aria-label="Close"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 py-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-soft text-green">
            <UsdtIcon className="h-7 w-7" />
          </span>
          <span className="font-heading text-3xl font-bold text-text">${balance.toFixed(2)}</span>
        </div>

        <p className="mb-4 text-center text-xs text-text-dim">
          No minimum — withdraw any amount, any time, sent to the TON wallet below.
        </p>

        {walletConnected ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0098ea] text-[10px] font-bold text-white">
              TON
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">
                {user!.ton_wallet_address!.slice(0, 6)}...{user!.ton_wallet_address!.slice(-4)}
              </p>
              <p className="text-[11px] text-text-faint">TON Wallet</p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="shrink-0 rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-text-dim disabled:opacity-50"
            >
              {disconnecting ? "..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-border p-4">
            <p className="text-center text-xs text-text-dim">
              Connect a TON wallet to receive your withdrawal.
            </p>
            <TonConnectButton />
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={!canWithdraw}
          className="btn-green w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {status === "loading" ? "Processing..." : `Withdraw $${balance.toFixed(2)}`}
        </button>

        {message && <p className="mt-2 text-center text-xs text-text-faint">{message}</p>}
      </div>
    </div>
  );
}
