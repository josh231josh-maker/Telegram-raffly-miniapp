import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ConfettiBackground } from "@/components/confetti-background";
import { MiniAppShell } from "@/components/mini-app-shell";
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
  title: "Raffly — Bi-Weekly USDT Raffles",
  description:
    "Earn raffle tickets, win a share of 2,500 USDT every two weeks. Watch ads, check in, refer friends, or buy with Stars.",
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
          {/* TonConnect (@tonconnect/ui-react, ~350KB) is deliberately NOT
              wrapped around the whole app here -- it's only used inside the
              Withdraw modal, which loads it on demand. See
              components/profile/withdraw-modal-with-provider.tsx. */}
          <MiniAppShell>{children}</MiniAppShell>
        </div>
      </body>
    </html>
  );
}