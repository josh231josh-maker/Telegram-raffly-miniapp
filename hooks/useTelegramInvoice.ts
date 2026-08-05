"use client";

import { invoice } from "@telegram-apps/sdk";
import { useCallback } from "react";

export function useTelegramInvoice() {
  return useCallback(async (url: string): Promise<string> => {
    if (invoice.open.isAvailable()) {
      const status = await invoice.open(url, "url");
      return status;
    }
    return "unavailable";
  }, []);
}