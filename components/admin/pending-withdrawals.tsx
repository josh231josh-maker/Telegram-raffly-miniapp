"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  wallet_address: string | null;
  status: string;
  requested_at: string;
  processed_at: string | null;
  users: {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    usdt_balance: number;
  };
};

const TABS = ["pending", "approved", "paid"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Sent",
};

export function PendingWithdrawals() {
  const [tab, setTab] = useState<Tab>("pending");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [txHash, setTxHash] = useState<{ [key: string]: string }>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithdrawals(tab);
  }, [tab]);

  async function fetchWithdrawals(status: Tab) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${status}`);
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(withdrawalId: string, action: string) {
    setProcessing(withdrawalId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          txHash: action === "mark-paid" ? txHash[withdrawalId] : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await fetchWithdrawals(tab);
        setTxHash({ ...txHash, [withdrawalId]: "" });
      } else {
        setError(data.error ?? `Failed to ${action.replace("-", " ")} this withdrawal.`);
      }
    } catch {
      setError(`Failed to ${action.replace("-", " ")} this withdrawal -- check your connection and try again.`);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-white/15 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-white/10 p-4">
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : withdrawals.length === 0 ? (
        <p className="text-sm text-white/50">No {TAB_LABELS[tab].toLowerCase()} withdrawals.</p>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <div key={w.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-medium">{w.users.first_name || w.users.username || "Unknown"}</p>
                  <p className="text-xs text-white/50">ID: {w.users.telegram_id}</p>
                  {w.wallet_address && (
                    <p className="mt-1 break-all text-xs text-white/40">{w.wallet_address}</p>
                  )}
                </div>
                <p className="text-lg font-semibold text-green tabular-nums">${Number(w.amount).toFixed(2)}</p>
              </div>

              {tab === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(w.id, "approve")}
                    disabled={processing === w.id}
                    className="flex-1 rounded-lg bg-green/10 px-3 py-2 text-sm font-medium text-green hover:bg-green/20 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(w.id, "reject")}
                    disabled={processing === w.id}
                    className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {tab === "approved" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="TX hash"
                    value={txHash[w.id] || ""}
                    onChange={(e) => setTxHash({ ...txHash, [w.id]: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                  <button
                    onClick={() => handleAction(w.id, "mark-paid")}
                    disabled={processing === w.id || !txHash[w.id]}
                    className="w-full rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    Mark Sent
                  </button>
                </div>
              )}

              {tab === "paid" && (
                <p className="text-xs text-white/40">
                  Sent {w.processed_at ? new Date(w.processed_at).toLocaleString() : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
