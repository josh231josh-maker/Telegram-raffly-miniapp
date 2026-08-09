import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { TonProvider } from "@/components/providers/ton-provider";
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
  themeColor: "#faf5f2",
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
        <Script src="https://sad.adsgram.ai/js/sad.min.js" strategy="beforeInteractive" />
        <Script
          src="//libtl.com/sdk.js"
          data-zone="11527679"
          data-sdk="show_11527679"
          strategy="beforeInteractive"
        />
        <TonProvider>
          <TelegramProvider>{children}</TelegramProvider>
        </TonProvider>
      </body>
    </html>
  );
}