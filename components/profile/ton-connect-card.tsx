"use client";

import { useEffect } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function TonConnectCard() {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { user, getInitData } = useTelegram();

  // Whenever the browser's connected wallet doesn't match what THIS
  // Telegram account has saved, disconnect it. Runs on every change
  // (not just once) since TON Connect restores its saved session
  // asynchronously and may not be ready on the very first render.
  useEffect(() => {
    if (!user) return;
    if (address && address !== user.ton_wallet_address) {
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
    }).catch((err) => console.error("Save TON wallet error:", err));
  }, [address, user, getInitData]);

  return (
    <section className="card-soft rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-dim">TON Wallet</span>
        <span className="text-xs text-text-faint">for withdrawals</span>
      </div>
      <p className="mb-3 text-xs text-text-faint">
        Connect your TON wallet so we know where to send your USDT winnings.
      </p>
      <TonConnectButton />
      {user?.ton_wallet_address && (
        <p className="mt-2 text-center text-xs text-green">
          Connected: {user.ton_wallet_address.slice(0, 6)}...{user.ton_wallet_address.slice(-4)}
        </p>
      )}
    </section>
  );
}
