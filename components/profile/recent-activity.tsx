"use client";

import { useState } from "react";

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
};

export function RecentActivity() {
  const [open, setOpen] = useState(false);

  // No transaction-history endpoint exists yet, so this renders an empty
  // state until the backend exposes recent transactions/withdrawals.
  const items: ActivityItem[] = [];

  return (
    <section className="card-soft overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-dim">Recent Activity</span>
        <span
          className={`text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {items.length === 0 ? (
            <p className="py-2 text-center text-xs text-text-faint">No recent activity yet</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="text-text">{item.label}</p>
                    <p className="text-xs text-text-faint">{item.timestamp}</p>
                  </div>
                  <span className="font-semibold text-text-dim">{item.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
