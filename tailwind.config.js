/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B1220",
        panel: "#121B2E",
        panel2: "#16213A", // one step up from panel — for surfaces stacked on top of a panel (inputs, nested rows)
        line: "#22304A",
        mint: "#34D399",
        mintdim: "#0F3B2E",
        // Third status color for the "sent, waiting on the customer's PIN"
        // state — the middle beat of every STK push. Kept visually distinct
        // from both "not started" (muted) and "settled" (mint).
        amber: "#F0B849",
        amberdim: "#3A2C0F",
        danger: "#F87171",
        dangerdim: "#3A1A1A",
        muted: "#8B9BB4",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        // Dark-theme neomorphism: a soft inner highlight along the top edge
        // (light catching the surface) paired with a deep ambient drop
        // shadow underneath, both derived from the base navy rather than
        // generic black/white.
        neo: "inset 0 1px 0 0 rgba(148,180,220,0.09), inset 0 -1px 0 0 rgba(0,0,0,0.35), 0 12px 30px -14px rgba(0,0,0,0.65)",
        "neo-sm": "inset 0 1px 0 0 rgba(148,180,220,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.3), 0 6px 16px -10px rgba(0,0,0,0.6)",
        "neo-pressed": "inset 0 2px 6px 0 rgba(0,0,0,0.5), inset 0 -1px 0 0 rgba(148,180,220,0.04)",
        "neo-inset": "inset 0 1px 3px 0 rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(148,180,220,0.03)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 32px -12px rgba(0,0,0,0.55)",
        "glow-mint": "0 0 0 1px rgba(52,211,153,0.35), 0 0 24px -4px rgba(52,211,153,0.45)",
        "glow-amber": "0 0 0 1px rgba(240,184,73,0.35), 0 0 24px -4px rgba(240,184,73,0.45)",
      },
      backdropBlur: { xs: "2px" },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-2%, 3%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.3,0.6,0.4,1) infinite",
        float: "float 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
