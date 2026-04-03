/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "sans-serif"] },
      colors: {
        surface: "#141414",
        card: "#1a1a1a",
        border: "#2a2a2a",
      },
    },
  },
  plugins: [],
};
