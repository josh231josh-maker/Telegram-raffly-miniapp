"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl="https://telegram-raffly-miniapp-raffly.vercel.app/tonconnect-manifest.json">
      {children}
    </TonConnectUIProvider>
  );
}