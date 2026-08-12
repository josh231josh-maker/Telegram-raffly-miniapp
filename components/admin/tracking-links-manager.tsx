"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type TrackingLink = {
  id: string;
  code: string;
  label: string;
  created_at: string;
  userCount: number;
};

const BOT_APP_BASE_URL = "https://t.me/Rafflyapp_bot/Raffly";

function linkUrl(code: string): string {
  return `${BOT_APP_BASE_URL}?startapp=${code}`;
}

export function TrackingLinksManager() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadLinks() {
    setLoading(true);
    return fetch("/api/admin/tracking-links")
      .then((res) => res.json())
      .then((data) => setLinks(data.links ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLinks();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Enter a label for this link");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create link");
        return;
      }
      setLabel("");
      setLinks((prev) => [data.link, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(link: TrackingLink) {
    const warning =
      link.userCount > 0
        ? `Delete "${link.label}"? ${link.userCount} user${link.userCount === 1 ? "" : "s"} attributed to it will no longer show which link brought them in. This cannot be undone.`
        : `Delete "${link.label}"? This cannot be undone.`;
    if (!confirm(warning)) return;

    setError(null);
    setDeletingId(link.id);
    try {
      const res = await fetch(`/api/admin/tracking-links/${link.id}/delete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete link");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(linkUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
    } catch {
      // Clipboard access can be denied by the browser -- the link is still
      // visible on screen to select and copy manually.
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label, e.g. Twitter post"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={creating}
          className="shrink-0 rounded-lg bg-blue-500/15 px-4 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {creating ? "Generating..." : "Generate Link"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : links.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/40">
          No tracking links yet. Generate one above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium">Users started</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium text-white">{link.label}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-xs text-white/60">{linkUrl(link.code)}</code>
                      <button
                        onClick={() => handleCopy(link.code)}
                        className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/15"
                      >
                        {copiedCode === link.code ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/70 tabular-nums">{link.userCount}</td>
                  <td className="px-4 py-3 text-white/50">{new Date(link.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(link)}
                      disabled={deletingId === link.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === link.id ? "Deleting..." : "Delete"}
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
