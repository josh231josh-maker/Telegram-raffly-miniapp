"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  ticket_balance: number;
  usdt_balance: number;
  streak_count: number;
  referral_count: number;
  raffly_pass_expires_at: string | null;
  created_at: string;
};

function hasActivePass(user: AdminUser): boolean {
  return !!user.raffly_pass_expires_at && new Date(user.raffly_pass_expires_at) > new Date();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users?search=${encodeURIComponent(search)}`)
        .then((res) => res.json())
        .then((body) => {
          setUsers(body.users ?? []);
          setTotalCount(body.totalCount ?? 0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Raffly Admin</h1>
          <p className="text-sm text-white/50">
            {totalCount} registered user{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
        >
          Log out
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by username or Telegram ID..."
        className="mb-4 w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/30"
      />

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Telegram ID</th>
              <th className="px-4 py-3 font-medium">Tickets</th>
              <th className="px-4 py-3 font-medium">USDT</th>
              <th className="px-4 py-3 font-medium">Streak</th>
              <th className="px-4 py-3 font-medium">Referrals</th>
              <th className="px-4 py-3 font-medium">Pass</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-white/40">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="cursor-pointer border-t border-white/5 hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:underline">
                    {u.username ? `@${u.username}` : u.first_name || "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white/70">{u.telegram_id}</td>
                <td className="px-4 py-3 text-white/70">{u.ticket_balance}</td>
                <td className="px-4 py-3 text-white/70">${Number(u.usdt_balance).toFixed(2)}</td>
                <td className="px-4 py-3 text-white/70">{u.streak_count}</td>
                <td className="px-4 py-3 text-white/70">{u.referral_count}</td>
                <td className="px-4 py-3">
                  {hasActivePass(u) ? (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-300">
                      Active
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
