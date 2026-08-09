"use client";

import { useEffect, useRef, useState } from "react";

type DeltaBadge = { id: number; amount: number };

type AnimatedTicketValueProps = {
  value: number;
  className?: string;
};

// Pops the number and floats a "+N" badge above it whenever the value goes
// up -- ignores decreases (e.g. spending tickets on a raffle entry) since
// this is meant to celebrate tickets landing in the balance, not any change.
export function AnimatedTicketValue({ value, className }: AnimatedTicketValueProps) {
  const prevValueRef = useRef(value);
  const [pop, setPop] = useState(false);
  const [badges, setBadges] = useState<DeltaBadge[]>([]);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (value <= prev) return;

    const delta = value - prev;
    const id = Date.now();

    setPop(true);
    setBadges((list) => [...list, { id, amount: delta }]);

    const popTimer = setTimeout(() => setPop(false), 550);
    const badgeTimer = setTimeout(() => {
      setBadges((list) => list.filter((badge) => badge.id !== id));
    }, 1200);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(badgeTimer);
    };
  }, [value]);

  return (
    <span className="relative inline-block">
      <span className={`${className ?? ""} inline-block tabular-nums ${pop ? "ticket-value-pop" : ""}`}>
        {value}
      </span>
      {badges.map((badge) => (
        <span key={badge.id} className="ticket-value-badge" aria-hidden="true">
          +{badge.amount}
        </span>
      ))}
    </span>
  );
}
