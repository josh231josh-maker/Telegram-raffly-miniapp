"use client";

import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<unknown>;
      };
    };
  }
}

type UseAdsgramParams = {
  blockId: string;
  onReward: () => void;
  onError?: (result: unknown) => void;
};

export function useAdsgram({ blockId, onReward, onError }: UseAdsgramParams) {
  const AdControllerRef = useRef<{ show: () => Promise<unknown> } | undefined>(undefined);

  useEffect(() => {
    AdControllerRef.current = window.Adsgram?.init({ blockId });
  }, [blockId]);

  return useCallback(async () => {
    if (AdControllerRef.current) {
      try {
        await AdControllerRef.current.show();
        onReward();
      } catch (result) {
        onError?.(result);
      }
    } else {
      onError?.({ error: true, description: "Adsgram script not loaded" });
    }
  }, [onError, onReward]);
}