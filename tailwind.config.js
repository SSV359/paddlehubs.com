/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        signature: "rgb(var(--signature) / <alpha-value>)",
        court: {
          DEFAULT: "#1C4E80",
          deep: "#0F2C4A",
        },
        courtgreen: "#2F6B4F",
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        score: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
}
