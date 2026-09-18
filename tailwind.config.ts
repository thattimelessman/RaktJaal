import type { Config } from "tailwindcss";

const config: Config = {
  content: [
  "./src/app/**/*.{js,jsx,ts,tsx}",
  "./src/components/**/*.{js,jsx,ts,tsx}",
  "./src/frontend/**/*.{js,jsx,ts,tsx}",
],
  theme: {
    extend: {
      colors: {
        blood: {
          50: "#fef2f2",
          100: "#fde2e2",
          200: "#fbc5c5",
          300: "#f79b9b",
          400: "#ef6666",
          500: "#dc2626",
          600: "#b91c1c",
          700: "#991515",
          800: "#7f1414",
          900: "#6b1414",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
