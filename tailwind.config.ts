import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070707",
        surface: "#0B0B0B",
        border: "#1E1E1E",
        "text-primary": "#DDD8D0",
        "text-muted": "#2E2E2E",
        blue: "#3333CC",
        red: "#E85533",
        green: "#33AA77",
        purple: "#CC33AA",
        gold: "#CC9933",
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
