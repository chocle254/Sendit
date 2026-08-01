export default function Logo({ size = 28, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#121B2E" stroke="#22304A" />
        <path d="M14 34 L46 18 L38 46 L32 34 L14 34 Z" fill="url(#logoGrad)" />
      </svg>
      <span className="font-display font-semibold text-lg tracking-tight text-white">
        Send<span className="text-mint">it</span>
      </span>
    </span>
  );
}
