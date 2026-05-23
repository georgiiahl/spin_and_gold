/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'bg-fold', 'bg-call', 'bg-raise', 'bg-jam',
    'bg-fold/70', 'bg-call/70', 'bg-raise/70', 'bg-jam/70',
    'text-fold', 'text-call', 'text-raise', 'text-jam',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        fold: { DEFAULT: '#ef4444', light: '#fca5a5' },
        call: { DEFAULT: '#3b82f6', light: '#93c5fd' },
        raise: { DEFAULT: '#f59e0b', light: '#fcd34d' },
        jam: { DEFAULT: '#8b5cf6', light: '#c4b5fd' },
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(15, 23, 42, 0.55)',
      },
    },
  },
  plugins: [],
};
