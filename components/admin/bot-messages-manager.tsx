"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Contact = {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  messageCount: number;
};

type Range = "24h" | "7d" | "30d" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "24h", label: "Past 24 hours" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "all", label: "All time" },
];

export function BotMessagesManager() {
  const [range, setRange] = useState<Range>("7d");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/bot-messages?range=${range}`)
      .then((res) => res.json())
      .then((data) => {
        setContacts(data.contacts ?? []);
        setTotalUsers(data.totalUsers ?? 0);
        setTotalMessages(data.totalMessages ?? 0);
        setTruncated(!!data.truncated);
      })
      .finally(() => setLoading(false));
  }, [range]);

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.value
                ? "bg-blue-500/20 text-blue-300"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-64" />
      ) : (
        <p className="text-sm text-white/60">
          <span className="font-semibold text-white">{totalUsers}</span> {totalUsers === 1 ? "person" : "people"}{" "}
          messaged the bot in {rangeLabel.toLowerCase()} (
          <span className="font-semibold text-white">{totalMessages}</span> message
          {totalMessages === 1 ? "" : "s"}
          {truncated ? ", capped" : ""})
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/40">
          No one has messaged the bot in {rangeLabel.toLowerCase()}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Telegram ID</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium">Last message</th>
                <th className="px-4 py-3 font-medium">Last messaged</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.telegramId} className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium text-white">
                    {c.username ? `@${c.username}` : c.firstName || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-white/70 tabular-nums">{c.telegramId}</td>
                  <td className="px-4 py-3 text-white/70 tabular-nums">{c.messageCount}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-white/70" title={c.lastMessageText ?? undefined}>
                    {c.lastMessageText ?? <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white/50">{new Date(c.lastMessageAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
