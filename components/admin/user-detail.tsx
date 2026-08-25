"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ton_wallet_address: string | null;
  streak_count: number;
  referral_count: number;
  referral_reached_count: number;
  raffly_pass_expires_at: string | null;
  created_at: string;
};

type ActivityEvent = {
  type: "raffle_entry" | "ad_view" | "transaction" | "withdrawal";
  created_at: string;
  detail: Record<string, unknown>;
};

function activityLabel(event: ActivityEvent): string {
  switch (event.type) {
    case "raffle_entry":
      return `Entered raffle with ${event.detail.tickets_used} tickets`;
    case "ad_view":
      return event.detail.converted ? "Watched ad (rewarded)" : "Watched ad";
    case "transaction":
      return `${event.detail.type} — ${event.detail.amount} ${event.detail.currency} (${event.detail.status})`;
    case "withdrawal":
      return `Withdrawal request — $${event.detail.amount} (${event.detail.status})`;
    default:
      return event.type;
  }
}

export default function UserDetail({ id }: { id: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketDelta, setTicketDelta] = useState("");
  const [usdtDelta, setUsdtDelta] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) {
      const body = await res.json();
      setUser(body.user);
      setActivity(body.activity ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdjust(true);
    setMessage("");
    const res = await fetch(`/api/admin/users/${id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketDelta: ticketDelta ? Number(ticketDelta) : 0,
        usdtDelta: usdtDelta ? Number(usdtDelta) : 0,
      }),
    });
    if (res.ok) {
      setTicketDelta("");
      setUsdtDelta("");
      setMessage("Balance updated.");
      await load();
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? "Failed to update balance.");
    }
    setSavingAdjust(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this user's account entirely? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${id}/delete`, { method: "POST" });
    if (res.ok) {
      router.push("/admin");
    } else {
      setMessage("Failed to delete user.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-white/50">Loading...</div>;
  }

  if (!user) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-white/50">User not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-white/50 hover:text-white">
        ← Back to users
      </Link>

      <div className="mt-4 mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <UserAvatar photoUrl={user.photo_url} firstName={user.first_name} username={user.username} size={48} />
          <div>
            <h1 className="text-lg font-semibold">
              {user.username ? `@${user.username}` : user.first_name || "Unknown"}
            </h1>
            <p className="text-sm text-white/50">Telegram ID: {user.telegram_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat label="Tickets" value={user.ticket_balance} />
          <Stat label="USDT Balance" value={`$${Number(user.usdt_balance).toFixed(2)}`} />
          <Stat label="Streak" value={`${user.streak_count} days`} />
          <Stat label="Referrals" value={`${user.referral_reached_count}/${user.referral_count}`} />
          <Stat
            label="Raffly Pass"
            value={
              user.raffly_pass_expires_at && new Date(user.raffly_pass_expires_at) > new Date()
                ? `Active until ${new Date(user.raffly_pass_expires_at).toLocaleDateString()}`
                : "None"
            }
          />
          <Stat label="Wallet" value={user.ton_wallet_address ? "Connected" : "Not connected"} />
          <Stat label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
          <Stat label="Country" value={<CountryFlag countryCode={user.country_code} />} />
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Management</h2>
        <form onSubmit={handleAdjust} className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/40">Ticket adjustment</label>
            <input
              value={ticketDelta}
              onChange={(e) => setTicketDelta(e.target.value)}
              placeholder="e.g. 50 or -20"
              className="w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">USDT adjustment</label>
            <input
              value={usdtDelta}
              onChange={(e) => setUsdtDelta(e.target.value)}
              placeholder="e.g. 100 or -50"
              className="w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={savingAdjust || (!ticketDelta && !usdtDelta)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {savingAdjust ? "Saving..." : "Apply"}
          </button>
        </form>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        >
          {deleting ? "Deleting..." : "Delete account"}
        </button>

        {message && <p className="mt-3 text-sm text-white/60">{message}</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-white/40">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((event, i) => (
              <li key={i} className="flex justify-between border-b border-white/5 pb-2 text-sm last:border-0">
                <span className="text-white/80">{activityLabel(event)}</span>
                <span className="shrink-0 pl-4 text-white/40">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-0.5 font-medium text-white">{value}</p>
    </div>
  );
}
