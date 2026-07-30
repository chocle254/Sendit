export default function Logo({ size = 28 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#logoGrad)" />
        <path d="M14 34 L46 18 L38 46 L32 34 L14 34 Z" fill="white" />
      </svg>
      <span className="font-bold text-lg tracking-tight text-gray-900">
        Send<span className="text-indigo-600">it</span>
      </span>
    </span>
  );
}
