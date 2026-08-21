"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type AutoEntryRule = {
  id: string;
  tickets_per_entry: number;
  interval_minutes: number;
  enabled: boolean;
  last_entered_at: string | null;
  created_at: string;
  users: {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    ticket_balance: number;
  } | null;
};

function formatInterval(minutes: number): string {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return `${days}d`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}hr`;
  }
  return `${minutes}min`;
}

function nextDueLabel(rule: AutoEntryRule): string {
  if (!rule.enabled) return "Paused";
  if (!rule.last_entered_at) return "Due now";
  const dueAt = new Date(rule.last_entered_at).getTime() + rule.interval_minutes * 60_000;
  const diffMs = dueAt - Date.now();
  if (diffMs <= 0) return "Due now";
  const diffMin = Math.ceil(diffMs / 60_000);
  if (diffMin < 60) return `in ${diffMin}min`;
  return `in ${Math.ceil(diffMin / 60)}hr`;
}

export function AutoEntryRules() {
  const [rules, setRules] = useState<AutoEntryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [tickets, setTickets] = useState("2");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<"minutes" | "hours" | "days">("hours");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadRules() {
    setLoading(true);
    return fetch("/api/admin/auto-entries")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRules();
  }, []);

  function intervalToMinutes(): number {
    const value = Number(intervalValue);
    if (intervalUnit === "hours") return value * 60;
    if (intervalUnit === "days") return value * 60 * 24;
    return value;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Enter a username or Telegram ID");
      return;
    }
    const ticketsPerEntry = Number(tickets);
    const intervalMinutes = intervalToMinutes();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/auto-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed, ticketsPerEntry, intervalMinutes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create rule");
        return;
      }
      setIdentifier("");
      setRules((prev) => [data.rule, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(rule: AutoEntryRule) {
    setError(null);
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/admin/auto-entries/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update rule");
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? data.rule : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(rule: AutoEntryRule) {
    const name = rule.users?.username ? `@${rule.users.username}` : rule.users?.first_name || "this user";
    if (!confirm(`Delete the auto-entry rule for ${name}? This cannot be undone.`)) return;

    setError(null);
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/admin/auto-entries/${rule.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete rule");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">
        Automatically spends an account&apos;s tickets into the current raffle on a recurring schedule.
        Skips silently (and retries next check) if the account doesn&apos;t have enough tickets, or while no
        raffle is open for entries.
      </p>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-white/5 p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Username or Telegram ID</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Jamal"
            className="w-40 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Tickets per entry</label>
          <input
            type="number"
            min={1}
            value={tickets}
            onChange={(e) => setTickets(e.target.value)}
            className="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Every</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={intervalValue}
              onChange={(e) => setIntervalValue(e.target.value)}
              className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
            <select
              value={intervalUnit}
              onChange={(e) => setIntervalUnit(e.target.value as typeof intervalUnit)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 outline-none focus:border-white/30"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="shrink-0 rounded-lg bg-blue-500/15 px-4 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {creating ? "Adding..." : "Add Rule"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rules.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/40">
          No auto-entry rules yet. Add one above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Next entry</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium text-white">
                    {rule.users?.username ? `@${rule.users.username}` : rule.users?.first_name || "Unknown"}
                    <span className="ml-1.5 text-xs font-normal text-white/40 tabular-nums">
                      ({rule.users?.ticket_balance ?? 0} tickets)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70 tabular-nums">{rule.tickets_per_entry}</td>
                  <td className="px-4 py-3 text-white/70">{formatInterval(rule.interval_minutes)}</td>
                  <td className="px-4 py-3 text-white/70">{nextDueLabel(rule)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={busyId === rule.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs disabled:opacity-50 ${
                        rule.enabled
                          ? "bg-green-500/15 text-green-300 hover:bg-green-500/25"
                          : "bg-white/10 text-white/50 hover:bg-white/15"
                      }`}
                    >
                      {rule.enabled ? "Enabled" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={busyId === rule.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
