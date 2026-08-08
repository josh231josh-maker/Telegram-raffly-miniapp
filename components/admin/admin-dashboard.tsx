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

type SortColumn =
  | "created_at"
  | "ticket_balance"
  | "usdt_balance"
  | "streak_count"
  | "telegram_id"
  | "referral_count";
type SortDir = "asc" | "desc";
type PassFilter = "all" | "active" | "inactive";

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "telegram_id", label: "Telegram ID" },
  { key: "ticket_balance", label: "Tickets" },
  { key: "usdt_balance", label: "USDT" },
  { key: "streak_count", label: "Streak" },
  { key: "referral_count", label: "Referrals" },
];

function hasActivePass(user: AdminUser): boolean {
  return !!user.raffly_pass_expires_at && new Date(user.raffly_pass_expires_at) > new Date();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [passFilter, setPassFilter] = useState<PassFilter>("all");
  const [sortBy, setSortBy] = useState<SortColumn>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        passFilter,
        sortBy,
        sortDir,
      });
      fetch(`/api/admin/users?${params}`)
        .then((res) => res.json())
        .then((body) => {
          setUsers(body.users ?? []);
          setTotalCount(body.totalCount ?? 0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, passFilter, sortBy, sortDir]);

  function handleSort(column: SortColumn) {
    if (column === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or Telegram ID..."
          className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/30"
        />
        <select
          value={passFilter}
          onChange={(e) => setPassFilter(e.target.value as PassFilter)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 outline-none focus:border-white/30"
        >
          <option value="all">All passes</option>
          <option value="active">Pass: Active</option>
          <option value="inactive">Pass: Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium">
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-white/80"
                  >
                    {col.label}
                    {sortBy === col.key && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Pass</th>
              <th className="px-4 py-3 font-medium">
                <button
                  onClick={() => handleSort("created_at")}
                  className="flex items-center gap-1 hover:text-white/80"
                >
                  Joined
                  {sortBy === "created_at" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
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
                <td className="px-4 py-3 text-white/70 tabular-nums">{u.telegram_id}</td>
                <td className="px-4 py-3 text-white/70 tabular-nums">{u.ticket_balance}</td>
                <td className="px-4 py-3 text-white/70 tabular-nums">${Number(u.usdt_balance).toFixed(2)}</td>
                <td className="px-4 py-3 text-white/70 tabular-nums">{u.streak_count}</td>
                <td className="px-4 py-3 text-white/70 tabular-nums">{u.referral_count}</td>
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
