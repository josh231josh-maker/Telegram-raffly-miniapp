import Image from "next/image";

type TicketImageProps = {
  size?: number;
  className?: string;
};

// The ticket artwork is a wide rectangle, not square -- sizing by width and
// deriving height from its real aspect ratio keeps it undistorted (a plain
// width=height=size would squash it) and never taller than the old square
// icon it replaces, so it still fits every existing badge/pill it's used in.
const TICKET_ASPECT_RATIO = 640 / 327;

export function TicketImage({ size = 32, className }: TicketImageProps) {
  return (
    <Image
      src="/images/ticket.png"
      alt=""
      width={size}
      height={Math.round(size / TICKET_ASPECT_RATIO)}
      className={className}
    />
  );
}
