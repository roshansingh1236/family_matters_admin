
import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff1f4',
          100: '#ffe0e6',
          200: '#ffc5d1',
          300: '#ff9aad',
          400: '#ff6080',
          500: '#f83a5e',
          600: '#e51a49',
          700: '#c1103b',
          800: '#a11137',
          900: '#891335',
          950: '#4c0419',
        },
        surface: {
          light: '#ffffff',
          DEFAULT: '#fdf4f6',
          dark:  '#0e0b1a',
          'dark-2': '#15111f',
          'dark-3': '#1d1730',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-rose': '0 0 20px rgba(248, 58, 94, 0.25)',
        'glow-sm':   '0 0 10px rgba(248, 58, 94, 0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #f83a5e 0%, #ec4899 50%, #a855f7 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #fff1f4 0%, #fdf4ff 100%)',
        'sidebar-dark': 'linear-gradient(180deg, #0e0b1a 0%, #130f22 100%)',
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
