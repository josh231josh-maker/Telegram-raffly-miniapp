"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Broadcast = {
  id: string;
  title: string | null;
  message_html: string;
  button_text: string | null;
  button_type: "url" | "webapp" | null;
  button_value: string | null;
  segment: string;
  status: "draft" | "queued" | "sending" | "completed" | "canceled";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

type Failure = {
  id: string;
  telegram_id: number;
  error: string | null;
  users: { username: string | null; first_name: string | null } | null;
};

const SEGMENT_LABELS: Record<string, string> = {
  all: "All eligible users",
  active_pass: "Users with an active Raffly Pass",
  no_pass: "Users without an active pass",
  has_tickets: "Users with tickets > 0",
  selected: "Selected users",
};

const STATUS_STYLES: Record<Broadcast["status"], string> = {
  draft: "bg-white/10 text-white/60",
  queued: "bg-blue-500/15 text-blue-300",
  sending: "bg-blue-500/15 text-blue-300",
  completed: "bg-green/15 text-green",
  canceled: "bg-red-500/15 text-red-400",
};

function parseSelectedIds(raw: string): number[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n))
    )
  );
}

export function BroadcastManager() {
  const [view, setView] = useState<"list" | "compose" | "review">("list");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose form state
  const [title, setTitle] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [segment, setSegment] = useState("all");
  const [selectedIdsText, setSelectedIdsText] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonType, setButtonType] = useState<"url" | "webapp">("webapp");
  const [buttonValue, setButtonValue] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [composeError, setComposeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Review/send state
  const [reviewBroadcast, setReviewBroadcast] = useState<Broadcast | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  async function fetchBroadcasts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcasts");
      const data = await res.json();
      setBroadcasts(data.broadcasts ?? []);
    } finally {
      setLoading(false);
    }
  }

  function startCompose() {
    setTitle("");
    setMessageHtml("");
    setSegment("all");
    setSelectedIdsText("");
    setButtonText("");
    setButtonType("webapp");
    setButtonValue("");
    setIdempotencyKey(crypto.randomUUID());
    setComposeError(null);
    setView("compose");
  }

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setComposeError(null);

    if (!messageHtml.trim()) {
      setComposeError("Message is required");
      return;
    }
    if (buttonText.trim() && !buttonValue.trim()) {
      setComposeError("Button destination is required when a button label is set");
      return;
    }

    const selectedTelegramIds = segment === "selected" ? parseSelectedIds(selectedIdsText) : undefined;
    if (segment === "selected" && (!selectedTelegramIds || selectedTelegramIds.length === 0)) {
      setComposeError("Enter at least one Telegram ID");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          messageHtml,
          buttonText: buttonText.trim() || undefined,
          buttonType: buttonText.trim() ? buttonType : undefined,
          buttonValue: buttonValue.trim() || undefined,
          segment,
          selectedTelegramIds,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeError(data.error ?? "Failed to create broadcast");
        return;
      }
      setReviewBroadcast(data.broadcast);
      setExcludedCount(data.excludedCount ?? 0);
      setFailures([]);
      setSendError(null);
      setView("review");
      fetchBroadcasts();
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(b: Broadcast) {
    const res = await fetch(`/api/admin/broadcasts/${b.id}`);
    const data = await res.json();
    setReviewBroadcast(data.broadcast ?? b);
    setFailures(data.failures ?? []);
    setExcludedCount(0);
    setSendError(null);
    setView("review");
  }

  async function handleSend() {
    if (!reviewBroadcast) return;
    if (
      !confirm(
        `Send this message to ${reviewBroadcast.total_recipients} user${reviewBroadcast.total_recipients === 1 ? "" : "s"}? This can't be undone.`
      )
    ) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      let current = reviewBroadcast;
      // Keeps calling the send endpoint until every recipient has been
      // attempted -- each call only processes one time-boxed batch server-side.
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch(`/api/admin/broadcasts/${current.id}/send`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setSendError(data.error ?? "Send failed");
          break;
        }
        current = { ...current, status: data.status, sent_count: data.sent, failed_count: data.failed };
        setReviewBroadcast(current);
        if (data.remaining === 0 || data.status === "canceled") break;
      }
    } finally {
      setSending(false);
      fetchBroadcasts();
      if (reviewBroadcast) {
        const res = await fetch(`/api/admin/broadcasts/${reviewBroadcast.id}`);
        const data = await res.json();
        setReviewBroadcast(data.broadcast ?? null);
        setFailures(data.failures ?? []);
      }
    }
  }

  async function handleCancelDraft() {
    if (!reviewBroadcast) return;
    if (!confirm("Cancel this broadcast?")) return;
    const res = await fetch(`/api/admin/broadcasts/${reviewBroadcast.id}`, { method: "DELETE" });
    if (res.ok) {
      setView("list");
      fetchBroadcasts();
    }
  }

  if (view === "compose") {
    return (
      <form onSubmit={handleCreateDraft} className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">New Notification</p>
          <button
            type="button"
            onClick={() => setView("list")}
            className="text-xs text-white/50 hover:text-white/70"
          >
            Cancel
          </button>
        </div>

        <div>
          <label className="text-xs text-white/70">Internal title (optional, not sent to users)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly draw reminder"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>

        <div>
          <label className="text-xs text-white/70">
            Message (Telegram HTML — supports &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;s&gt;, &lt;a href&gt;, &lt;code&gt;, &lt;pre&gt;)
          </label>
          <textarea
            value={messageHtml}
            onChange={(e) => setMessageHtml(e.target.value)}
            rows={5}
            placeholder={"🎉 <b>Weekly Draw Reminder</b>\n\nThe next draw is coming soon. Make sure you have your tickets before the draw closes."}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>

        <div>
          <label className="text-xs text-white/70">Send to</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#0d0d14]">
                {label}
              </option>
            ))}
          </select>
        </div>

        {segment === "selected" && (
          <div>
            <label className="text-xs text-white/70">Telegram IDs (comma or newline separated)</label>
            <textarea
              value={selectedIdsText}
              onChange={(e) => setSelectedIdsText(e.target.value)}
              rows={3}
              placeholder="123456789, 987654321"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
        )}

        <div className="rounded-lg border border-white/10 p-3">
          <p className="mb-2 text-xs font-medium text-white/70">Button (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50">Button text</label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="🎟️ Open Raffly"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Action</label>
              <select
                value={buttonType}
                onChange={(e) => setButtonType(e.target.value as "url" | "webapp")}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="webapp" className="bg-[#0d0d14]">
                  Open Mini App
                </option>
                <option value="url" className="bg-[#0d0d14]">
                  Open a link
                </option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-white/50">
              {buttonType === "webapp" ? "Path inside the app (optional, defaults to /)" : "URL"}
            </label>
            <input
              type="text"
              value={buttonValue}
              onChange={(e) => setButtonValue(e.target.value)}
              placeholder={buttonType === "webapp" ? "/" : "https://..."}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
        </div>

        {composeError && <p className="text-xs text-red-400">{composeError}</p>}

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-blue-500/15 px-3 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {creating ? "Preparing..." : "Preview Recipients"}
        </button>
      </form>
    );
  }

  if (view === "review" && reviewBroadcast) {
    const b = reviewBroadcast;
    const remaining = b.total_recipients - b.sent_count - b.failed_count;
    const canSend = b.status === "draft" || (b.status === "sending" && remaining > 0);

    return (
      <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">{b.title || "Notification"}</p>
          <button onClick={() => setView("list")} className="text-xs text-white/50 hover:text-white/70">
            Back to list
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="mb-1 text-xs text-white/40">Preview</p>
          <div
            className="text-sm text-white/90 [&_a]:text-blue-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: b.message_html }}
          />
          {b.button_text && (
            <div className="mt-3 inline-block rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70">
              {b.button_text}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold tabular-nums text-white">{b.total_recipients}</p>
            <p className="text-xs text-white/40">Recipients</p>
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold tabular-nums text-green">{b.sent_count}</p>
            <p className="text-xs text-white/40">Sent</p>
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold tabular-nums text-red-400">{b.failed_count}</p>
            <p className="text-xs text-white/40">Failed</p>
          </div>
        </div>

        {excludedCount > 0 && (
          <p className="text-xs text-white/40">
            {excludedCount} of the entered IDs were excluded (not found, or have blocked the bot).
          </p>
        )}

        <p className="text-xs text-white/40">
          Segment: {SEGMENT_LABELS[b.segment] ?? b.segment} · Status:{" "}
          <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[b.status]}`}>{b.status}</span>
        </p>

        {sendError && <p className="text-xs text-red-400">{sendError}</p>}

        {canSend && (
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 rounded-lg bg-green/10 px-3 py-2 text-sm font-medium text-green hover:bg-green/20 disabled:opacity-50"
            >
              {sending ? `Sending... (${b.sent_count + b.failed_count}/${b.total_recipients})` : "Send Now"}
            </button>
            {b.status === "draft" && (
              <button
                onClick={handleCancelDraft}
                disabled={sending}
                className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                Discard
              </button>
            )}
          </div>
        )}

        {failures.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
              Failed recipients ({failures.length}{failures.length === 100 ? "+" : ""})
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
              {failures.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-lg bg-red-500/5 px-2.5 py-1.5">
                  <span className="text-white/70">
                    {f.users?.username ? `@${f.users.username}` : f.users?.first_name || f.telegram_id}
                  </span>
                  <span className="truncate pl-2 text-red-400/80">{f.error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">Send Telegram messages to your users.</p>
        <button
          onClick={startCompose}
          className="rounded-lg bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/25"
        >
          New Notification
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-white/10 p-4">
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : broadcasts.length === 0 ? (
        <p className="text-sm text-white/50">No notifications sent yet.</p>
      ) : (
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <button
              key={b.id}
              onClick={() => openDetail(b)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {b.title || b.message_html.replace(/<[^>]+>/g, "").slice(0, 60)}
                </p>
                <p className="text-xs text-white/40">
                  {SEGMENT_LABELS[b.segment] ?? b.segment} · {new Date(b.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-3">
                <span className="text-xs tabular-nums text-white/50">
                  {b.sent_count}/{b.total_recipients} sent
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[b.status]}`}>{b.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
