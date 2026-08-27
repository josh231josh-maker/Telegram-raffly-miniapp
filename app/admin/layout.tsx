import type { ReactNode } from "react";

export const metadata = {
  title: "Raffly Admin",
};

// `admin-surface` re-enables text selection, which globals.css turns off on
// <body> for the mini app's app-like feel in the Telegram WebView. That rule
// reached the admin dashboard too (both surfaces share the root layout), so
// nothing here could be copied. This layout wraps every /admin route and
// nothing else, so the class is the scope -- no pathname check needed.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-surface min-h-screen bg-[#0f1117] text-white">{children}</div>;
}
