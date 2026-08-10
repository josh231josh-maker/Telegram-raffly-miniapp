"use client";

import { TonProvider } from "@/components/providers/ton-provider";
import { WithdrawModal } from "@/components/profile/withdraw-modal";

type WithdrawModalWithProviderProps = {
  onClose: () => void;
};

// TonConnect (~350KB) is only needed once a user actually opens this modal --
// bundling it here (loaded via next/dynamic in withdraw-button.tsx) instead
// of wrapping the whole app in the root layout keeps it out of every other
// session's initial JS payload.
export default function WithdrawModalWithProvider({ onClose }: WithdrawModalWithProviderProps) {
  return (
    <TonProvider>
      <WithdrawModal onClose={onClose} />
    </TonProvider>
  );
}
