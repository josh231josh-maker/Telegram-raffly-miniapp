"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCurrentWeekEnd, WEEKLY_WINNER_COUNT, PRIZE_POOL_USDT, PRIZE_PER_WINNER_USDT } from "@/lib/raffle-week";
import { StarIcon, TrophyIcon } from "@/components/icons";

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

const SPARKLES = [
  "left-9 top-4 h-3 w-3 text-white/70 [animation-delay:0s]",
  "right-16 top-9 h-2.5 w-2.5 text-white/55 [animation-delay:0.7s]",
  "left-20 top-[4.25rem] h-2 w-2 text-white/45 [animation-delay:1.4s]",
];

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
      className="hero-rise hero-gradient relative isolate overflow-hidden rounded-[28px] p-5 text-white shadow-lg"
      aria-label="Next weekly draw"
    >
      <Image
        src="/images/hero-ticket-full.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 420px"
        className="pointer-events-none object-fill opacity-50"
      />

      {SPARKLES.map((className, i) => (
        <StarIcon key={i} className={`hero-twinkle pointer-events-none absolute ${className}`} />
      ))}

      <div className="relative flex items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          <TrophyIcon className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/90">
          This Week&apos;s Prize Pool
        </span>
      </div>

      <div className="relative mt-1.5 w-fit overflow-hidden">
        <p className="font-heading text-[54px] font-extrabold leading-none tracking-tight text-balance text-white">
          ${PRIZE_POOL_USDT.toLocaleString()}
        </p>
        <span aria-hidden className="hero-shine-bar absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/30" />
      </div>

      <p className="relative mt-1.5 text-sm font-medium text-pretty text-white/85">
        Split among {WEEKLY_WINNER_COUNT} winners · ${PRIZE_PER_WINNER_USDT} USDT each
      </p>

      <div className="relative mt-4 border-t border-white/15 pt-3.5">
        <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-white/60">
          Next draw in
        </p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl bg-black/25 px-0.5 py-2.5 backdrop-blur-[2px]">
              <p className="font-heading text-xl font-bold tabular-nums text-white">{item.value}</p>
              <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
