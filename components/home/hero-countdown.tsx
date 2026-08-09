"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      className="relative flex-shrink-0 overflow-hidden rounded-[28px] p-5 text-white shadow-lg"
      aria-label="Next weekly draw"
    >
      <Image
        src="/images/hero-ticket-full.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 420px"
        className="object-fill"
      />
      <span className="relative text-xs font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
        Next Weekly Draw
      </span>
      <div className="relative mt-3.5 grid grid-cols-4 gap-1.5 text-center">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-black/40 px-0.5 py-2.5 backdrop-blur-[2px]">
            <p className="font-heading text-xl font-bold tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
              {item.value}
            </p>
            <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-white/80">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="relative mt-3 text-center text-xs font-medium text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
        5 random winners · $100 USDT each
      </p>
    </section>
  );
}
