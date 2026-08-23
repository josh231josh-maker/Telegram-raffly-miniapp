import { CheckIcon } from "@/components/icons";
import { TicketImage } from "@/components/ticket-image";

type CompletedTaskRowProps = {
  label: string;
  rewardAmount: number;
};

// Presentational only -- a finished one-time task (e.g. Join Channel) just
// needs to show it's done, not accept another tap.
export function CompletedTaskRow({ label, rewardAmount }: CompletedTaskRowProps) {
  return (
    <div className="card-soft flex w-full items-center gap-3 rounded-[28px] border border-border bg-card px-4 py-3 opacity-70">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-soft text-green">
        <CheckIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-bold text-text-faint">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-base font-bold text-text-faint">
        +{rewardAmount}
        <TicketImage size={22} />
      </span>
    </div>
  );
}
