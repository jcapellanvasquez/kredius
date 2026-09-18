/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Brand violet — primary accent (nav, switches, CTAs)
        // Never used for financial meaning
        brand: {
          50:  '#f3f1fb',
          100: '#e8e5f7',
          200: '#d4cdf1',
          300: '#b9afe7',
          400: '#9d8eda',
          500: '#8b7bc7',
          600: '#7a65b8',
          700: '#6852a5',
          800: '#554387',
          900: '#45376e',
          950: '#2a2043',
        },
        // Semantic financial colors — ONLY for financial meaning
        income:  '#16a34a', // green — inflows, deposits, credits
        expense: '#ef4444', // red   — outflows, payments, debits
      },
    },
  },
  plugins: [],
};
