import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const adminSecurityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Cache-Control", value: "no-store" },
    ];
    // Applied to every route including /admin (these two are identical to
    // the admin-only values above, so it's a harmless no-op duplicate
    // there). Deliberately omits X-Frame-Options/frame-ancestors being
    // restrictive on the main app -- it must stay embeddable inside
    // Telegram's own clients (Telegram Web loads it in an iframe), so
    // frame-ancestors only needs to keep out sites that AREN'T Telegram,
    // not block framing outright the way the admin dashboard does.
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self' https://web.telegram.org https://*.web.telegram.org",
      },
    ];
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      { source: "/admin/:path*", headers: adminSecurityHeaders },
      { source: "/api/admin/:path*", headers: adminSecurityHeaders },
    ];
  },
};

export default nextConfig;
