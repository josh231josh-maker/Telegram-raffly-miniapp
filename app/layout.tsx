import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/providers/telegram-provider";
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
        {/* Ambient confetti -- meant to sit behind the app's cards/nav but
            above the plain page background, visible only in the gaps
            between UI elements. Fixed so it doesn't scroll with content;
            a plain <img> (not next/image) so its animation is preserved
            rather than flattened to a still frame by image optimization.
            Two things had to both be true to land it correctly:
            1. No negative z-index. body's own background-color
               propagates to become the page's canvas background, which
               paints beneath EVERYTHING regardless of z-index -- a
               negative z-index here rendered it behind that canvas
               (invisible), not just behind the UI.
            2. The actual app content below is wrapped in its own
               `relative` container. A `position: fixed` element like this
               one always paints above plain static-positioned elements in
               CSS, no matter its z-index value or DOM order -- that's why
               removing the negative z-index alone made it cover the cards
               instead of sitting behind them. Making the content wrapper
               `relative` promotes it into the same "positioned element"
               stacking tier as this fixed div, so with z-index:auto on
               both, plain DOM order decides -- this div first (behind),
               content wrapper after (in front). */}
        <div className="pointer-events-none fixed inset-0 opacity-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/confetti-bg.gif" alt="" className="h-full w-full object-cover" />
        </div>

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