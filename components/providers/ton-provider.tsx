"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

// Falls back to the alias this was originally hardcoded to, only if
// NEXT_PUBLIC_APP_URL isn't set -- keeps this working in any environment
// where that env var is missing rather than silently breaking.
const MANIFEST_URL = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "https://telegram-raffly-miniapp-raffly.vercel.app"
}/tonconnect-manifest.json`;

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}