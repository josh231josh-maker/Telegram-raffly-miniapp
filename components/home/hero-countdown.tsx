"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCurrentWeekEnd, PRIZE_POOL_USDT } from "@/lib/raffle-week";
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
  "left-8 top-4 h-3 w-3 text-white/70 [animation-delay:0s]",
  "right-8 top-6 h-2.5 w-2.5 text-white/55 [animation-delay:0.7s]",
  "right-14 top-20 h-2 w-2 text-white/45 [animation-delay:1.4s]",
  "left-14 top-20 h-2 w-2 text-white/45 [animation-delay:2.1s]",
];

export function HeroCountdown() {
  const [target, setTarget] = useState(() => getCurrentWeekEnd());
  const [segments, setSegments] = useState<Segments>({
    days: "--",
    hours: "--",
    minutes: "--",
    seconds: "--",
  });

  useEffect(() => {
    // If the app is left open across the weekly rollover, the old target
    // reaches zero and would otherwise stay frozen there forever -- roll it
    // forward to the new week's end instead of just clamping at 00:00:00:00.
    const tick = () => {
      const remaining = target.getTime() - Date.now();
      if (remaining <= 0) {
        setTarget(getCurrentWeekEnd());
        return;
      }
      setSegments(toSegments(remaining));
    };
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
      className="hero-rise relative isolate p-5 text-white"
      aria-label="Next weekly draw"
    >
      <Image
        src="/images/hero-ticket-full.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 420px"
        className="pointer-events-none -z-10 object-contain opacity-100"
      />

      {SPARKLES.map((className, i) => (
        <StarIcon key={i} className={`hero-twinkle pointer-events-none absolute ${className}`} />
      ))}

      <div className="relative flex items-center justify-center gap-1">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
          <TrophyIcon className="h-3 w-3 text-white" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/90">
          This Week&apos;s Prize Pool
        </span>
      </div>

      <div className="relative mx-auto mt-1 w-fit">
        <p className="hero-prize-glow font-heading text-[34px] font-extrabold leading-none tracking-tight text-balance text-white">
          ${PRIZE_POOL_USDT.toLocaleString()}
        </p>
      </div>

      <div className="relative mt-1.5 border-t border-white/15 px-5 pt-1.5">
        <p className="mb-1 text-center text-[9px] font-medium uppercase tracking-wide text-white/60">
          Next draw in
        </p>
        <div className="grid grid-cols-4 gap-0.5 text-center">
          {items.map((item) => (
            <div key={item.label} className="px-0">
              <p className="font-heading text-[24px] font-bold leading-none tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
                {item.value}
              </p>
              <p className="mt-0.5 text-[7px] uppercase tracking-wide text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
