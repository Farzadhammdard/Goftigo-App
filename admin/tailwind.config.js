/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        goftgoo: '#0A84FF',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'blob': {
          '0%, 100%': {transform: 'translate(0,0) scale(1)'},
          '33%': {transform: 'translate(30px,-40px) scale(1.1)'},
          '66%': {transform: 'translate(-20px,20px) scale(0.95)'},
        },
        'toast-in': {
          '0%': {opacity: '0', transform: 'translateX(120%) scale(0.9)'},
          '100%': {opacity: '1', transform: 'translateX(0) scale(1)'},
        },
        'fade-up': {
          '0%': {opacity: '0', transform: 'translateY(10px)'},
          '100%': {opacity: '1', transform: 'translateY(0)'},
        },
        'pop': {
          '0%': {transform: 'scale(0.8)', opacity: '0'},
          '60%': {transform: 'scale(1.05)'},
          '100%': {transform: 'scale(1)', opacity: '1'},
        },
        'shimmer': {
          '100%': {transform: 'translateX(100%)'},
        },
      },
      animation: {
        'blob': 'blob 18s ease-in-out infinite',
        'toast-in': 'toast-in 0.35s cubic-bezier(0.21,1.02,0.73,1)',
        'fade-up': 'fade-up 0.35s ease-out both',
        'pop': 'pop 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
