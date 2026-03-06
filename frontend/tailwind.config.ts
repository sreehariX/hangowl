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
          DEFAULT: "#1A1A2E",
          light: "#22223A",
          lighter: "#2A2A45",
        },
        amber: {
          DEFAULT: "#F5A623",
          dark: "#D48E1A",
        },
        "mid-blue": {
          DEFAULT: "#4A4E8A",
          light: "#5A5E9A",
        },
        surface: {
          DEFAULT: "#1E1E35",
          hover: "#25253F",
        },
        text: {
          primary: "#F0F0F5",
          secondary: "#9595AD",
          muted: "#6B6B85",
        },
        border: "#2E2E4A",
        success: "#4ADE80",
        error: "#F87171",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
