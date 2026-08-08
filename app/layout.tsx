import type { Metadata, Viewport } from "next";
import { Unbounded, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { TonProvider } from "@/components/providers/ton-provider";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Raffly — Weekly USDT Raffles",
  description:
    "Earn raffle tickets, win $100 USDT every week. Watch ads, check in, refer friends, or buy with Stars.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#150a33",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${unbounded.variable} ${jakarta.variable} antialiased`}
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