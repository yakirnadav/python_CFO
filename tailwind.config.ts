import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#D04A02",
          dark: "#A93B01",
          light: "#F7E3D6",
        },
        compliant: "#1B8A3D",
        exceeds: "#D32F2F",
        review: "#E08A00",
      },
      fontFamily: {
        hebrew: ["David", "Arial Hebrew", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
