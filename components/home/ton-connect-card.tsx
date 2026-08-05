"use client";

import { useEffect } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/providers/telegram-provider";

export function TonConnectCard() {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { getInitData } = useTelegram();

  useEffect(() => {
    if (!address) return;

    const initData = getInitData();
    if (!initData) return;

    fetch("/api/wallet/connect-ton", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, walletAddress: address }),
    }).catch((err) => console.error("Save TON wallet error:", err));
  }, [address, getInitData]);

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
      {address && (
        <p className="mt-2 text-center text-xs text-emerald-400">
          Connected: {address.slice(0, 6)}...{address.slice(-4)}
        </p>
      )}
    </section>
  );
}