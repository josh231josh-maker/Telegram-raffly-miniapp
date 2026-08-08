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

export function ManageWinners() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    display_name: "",
    prize_amount: 0,
    week_label: "",
    publish_at: new Date().toISOString().slice(0, 16),
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editing) {
      const res = await fetch(`/api/admin/winner-announcements/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          publish_at: new Date(formData.publish_at).toISOString(),
        }),
      });

      if (res.ok) {
        setEditing(null);
        resetForm();
        await fetchAnnouncements();
      }
    } else {
      const res = await fetch("/api/admin/winner-announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          publish_at: new Date(formData.publish_at).toISOString(),
        }),
      });

      if (res.ok) {
        resetForm();
        await fetchAnnouncements();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this winner announcement?")) return;

    const res = await fetch(`/api/admin/winner-announcements/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await fetchAnnouncements();
    }
  }

  function resetForm() {
    setFormData({
      display_name: "",
      prize_amount: 0,
      week_label: "",
      publish_at: new Date().toISOString().slice(0, 16),
    });
    setShowForm(false);
  }

  function startEdit(ann: Announcement) {
    setFormData({
      display_name: ann.display_name,
      prize_amount: ann.prize_amount,
      week_label: ann.week_label || "",
      publish_at: new Date(ann.publish_at || new Date()).toISOString().slice(0, 16),
    });
    setEditing(ann.id);
    setShowForm(true);
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

  return (
    <div>
      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-4 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
      >
        {showForm ? "Cancel" : "Add Winner"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <label className="text-xs text-white/70">Display Name</label>
            <input
              type="text"
              required
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/70">Prize Amount ($)</label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.prize_amount}
                onChange={(e) => setFormData({ ...formData, prize_amount: parseFloat(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/70">Week Label</label>
              <input
                type="text"
                placeholder="Wk of Aug 15"
                value={formData.week_label}
                onChange={(e) => setFormData({ ...formData, week_label: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/70">Publish At (schedule when to show)</label>
            <input
              type="datetime-local"
              required
              value={formData.publish_at}
              onChange={(e) => setFormData({ ...formData, publish_at: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-green/10 px-3 py-2 text-sm font-medium text-green hover:bg-green/20">
              {editing ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <p className="text-sm text-white/50">No winners added yet.</p>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-medium">{ann.display_name}</p>
                  {ann.week_label && <p className="text-xs text-white/50">{ann.week_label}</p>}
                </div>
                <p className="text-lg font-semibold text-gold">${ann.prize_amount.toFixed(2)}</p>
              </div>

              <p className="mb-3 text-xs text-white/40">
                Publishes: {new Date(ann.publish_at || ann.created_at).toLocaleString()}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(ann)}
                  className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(ann.id)}
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
