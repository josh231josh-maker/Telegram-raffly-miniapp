"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    show_11527679?: (params: { ymid: string }) => Promise<unknown>;
  }
}

export function useMonetagAd() {
  return useCallback(async (ymid: string): Promise<boolean> => {
    if (!window.show_11527679) {
      return false;
    }
    try {
      await window.show_11527679({ ymid });
      return true;
    } catch {
      return false;
    }
  }, []);
}
