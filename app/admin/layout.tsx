import type { ReactNode } from "react";

export const metadata = {
  title: "Raffly Admin",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#0f1117] text-white">{children}</div>;
}
