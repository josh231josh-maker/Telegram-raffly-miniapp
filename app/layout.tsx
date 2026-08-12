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
        {/* Ambient confetti, overlaid on top of the page's dark blue
            background -- fixed so it doesn't scroll with content, and a
            plain <img> (not next/image) so its animation is preserved
            rather than being flattened to a still frame by image
            optimization. Deliberately no negative z-index: body's own
            background-color propagates to become the page canvas
            background, which paints beneath everything regardless of
            z-index, so a negative z-index here was rendering this behind
            that canvas instead of on top of it. Being the first element in
            the DOM already places it below all the real UI that follows
            without needing z-index at all. */}
        <div className="pointer-events-none fixed inset-0 opacity-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/confetti-bg.gif" alt="" className="h-full w-full object-cover" />
        </div>

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
      </body>
    </html>
  );
}