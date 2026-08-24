"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";

// Everything here -- the Telegram SDK context and the ad network loader
// scripts -- is mini-app-only. The admin dashboard shares this same root
// layout but is a plain logged-in browser page, never opened inside
// Telegram, and never calls useTelegram(); loading any of this there is
// pure waste. See CLAUDE.md for why this needs to be scoped explicitly
// rather than assumed.
export function MiniAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Ad SDKs are only needed once a user taps "Watch Ads" -- loading them
          beforeInteractive would block the whole app's startup on
          third-party ad CDNs that most sessions never even use. */}
      <Script
        src="//libtl.com/sdk.js"
        data-zone="11527679"
        data-sdk="show_11527679"
        strategy="afterInteractive"
      />
      <Script src="https://w.tads.me/widget.js" strategy="afterInteractive" />
      <ThemeProvider>
        <LanguageProvider>
          <TelegramProvider>{children}</TelegramProvider>
        </LanguageProvider>
      </ThemeProvider>
    </>
  );
}
