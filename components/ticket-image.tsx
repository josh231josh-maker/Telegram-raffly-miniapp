import Image from "next/image";

type TicketImageProps = {
  size?: number;
  className?: string;
};

export function TicketImage({ size = 32, className }: TicketImageProps) {
  return (
    <Image
      src="/images/ticket.png"
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
