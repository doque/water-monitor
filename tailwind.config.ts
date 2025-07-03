/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "spin-slow": {
          // Custom slow spin
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "flashy-fireworks": {
          // Custom flashy effect
          "0%, 100%": {
            boxShadow: "0 0 10px 5px rgba(255, 255, 0, 0.7)", // Yellow
            filter: "brightness(1)",
          },
          "25%": {
            boxShadow: "0 0 30px 15px rgba(255, 165, 0, 0.8)", // Orange
            filter: "brightness(1.1)", // Reduced brightness
          },
          "50%": {
            boxShadow: "0 0 50px 25px rgba(255, 0, 0, 0.9)", // Red
            filter: "brightness(1.2)", // Reduced brightness
          },
          "75%": {
            boxShadow: "0 0 30px 15px rgba(255, 165, 0, 0.8)", // Orange
            filter: "brightness(1.1)", // Reduced brightness
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 3s linear infinite", // Apply custom duration
        "flashy-fireworks": "flashy-fireworks 1.5s ease-in-out infinite", // Apply custom duration and timing
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
