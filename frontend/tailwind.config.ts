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
        /*
         * Premium ink palette - warm charcoal base, editorial gold accent.
         * Inspired by Apple Music, Robinhood, NYT Cooking in dark mode.
         * We avoid pure #000 so surfaces have depth and text doesn't vibrate.
         */
        navy: { DEFAULT: "#0A0A0D", light: "#111116", lighter: "#17171D" },
        ink: {
          950: "#09090C",
          900: "#0B0B0F",
          850: "#111116",
          800: "#17171D",
          750: "#1D1D24",
          700: "#23232B",
          600: "#2C2C35",
          500: "#34343E",
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
          DEFAULT: "#0B0B0F",
          raised: "#111116",
          hover: "#17171D",
          muted: "#09090C",
        },
        text: {
          primary: "#F1F2F5",
          secondary: "#B0B3BB",
          tertiary: "#7B7F88",
          muted: "#52565E",
        },
        border: {
          DEFAULT: "#24242B",
          subtle: "#17171D",
          strong: "#33333C",
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
