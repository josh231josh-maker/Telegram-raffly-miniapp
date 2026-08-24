"use client";

import { useState } from "react";

function initials(firstName: string | null, username: string | null): string {
  const source = firstName || username || "?";
  return source.slice(0, 2).toUpperCase();
}

type UserAvatarProps = {
  photoUrl: string | null;
  firstName: string | null;
  username: string | null;
  size?: number;
};

// Telegram's photo_url is an arbitrary CDN URL, not one of our own optimized
// assets, so this renders a plain <img> the same way the mini app's
// ProfileCard does -- falls back to initials on load failure or when no
// photo is on file at all.
export function UserAvatar({ photoUrl, firstName, username, size = 32 }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = `${size}px`;

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: dimension, height: dimension }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      style={{ width: dimension, height: dimension }}
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70"
    >
      {initials(firstName, username)}
    </span>
  );
}
