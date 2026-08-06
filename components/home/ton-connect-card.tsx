"use client";

import { useEffect, useRef } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function TonConnectCard() {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { user, getInitData } = useTelegram();
  const checkedStaleConnection = useRef(false);

  // If the browser has a connected wallet that doesn't belong to THIS
  // Telegram account, disconnect it so we never save someone else's
  // leftover connection (e.g. shared device) to the wrong account.
  useEffect(() => {
    if (!user || checkedStaleConnection.current) return;
    checkedStaleConnection.current = true;

    if (address && address !== user.ton_wallet_address) {
      tonConnectUI.disconnect();
    }
  }, [user, address, tonConnectUI]);

  useEffect(() => {
    if (!user || !checkedStaleConnection.current) return;
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
    <section className="card-glow rounded-2xl border border-gold/20 bg-card p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-200/70">TON Wallet</span>
        <span className="text-xs text-indigo-200/50">for withdrawals</span>
      </div>
      <p className="mb-3 text-xs text-indigo-200/50">
        Connect your TON wallet so we know where to send your USDT winnings.
      </p>
      <TonConnectButton />
      {user?.ton_wallet_address && (
        <p className="mt-2 text-center text-xs text-emerald-400">
          Connected: {user.ton_wallet_address.slice(0, 6)}...{user.ton_wallet_address.slice(-4)}
        </p>
      )}
    </section>
  );
}