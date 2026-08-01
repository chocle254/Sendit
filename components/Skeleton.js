// Base shimmer block for loading states. Compose with className for size
// (e.g. "h-4 w-24", "h-10 w-10 rounded-full"). The sweep is a background-
// position animation (see tailwind.config.js `shimmer` keyframes) rather
// than an opacity pulse — it reads as "content is arriving" instead of
// "something is broken and blinking."
export default function Skeleton({ className = "" }) {
  return (
    <div
      className={`rounded-md bg-panel2 bg-gradient-to-r from-panel2 via-white/[0.07] to-panel2 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}
