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
    <section
      className="hero-gradient flex-shrink-0 rounded-[28px] p-5 text-white shadow-lg"
      aria-label="Next weekly draw"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
        Next Weekly Draw
      </span>
      <div className="mt-3.5 grid grid-cols-4 gap-1.5 text-center">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/15 px-0.5 py-2.5">
            <p className="font-heading text-xl font-bold tabular-nums">{item.value}</p>
            <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-white/60">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-white/70">5 random winners · $100 USDT each</p>
    </section>
  );
}
