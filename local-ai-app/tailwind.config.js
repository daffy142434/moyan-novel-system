/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--accent, #1a73ff)",
          hover: "var(--accent-hover, #3385ff)",
          light: "var(--accent-light, #e0ebff)",
        },
      },
    },
  },
  plugins: [],
};
