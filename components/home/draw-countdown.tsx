"use client";

import { useEffect, useState } from "react";

function getNextSundayUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;

  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(20, 0, 0, 0); // 8 PM UTC weekly draw placeholder

  if (nextSunday <= now) {
    nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
  }

  return nextSunday;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Drawing soon…";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export function DrawCountdown() {
  const [target] = useState(() => getNextSundayUTC());
  const [countdown, setCountdown] = useState("—");

  useEffect(() => {
    const tick = () => {
      const remaining = target.getTime() - Date.now();
      setCountdown(formatCountdown(remaining));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <section
      className="card-glow rounded-2xl border border-purple/30 bg-card p-6 text-center backdrop-blur-sm"
      aria-label="Next weekly draw"
    >
      <div className="mb-1 flex items-center justify-center gap-2">
        <span className="text-lg" aria-hidden="true">
          🏆
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-200/70">
          Next Weekly Draw
        </h2>
      </div>

      <p className="gold-text mt-2 font-mono text-2xl font-bold tracking-wide">
        {countdown}
      </p>

      <p className="mt-3 text-xs text-indigo-200/50">
        5 random winners · $100 USDT each
      </p>
    </section>
  );
}
