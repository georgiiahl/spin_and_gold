/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fold: { DEFAULT: '#6b7280', light: '#9ca3af' },
        call: { DEFAULT: '#22c55e', light: '#86efac' },
        raise: { DEFAULT: '#ef4444', light: '#fca5a5' },
        jam: { DEFAULT: '#a855f7', light: '#d8b4fe' },
      },
    },
  },
  plugins: [],
};
