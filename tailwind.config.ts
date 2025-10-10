import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
      fontFamily: {
        'system': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'lexend': ['Lexend', 'sans-serif'],
        'jetbrains': ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        'poppins': ['Poppins', 'system-ui', 'sans-serif'],
        'oswald': ['Oswald', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          muted: "hsl(var(--primary-muted))",
          dark: "hsl(var(--primary-dark))",
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
          muted: "hsl(var(--accent-muted))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        course: {
          cs: "hsl(var(--course-cs))",
          math: "hsl(var(--course-math))",
          english: "hsl(var(--course-english))",
          science: "hsl(var(--course-science))",
          other: "hsl(var(--course-other))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "scroll-text": {
          "0%": {
            transform: "translateX(0%)",
          },
          "100%": {
            transform: "translateX(-100%)",
          },
        },
        "scroll-boomerang": {
          "0%": {
            transform: "translateX(0%)",
          },
          "25%": {
            transform: "translateX(-75%)",
          },
          "50%": {
            transform: "translateX(0%)",
          },
          "100%": {
            transform: "translateX(0%)",
          },
        },
        // Smooth performance animations
        "smooth-fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px) translateZ(0)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0) translateZ(0)",
          },
        },
        "smooth-scale": {
          "0%": {
            transform: "scale(0.95) translateZ(0)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1) translateZ(0)",
            opacity: "1",
          },
        },
        "smooth-slide-up": {
          "0%": {
            transform: "translateY(20px) translateZ(0)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0) translateZ(0)",
            opacity: "1",
          },
        },
        "ultra-smooth-scroll": {
          "0%": {
            transform: "translateY(0) translateZ(0)",
          },
          "100%": {
            transform: "translateY(0) translateZ(0)",
          },
        },
        // Background gradient animations
        "moveHorizontal": {
          "0%": {
            transform: "translateX(-50%) translateY(-10%)",
          },
          "50%": {
            transform: "translateX(50%) translateY(10%)",
          },
          "100%": {
            transform: "translateX(-50%) translateY(-10%)",
          },
        },
        "moveInCircle": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "50%": {
            transform: "rotate(180deg)",
          },
          "100%": {
            transform: "rotate(360deg)",
          },
        },
        "moveVertical": {
          "0%": {
            transform: "translateY(-50%)",
          },
          "50%": {
            transform: "translateY(50%)",
          },
          "100%": {
            transform: "translateY(-50%)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scroll-text": "scroll-text 3s linear infinite",
        // Ultra smooth animations
        "smooth-fade-in": "smooth-fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "smooth-scale": "smooth-scale 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "smooth-slide-up": "smooth-slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        // Background gradient animations
        "first": "moveVertical 30s ease infinite",
        "second": "moveInCircle 20s reverse infinite",
        "third": "moveInCircle 40s linear infinite",
        "fourth": "moveHorizontal 40s ease infinite",
        "fifth": "moveInCircle 20s ease infinite",
      },
      // Enhanced transitions for ultra smooth interactions
      transitionTimingFunction: {
        'ultra-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-smooth': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
