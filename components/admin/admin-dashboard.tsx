"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PendingWithdrawals } from "./pending-withdrawals";
import { PendingWinners } from "./pending-winners";
import { ManageWinners } from "./manage-winners";
import { BroadcastManager } from "./broadcast-manager";
import { WelcomeMessageEditor } from "./welcome-message-editor";
import { FallbackMessageEditor } from "./fallback-message-editor";
import { TrackingLinksManager } from "./tracking-links-manager";
import { AutoEntryRules } from "./auto-entry-rules";
import { BotMessagesManager } from "./bot-messages-manager";
import { UserAvatar } from "./user-avatar";
import { CountryFlag } from "./country-flag";

type AdminUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  country_code: string | null;
  ticket_balance: number;
  usdt_balance: number;
  streak_count: number;
  referral_count: number;
  entries_this_draw: number;
  raffly_pass_expires_at: string | null;
  created_at: string;
};

type SortColumn =
  | "created_at"
  | "ticket_balance"
  | "usdt_balance"
  | "streak_count"
  | "telegram_id"
  | "referral_count"
  | "entries_this_draw";
type SortDir = "asc" | "desc";
type PassFilter = "all" | "active" | "inactive";

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "telegram_id", label: "Telegram ID" },
  { key: "ticket_balance", label: "Tickets" },
  { key: "entries_this_draw", label: "Entered (draw)" },
  { key: "usdt_balance", label: "USDT" },
  { key: "streak_count", label: "Streak" },
  { key: "referral_count", label: "Referrals" },
];

function hasActivePass(user: AdminUser): boolean {
  return !!user.raffly_pass_expires_at && new Date(user.raffly_pass_expires_at) > new Date();
}

type TabType =
  | "users"
  | "withdrawals"
  | "winners"
  | "manage-winners"
  | "notifications"
  | "welcome-message"
  | "fallback-message"
  | "tracking-links"
  | "auto-entries"
  | "bot-activity";

const TABS: { id: TabType; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "winners", label: "Winners" },
  { id: "manage-winners", label: "Manage Winners" },
  { id: "notifications", label: "Notifications" },
  { id: "welcome-message", label: "Welcome Message" },
  { id: "fallback-message", label: "Fallback Message" },
  { id: "tracking-links", label: "Tracking Links" },
  { id: "auto-entries", label: "Auto Entries" },
  { id: "bot-activity", label: "Bot Activity" },
];

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  function selectTab(tab: TabType) {
    setActiveTab(tab);
    setDrawerOpen(false);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* Backdrop -- mobile only, closes the drawer on tap-outside. The
          sidebar itself is always in-flow (not fixed) at md+, so this never
          renders there regardless of drawerOpen. */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar on md+ (always visible, part of the flex layout), slide-in
          drawer below that breakpoint (fixed, off-canvas until opened). */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0a0e17] p-4 transition-transform duration-200 md:static md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Raffly Admin</h1>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-500/15 text-blue-300"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-4 shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Log out
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/5"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">
            {TABS.find((t) => t.id === activeTab)?.label}
          </span>
        </div>

        <div className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 md:py-8">
          {activeTab === "users" && (
            <p className="mb-4 text-sm text-white/50">
              {totalCount} registered user{totalCount === 1 ? "" : "s"}
            </p>
          )}

          {activeTab === "users" && (
            <>
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
                <table className="w-full min-w-[1020px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Country</th>
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
                        <td colSpan={10} className="px-4 py-6 text-center text-white/40">
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
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="flex items-center gap-2.5 font-medium text-white hover:underline"
                          >
                            <UserAvatar photoUrl={u.photo_url} firstName={u.first_name} username={u.username} />
                            {u.username ? `@${u.username}` : u.first_name || "Unknown"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          <CountryFlag countryCode={u.country_code} />
                        </td>
                        <td className="px-4 py-3 text-white/70 tabular-nums">{u.telegram_id}</td>
                        <td className="px-4 py-3 text-white/70 tabular-nums">{u.ticket_balance}</td>
                        <td className="px-4 py-3 text-white/70 tabular-nums">{u.entries_this_draw}</td>
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
            </>
          )}

          {activeTab === "withdrawals" && <PendingWithdrawals />}
          {activeTab === "winners" && <PendingWinners />}
          {activeTab === "manage-winners" && <ManageWinners />}
          {activeTab === "notifications" && <BroadcastManager />}
          {activeTab === "welcome-message" && <WelcomeMessageEditor />}
          {activeTab === "fallback-message" && <FallbackMessageEditor />}
          {activeTab === "tracking-links" && <TrackingLinksManager />}
          {activeTab === "auto-entries" && <AutoEntryRules />}
          {activeTab === "bot-activity" && <BotMessagesManager />}
        </div>
      </div>
    </div>
  );
}
