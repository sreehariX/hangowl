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
        // Deep ink background scale — Apple-grade midnight
        navy: {
          DEFAULT: "#06080F",
          light: "#0D1220",
          lighter: "#141B2D",
        },
        ink: {
          950: "#06080F",
          900: "#0A0F1C",
          850: "#0D1220",
          800: "#111829",
          750: "#141B2D",
          700: "#1A2238",
          600: "#232D46",
          500: "#2E395A",
        },
        // Warm gold — the premium accent
        amber: {
          DEFAULT: "#F6BA3D",
          light: "#FFCE5A",
          dark: "#D29425",
          50: "#FFF4D6",
          100: "#FFE6A3",
          400: "#FFCE5A",
          500: "#F6BA3D",
          600: "#D29425",
          700: "#A1701A",
        },
        // Royal indigo — the secondary accent
        "mid-blue": {
          DEFAULT: "#5B83D4",
          light: "#7BA1F0",
          dark: "#3E63B3",
        },
        brand: {
          50: "#EDF3FF",
          100: "#D6E2FF",
          300: "#97B5F0",
          400: "#7BA1F0",
          500: "#5B83D4",
          600: "#3E63B3",
          700: "#2E4A8C",
        },
        surface: {
          DEFAULT: "#0F1626",
          raised: "#141B2D",
          hover: "#1A2238",
          muted: "#0B1120",
        },
        text: {
          primary: "#F3F5FA",
          secondary: "#B4BFD4",
          tertiary: "#8594B0",
          muted: "#6C7A94",
        },
        border: {
          DEFAULT: "#1E2840",
          subtle: "#172038",
          strong: "#2A3758",
        },
        success: {
          DEFAULT: "#34D99F",
          soft: "rgba(52, 217, 159, 0.14)",
        },
        warning: {
          DEFAULT: "#F6BA3D",
        },
        danger: {
          DEFAULT: "#FF6B7D",
          soft: "rgba(255, 107, 125, 0.14)",
        },
        error: "#FF6B7D",
        info: {
          DEFAULT: "#5B83D4",
          soft: "rgba(91, 131, 212, 0.14)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        micro: ["10.5px", { lineHeight: "1.3", letterSpacing: "0.02em" }],
        caption: ["12px", { lineHeight: "1.45", letterSpacing: "0.005em" }],
        body: ["14px", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
        "body-lg": ["15px", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
        headline: ["17px", { lineHeight: "1.45", letterSpacing: "-0.01em" }],
        title: ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "title-lg": ["28px", { lineHeight: "1.2", letterSpacing: "-0.022em" }],
        display: ["34px", { lineHeight: "1.1", letterSpacing: "-0.028em" }],
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        "safe-top": "env(safe-area-inset-top, 0px)",
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 4px 18px -2px rgba(3, 6, 14, 0.45), 0 1px 2px rgba(3, 6, 14, 0.35)",
        glass: "0 8px 28px -6px rgba(3, 6, 14, 0.55), 0 1px 2px rgba(3, 6, 14, 0.4)",
        elevated: "0 18px 48px -12px rgba(3, 6, 14, 0.7), 0 2px 6px rgba(3, 6, 14, 0.45)",
        "glow-amber": "0 0 0 1px rgba(246, 186, 61, 0.25), 0 10px 32px -8px rgba(246, 186, 61, 0.35)",
        "glow-brand": "0 0 0 1px rgba(91, 131, 212, 0.25), 0 10px 32px -8px rgba(91, 131, 212, 0.3)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        250: "250ms",
        400: "400ms",
      },
      backgroundImage: {
        "gradient-hero":
          "radial-gradient(1200px 700px at 8% -20%, rgba(91, 131, 212, 0.22), transparent 60%), radial-gradient(900px 620px at 100% 0%, rgba(246, 186, 61, 0.12), transparent 55%), linear-gradient(180deg, #05070D 0%, #070B15 40%, #09111F 100%)",
        "gradient-gold":
          "linear-gradient(135deg, #FFCE5A 0%, #F6BA3D 55%, #D29425 100%)",
        "gradient-brand":
          "linear-gradient(135deg, #7BA1F0 0%, #5B83D4 55%, #3E63B3 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
