"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCurrentWeekEnd } from "@/lib/raffle-week";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";

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

const PRIZE_PER_WINNER = 100;

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
    { label: "Hrs", value: segments.hours },
    { label: "Min", value: segments.minutes },
    { label: "Sec", value: segments.seconds },
  ];

  return (
    <div className="relative mx-1.5 mb-2">
      <section
        className="hero-gradient relative -rotate-[1.4deg] overflow-hidden rounded-[28px] p-5 text-white shadow-lg"
        aria-label="Next weekly draw"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, var(--orange), transparent 65%)" }}
        />
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
          This week&apos;s pool · {WEEKLY_WINNER_COUNT} winners
        </span>
        <p className="jackpot-text font-heading mt-1.5 text-[42px] font-extrabold leading-none tracking-tight text-balance">
          ${WEEKLY_WINNER_COUNT * PRIZE_PER_WINNER}
        </p>
        <p className="mt-1.5 text-xs font-medium text-white/75">
          ${PRIZE_PER_WINNER} USDT to each of {WEEKLY_WINNER_COUNT} winners, every week
        </p>
        <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl bg-black/20 px-0.5 py-2.5">
              <p className="font-heading text-xl font-bold tabular-nums">{item.value}</p>
              <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-white/60">{item.label}</p>
            </div>
          ))}
        </div>
        <Image
          src="/images/hero-ticket.png"
          alt=""
          width={700}
          height={304}
          className="float-bob-subtle mx-auto mt-4 h-auto w-full max-w-[280px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
        />
      </section>
    </div>
  );
}
