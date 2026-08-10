"use client";

import { backButton } from "@telegram-apps/sdk";
import { useEffect, useRef } from "react";

/**
 * Shows Telegram's native Back Button for as long as the calling component
 * is mounted, wiring its click to `onBack` -- typically the same handler
 * already used by the screen's own in-app Close button, so both paths lead
 * to the exact same place. Since these deeper screens are always mounted
 * conditionally (`{open && <Screen onClose={...} />}`), mounting IS "user
 * navigated deeper" and unmounting IS "user left this screen", so no
 * separate active/inactive flag is needed here.
 */
export function useTelegramBackButton(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!backButton.show.isAvailable()) return;
    backButton.show();

    const off = backButton.onClick.isAvailable()
      ? backButton.onClick(() => onBackRef.current())
      : undefined;

    return () => {
      off?.();
      if (backButton.hide.isAvailable()) backButton.hide();
    };
  }, []);
}
