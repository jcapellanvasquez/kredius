/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand violet — primary accent (nav, switches, CTAs)
        // Never used for financial meaning
        brand: {
          50:  '#f5f3fb', // --accent-soft-bg (spec exact)
          100: '#e8e5f7',
          200: '#d4cdf1',
          300: '#b9afe7',
          400: '#9d8eda',
          500: '#8b7bc7', // --accent (spec exact)
          600: '#7a68b8', // --accent-hover (spec exact)
          700: '#6852a5',
          800: '#5b4e8c', // --accent-soft-text (spec exact)
          900: '#45376e',
          950: '#2a2043',
        },
        // Semantic financial colors — ONLY for financial meaning
        income:  '#16a34a', // green — inflows, deposits, credits
        expense: '#dc2626', // red   — outflows, alerts (spec: #DC2626, not ef4444)
      },
    },
  },
  plugins: [],
};
