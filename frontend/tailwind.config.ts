import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#000", light: "#0A0A0A", lighter: "#111113" },
        ink: {
          950: "#000000",
          900: "#050506",
          850: "#0A0A0B",
          800: "#111113",
          750: "#17171A",
          700: "#1D1D20",
          600: "#26262A",
          500: "#2F2F33",
        },
        amber: {
          DEFAULT: "#F6BA3D",
          light: "#FFD05C",
          dark: "#D29425",
          400: "#FFD05C",
          500: "#F6BA3D",
          600: "#D29425",
          700: "#9C6D1B",
        },
        "mid-blue": {
          DEFAULT: "#5B83D4",
          light: "#7BA1F0",
          dark: "#3E63B3",
        },
        brand: {
          300: "#97B5F0",
          400: "#7BA1F0",
          500: "#5B83D4",
          600: "#3E63B3",
          700: "#2E4A8C",
        },
        surface: {
          DEFAULT: "#0A0A0B",
          raised: "#111113",
          hover: "#17171A",
          muted: "#050506",
        },
        text: {
          primary: "#E7E9EE",
          secondary: "#AEB3BD",
          tertiary: "#797F8B",
          muted: "#55595F",
        },
        border: {
          DEFAULT: "#222226",
          subtle: "#17171A",
          strong: "#2F2F33",
        },
        success: { DEFAULT: "#34D99F", soft: "rgba(52, 217, 159, 0.14)" },
        warning: { DEFAULT: "#F6BA3D" },
        danger:  { DEFAULT: "#F4212E", soft: "rgba(244, 33, 46, 0.14)" },
        error: "#F4212E",
        info:  { DEFAULT: "#5B83D4", soft: "rgba(91, 131, 212, 0.14)" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        micro:     ["11px", { lineHeight: "1.3" }],
        caption:   ["12px", { lineHeight: "1.45" }],
        body:      ["14px", { lineHeight: "1.5" }],
        "body-lg": ["15px", { lineHeight: "1.5" }],
        headline:  ["17px", { lineHeight: "1.4" }],
        title:     ["20px", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "title-lg":["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        display:   ["32px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        "safe-top": "env(safe-area-inset-top, 0px)",
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
