// No default rounding here — every call site supplies its own (rounded-full,
// rounded-2xl, etc.) since mixing a base radius with an overriding one in the
// same className string is unreliable with plain Tailwind utility classes.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-border ${className}`} />;
}
