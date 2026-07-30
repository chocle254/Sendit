/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B1220",
        panel: "#121B2E",
        line: "#22304A",
        mint: "#34D399",
        mintdim: "#0F3B2E",
        danger: "#F87171",
        muted: "#8B9BB4",
      },
    },
  },
  plugins: [],
};
