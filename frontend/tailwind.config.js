/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LedgerLens AI Brand Colors
        primary: {
          50:  '#eef4ff',
          100: '#ddeaff',
          200: '#c0d7ff',
          300: '#93b8ff',
          400: '#608eff',
          500: '#3b62f9',
          600: '#2845ee',
          700: '#1f31d4',
          800: '#2029ab',
          900: '#1e2787',
          950: '#161853',
        },
        navy: {
          50:  '#f0f2f8',
          100: '#dde2f0',
          200: '#c0cbe3',
          300: '#97a9cf',
          400: '#6882b8',
          500: '#4c63a1',
          600: '#3b4f88',
          700: '#31406f',
          800: '#1c2340',
          900: '#111526',
          950: '#0a0d17',
        },
        ledger: {
          blue: '#2845ee',
          indigo: '#4361ee',
          accent: '#3b82f6',
          surface: '#f8fafc',
          border: '#e2e8f0',
          muted: '#64748b',
          dark: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
        'card-lg': '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)',
        'card-hover': '0 8px 25px -5px rgba(40,69,238,0.15), 0 4px 10px -6px rgba(40,69,238,0.10)',
        'sidebar': '1px 0 0 0 #e2e8f0',
        'topbar': '0 1px 0 0 #e2e8f0',
      },
      borderRadius: {
        'xl2': '1rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
