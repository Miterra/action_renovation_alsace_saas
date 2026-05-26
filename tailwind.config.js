/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Charte graphique alignée avec le site client Action Rénovation Alsace
        navy: {
          50: '#f0f4fa',
          100: '#dbe5f1',
          200: '#bccde3',
          300: '#8eaccd',
          400: '#5a83b0',
          500: '#386696',
          600: '#2b517d',
          700: '#244266',
          800: '#1f3856',
          900: '#0f2742',
          950: '#0a1a30',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        surface: {
          DEFAULT: '#f7f8fb',
          card: '#ffffff',
          subtle: '#f1f3f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(15, 39, 66, 0.06)',
        'card': '0 8px 30px -8px rgba(15, 39, 66, 0.10)',
        'cta': '0 10px 30px -5px rgba(249, 115, 22, 0.35)',
        'inset-soft': 'inset 0 1px 2px rgba(15, 39, 66, 0.04)',
      },
      borderRadius: {
        'xl2': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
