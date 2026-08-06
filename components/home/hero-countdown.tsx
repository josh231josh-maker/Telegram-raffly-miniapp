"use client";

import { useEffect, useState } from "react";
import { getCurrentWeekEnd } from "@/lib/raffle-week";
import { TrophyIcon } from "@/components/icons";

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

const STUB_WIDTH = 74;
const NOTCH_SIZE = 22;

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

  const dividerLeft = `calc(100% - ${STUB_WIDTH}px)`;
  const notchLeft = `calc(100% - ${STUB_WIDTH}px - ${NOTCH_SIZE / 2}px)`;

  return (
    <section
      className="hero-gradient relative flex flex-shrink-0 overflow-hidden rounded-[22px] text-white shadow-lg"
      aria-label="Next weekly draw"
    >
      <div className="min-w-0 flex-1 p-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
          Next Weekly Draw
        </span>
        <div className="mt-3.5 grid grid-cols-4 gap-1.5 text-center">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-white/10 px-0.5 py-2.5">
              <p className="font-heading text-xl font-bold tabular-nums">{item.value}</p>
              <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-white/50">
                {item.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-white/50">5 random winners · $100 USDT each</p>
      </div>

      {/* Perforated tear line + notch cutouts, matching the app background so they read as punched holes */}
      <div
        className="absolute z-[3] bg-background"
        style={{
          left: notchLeft,
          top: -NOTCH_SIZE / 2,
          width: NOTCH_SIZE,
          height: NOTCH_SIZE,
          borderRadius: "9999px",
        }}
      />
      <div
        className="absolute bottom-4 top-4 border-l-2 border-dashed border-white/20"
        style={{ left: dividerLeft }}
      />
      <div
        className="absolute z-[3] bg-background"
        style={{
          left: notchLeft,
          bottom: -NOTCH_SIZE / 2,
          width: NOTCH_SIZE,
          height: NOTCH_SIZE,
          borderRadius: "9999px",
        }}
      />

      <div
        className="flex flex-shrink-0 flex-col items-center justify-center gap-2.5 py-3.5"
        style={{ width: STUB_WIDTH }}
      >
        <TrophyIcon className="h-6 w-6 text-gold" />
        <span
          className="text-[10px] font-semibold tracking-[0.14em] text-white/55"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          RAFFLY
        </span>
      </div>
    </section>
  );
}
