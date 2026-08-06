"use client";

import { useEffect, useState } from "react";
import { getCurrentWeekEnd } from "@/lib/raffle-week";

type Segments = { days: string; hours: string; minutes: string; seconds: string };

function pad(n: number): string {
  return String(Math.max(n, 0)).padStart(2, "0");
}

function toSegments(ms: number): Segments {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days: pad(days), hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) };
}

export function HeroCountdown() {
  const [target] = useState(() => getCurrentWeekEnd());
  const [segments, setSegments] = useState<Segments>({
    days: "--",
    hours: "--",
    minutes: "--",
    seconds: "--",
  });

  useEffect(() => {
    const tick = () => setSegments(toSegments(target.getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const items = [
    { label: "Days", value: segments.days },
    { label: "Hours", value: segments.hours },
    { label: "Mins", value: segments.minutes },
    { label: "Secs", value: segments.seconds },
  ];

  return (
    <section className="hero-gradient rounded-3xl p-6 text-white shadow-lg" aria-label="Next weekly draw">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
          Next Weekly Draw
        </span>
        <span className="text-lg" aria-hidden="true">
          🏆
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-white/10 py-3">
            <p className="font-heading text-2xl font-bold tabular-nums">{item.value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-white/50">5 random winners · $100 USDT each</p>
    </section>
  );
}
