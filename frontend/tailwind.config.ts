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
        navy: {
          DEFAULT: "#090C14",
          light: "#101726",
          lighter: "#182236",
        },
        amber: {
          DEFAULT: "#F4B63C",
          dark: "#D79A2B",
        },
        "mid-blue": {
          DEFAULT: "#4E79C7",
          light: "#6893E0",
        },
        surface: {
          DEFAULT: "#121B2B",
          hover: "#1A2537",
        },
        text: {
          primary: "#F7F9FC",
          secondary: "#B6C0D4",
          muted: "#7C8BA4",
        },
        border: "#233149",
        success: "#3DD9A4",
        error: "#FF6A7A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px rgba(4, 10, 23, 0.22)",
        glass: "0 8px 24px rgba(4, 10, 23, 0.3)",
        elevated: "0 12px 42px rgba(2, 8, 18, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
