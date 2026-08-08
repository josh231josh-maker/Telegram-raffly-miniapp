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

type Slot = "present" | "scheduled";

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

/** Present = most recent batch already live. Scheduled = nearest batch not live yet.
 *  Nothing promotes these explicitly -- a batch just falls into whichever
 *  bucket its publish_at puts it in as time passes. */
function computeSlots(list: Announcement[]): { present: Batch | null; scheduled: Batch | null } {
  const batches = groupIntoBatches(list); // sorted by publishAt, descending
  const now = Date.now();
  const future = batches.filter((b) => b.publishAt && new Date(b.publishAt).getTime() > now);
  const past = batches.filter((b) => !b.publishAt || new Date(b.publishAt).getTime() <= now);
  return {
    present: past[0] ?? null,
    scheduled: future.length > 0 ? future[future.length - 1] : null,
  };
}

/** Formats a Date as the wall-clock string a <input type="datetime-local">
 *  expects, using LOCAL time components -- .toISOString() would give UTC,
 *  which the input then silently reinterprets as local, shifting the
 *  chosen time by the browser's UTC offset every time it round-trips. */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ManageWinners() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [weekLabel, setWeekLabel] = useState("");
  const [publishAt, setPublishAt] = useState("");
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

  function openForm(slot: Slot, batch: Batch | null) {
    setEditingSlot(slot);
    setEditingBatch(batch);
    setFormError(null);

    if (batch) {
      const sorted = [...batch.entries].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const nextRows = emptyRows();
      sorted.slice(0, WINNER_SLOTS).forEach((entry, i) => {
        nextRows[i] = { id: entry.id, display_name: entry.display_name, prize_amount: entry.prize_amount };
      });
      setRows(nextRows);
      setWeekLabel(batch.weekLabel || "");
      setPublishAt(toDatetimeLocal(batch.publishAt ? new Date(batch.publishAt) : new Date()));
    } else {
      setRows(emptyRows());
      setWeekLabel("");
      // Default a new scheduled batch an hour out so it doesn't accidentally
      // land in the past and jump straight to "present".
      setPublishAt(toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    }
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
    setEditingSlot(null);
    setEditingBatch(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Present is locked to its existing go-live time -- editing it can
      // only change names/amounts, never when it went live. Scheduled uses
      // whatever time is picked in the form.
      const publishAtIso =
        editingSlot === "present" && editingBatch?.publishAt
          ? editingBatch.publishAt
          : new Date(publishAt).toISOString();

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

  async function handleClearBatch(batch: Batch, label: string) {
    if (!confirm(`Clear ${label}? This removes all ${batch.entries.length} winner(s) shown there.`)) return;

    for (const entry of batch.entries) {
      await fetch(`/api/admin/winner-announcements/${entry.id}`, { method: "DELETE" });
    }
    await fetchAnnouncements();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-white/10 p-4">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const { present, scheduled } = computeSlots(announcements);

  function renderForm() {
    if (!editingSlot) return null;
    const isPresent = editingSlot === "present";

    return (
      <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-white">
          {isPresent ? "Edit what's live now" : editingBatch ? "Edit scheduled winners" : "Schedule winners"}
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
            <label className="text-xs text-white/70">
              {isPresent ? "Live since (locked)" : "Goes live at"}
            </label>
            {isPresent ? (
              <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50">
                {editingBatch?.publishAt ? new Date(editingBatch.publishAt).toLocaleString() : "—"}
              </p>
            ) : (
              <input
                type="datetime-local"
                required
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            )}
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
            {saving ? "Saving..." : "Save"}
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
    );
  }

  function renderBatchList(batch: Batch) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Present — live in the app now</p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          {present ? (
            <>
              <div className="mb-3">
                {present.weekLabel && <p className="text-sm font-medium text-white">{present.weekLabel}</p>}
                <p className="text-xs text-white/40">
                  Live since {present.publishAt ? new Date(present.publishAt).toLocaleString() : "—"}
                </p>
              </div>
              {renderBatchList(present)}
              {editingSlot !== "present" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openForm("present", present)}
                    className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleClearBatch(present, "Present")}
                    className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white/50">Nothing live right now.</p>
          )}
        </div>
        {editingSlot === "present" && renderForm()}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
          Scheduled — replaces Present when its time comes
        </p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          {scheduled ? (
            <>
              <div className="mb-3">
                {scheduled.weekLabel && <p className="text-sm font-medium text-white">{scheduled.weekLabel}</p>}
                <p className="text-xs text-white/40">
                  Goes live {scheduled.publishAt ? new Date(scheduled.publishAt).toLocaleString() : "—"}
                </p>
              </div>
              {renderBatchList(scheduled)}
              {editingSlot !== "scheduled" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openForm("scheduled", scheduled)}
                    className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleClearBatch(scheduled, "Scheduled")}
                    className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-white/50">Nothing scheduled.</p>
              {editingSlot !== "scheduled" && (
                <button
                  onClick={() => openForm("scheduled", null)}
                  className="w-full rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
                >
                  Schedule Winners
                </button>
              )}
            </>
          )}
        </div>
        {editingSlot === "scheduled" && renderForm()}
      </div>
    </div>
  );
}
