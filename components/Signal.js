// A small radiating ping — the same motif an STK prompt itself uses when
// it lands on a phone and waits for a PIN. Used anywhere something is
// "sent, awaiting confirmation" rather than a generic spinner.
const COLORS = {
  amber: { dot: "bg-amber", ring: "bg-amber/70" },
  mint: { dot: "bg-mint", ring: "bg-mint/70" },
  muted: { dot: "bg-muted", ring: "bg-muted/70" },
  danger: { dot: "bg-danger", ring: "bg-danger/70" },
};

export default function Signal({ color = "amber", className = "" }) {
  const c = COLORS[color] || COLORS.amber;
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className={`absolute inline-flex h-full w-full rounded-full ${c.ring} animate-pulse-ring`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
    </span>
  );
}
