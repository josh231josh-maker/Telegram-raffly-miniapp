"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Announcement = {
  id: string;
  display_name: string;
  prize_amount: number;
  week_label: string | null;
  publish_at: string | null;
  created_at: string;
  raffle_winner_id: string | null;
};

type Row = { id: string | null; display_name: string; prize_amount: number };

type Batch = {
  key: string;
  publishAt: string | null;
  weekLabel: string | null;
  entries: Announcement[];
};

const WINNER_SLOTS = 5;
const DEFAULT_PRIZE = 100;

function emptyRows(): Row[] {
  return Array.from({ length: WINNER_SLOTS }, () => ({
    id: null,
    display_name: "",
    prize_amount: DEFAULT_PRIZE,
  }));
}

function groupIntoBatches(list: Announcement[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const a of list) {
    const key = a.publish_at ?? "unscheduled";
    if (!map.has(key)) {
      map.set(key, { key, publishAt: a.publish_at, weekLabel: a.week_label, entries: [] });
    }
    map.get(key)!.entries.push(a);
  }
  return Array.from(map.values()).sort((a, b) => {
    const at = a.publishAt ? new Date(a.publishAt).getTime() : 0;
    const bt = b.publishAt ? new Date(b.publishAt).getTime() : 0;
    return bt - at;
  });
}

export function ManageWinners() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [weekLabel, setWeekLabel] = useState("");
  const [publishAt, setPublishAt] = useState(new Date().toISOString().slice(0, 16));
  const [rows, setRows] = useState<Row[]>(emptyRows());

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/winner-announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingBatch(null);
    setWeekLabel("");
    setPublishAt(new Date().toISOString().slice(0, 16));
    setRows(emptyRows());
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(batch: Batch) {
    const sorted = [...batch.entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const nextRows = emptyRows();
    sorted.slice(0, WINNER_SLOTS).forEach((entry, i) => {
      nextRows[i] = { id: entry.id, display_name: entry.display_name, prize_amount: entry.prize_amount };
    });
    setEditingBatch(batch);
    setWeekLabel(batch.weekLabel || "");
    setPublishAt(
      batch.publishAt ? new Date(batch.publishAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    );
    setRows(nextRows);
    setFormError(null);
    setShowForm(true);
  }

  function updateRow(index: number, field: "display_name" | "prize_amount", value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, [field]: field === "prize_amount" ? parseFloat(value) || 0 : value }
          : row
      )
    );
  }

  function closeForm() {
    setShowForm(false);
    setEditingBatch(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const publishAtIso = new Date(publishAt).toISOString();
      const originalEntries = editingBatch
        ? [...editingBatch.entries].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        : [];

      for (let i = 0; i < WINNER_SLOTS; i++) {
        const row = rows[i];
        const original = originalEntries[i];
        const hasName = row.display_name.trim().length > 0;

        if (!hasName) {
          if (original) {
            const res = await fetch(`/api/admin/winner-announcements/${original.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`Couldn't remove winner ${i + 1}`);
          }
          continue;
        }

        const payload = {
          display_name: row.display_name.trim(),
          prize_amount: row.prize_amount,
          week_label: weekLabel || null,
          publish_at: publishAtIso,
        };

        const res = original
          ? await fetch(`/api/admin/winner-announcements/${original.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/admin/winner-announcements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

        if (!res.ok) throw new Error(`Couldn't save winner ${i + 1}`);
      }

      closeForm();
      await fetchAnnouncements();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBatch(batch: Batch) {
    if (!confirm(`Delete all ${batch.entries.length} winner(s) in this batch?`)) return;

    for (const entry of batch.entries) {
      await fetch(`/api/admin/winner-announcements/${entry.id}`, { method: "DELETE" });
    }
    await fetchAnnouncements();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-white/10 p-4">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const batches = groupIntoBatches(announcements);

  return (
    <div>
      {!showForm && (
        <button
          onClick={openAddForm}
          className="mb-4 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
        >
          Add Winners
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">
            {editingBatch ? "Edit this week's winners" : "Add this week's winners"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/70">Week Label</label>
              <input
                type="text"
                placeholder="Wk of Aug 15"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/70">Goes live at (all 5 together)</label>
              <input
                type="datetime-local"
                required
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-white/40 tabular-nums">{i + 1}</span>
                <input
                  type="text"
                  placeholder="Winner name"
                  value={row.display_name}
                  onChange={(e) => updateRow(i, "display_name", e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={row.prize_amount}
                    onChange={(e) => updateRow(i, "prize_amount", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-6 pr-2 text-sm tabular-nums outline-none focus:border-white/30"
                  />
                </div>
              </div>
            ))}
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-green/10 px-3 py-2 text-sm font-medium text-green hover:bg-green/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingBatch ? "Save Changes" : "Publish"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm text-white/50">No winners added yet.</p>
        ) : (
          batches.map((batch) => (
            <div key={batch.key} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  {batch.weekLabel && <p className="text-sm font-medium text-white">{batch.weekLabel}</p>}
                  <p className="text-xs text-white/40">
                    {batch.publishAt
                      ? `Live from ${new Date(batch.publishAt).toLocaleString()}`
                      : "No publish time set"}
                  </p>
                </div>
              </div>

              <ul className="mb-3 divide-y divide-white/5 border-y border-white/5">
                {batch.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-white/80">{entry.display_name}</span>
                    <span className="font-semibold text-gold tabular-nums">
                      ${Number(entry.prize_amount).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditForm(batch)}
                  className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteBatch(batch)}
                  className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
