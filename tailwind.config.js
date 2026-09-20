/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand — deep indigo-blue, fintech professional
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Success / exempt
        success: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          600: "#16a34a",
          700: "#15803d",
        },
        // Warning / MDR applicable
        warn: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          600: "#d97706",
          700: "#b45309",
        },
        // Surface colors
        surface: {
          0:   "#ffffff",
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        card:   "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-md": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        inner: "inset 0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
