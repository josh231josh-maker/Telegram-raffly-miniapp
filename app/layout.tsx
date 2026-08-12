import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { ConfettiBackground } from "@/components/confetti-background";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Raffly — Weekly USDT Raffles",
  description:
    "Earn raffle tickets, win a share of $1,000 USDT every week. Watch ads, check in, refer friends, or buy with Stars.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070b16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
      >
        {/* See components/confetti-background.tsx for why this stacks the way
            it does (canvas-background + relative-wrapper interaction) and
            why it's a separate component (route-scoped to the mini app). */}
        <ConfettiBackground />

        <div className="relative">
          {/* Ad SDKs are only needed once a user taps "Watch Ads" -- loading them
              beforeInteractive would block the whole app's startup on two
              third-party ad CDNs that most sessions never even use. */}
          <Script src="https://sad.adsgram.ai/js/sad.min.js" strategy="afterInteractive" />
          <Script
            src="//libtl.com/sdk.js"
            data-zone="11527679"
            data-sdk="show_11527679"
            strategy="afterInteractive"
          />
          {/* TonConnect (@tonconnect/ui-react, ~350KB) is deliberately NOT
              wrapped around the whole app here -- it's only used inside the
              Withdraw modal, which loads it on demand. See
              components/profile/withdraw-modal-with-provider.tsx. */}
          <TelegramProvider>{children}</TelegramProvider>
        </div>
      </body>
    </html>
  );
}