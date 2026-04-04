import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vanta: "#030407", navy: "#0A0D14",
        gold: { DEFAULT: "#E5C07B", dim: "#C9A45E" },
        oat: "#F7F7F5",
      },
      fontFamily: { sans: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;