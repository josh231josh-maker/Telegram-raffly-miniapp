"use client";

// Regional indicator symbols run A=U+1F1E6..Z=U+1F1FF, offset exactly
// 127397 above the Latin letter's own code point -- pairing two of them is
// how a flag emoji is built for any ISO 3166-1 code, so this needs no
// static flag-image lookup table at all.
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

// Intl.DisplayNames resolves a code to its English country name using the
// runtime's own locale data, so this also needs no static name table and
// stays correct as country names/codes change.
const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    // Intl.DisplayNames throws on a code it doesn't recognize as a region.
    return code;
  }
}

type CountryFlagProps = {
  countryCode: string | null;
};

// countryCode is only ever set from a validated 2-letter code (see
// countryFromRequest in app/api/auth/route.ts), so no further validation
// happens here -- this only ever renders a value this app itself wrote.
export function CountryFlag({ countryCode }: CountryFlagProps) {
  if (!countryCode) return <span className="text-white/30">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{flagEmoji(countryCode)}</span>
      <span>{countryName(countryCode)}</span>
    </span>
  );
}
