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
        // Amber notice — something needs the user's action (e.g. a missing US$ rate); not an error
        warning: {
          bg:     '#fbf5ea',
          border: '#ebd9b8',
          text:   '#8a6a2e',
        },
        // Progress bars on the budget screen — neutral / amber / red only (budget_screen_final.md §7)
        bar: {
          track:   '#f3f4f6',
          good:    '#7fae8c', // soft green — only the card ring on the budget screen
          neutral: '#d1d5db',
          warning: '#c99b54',
          danger:  '#c77b7b',
        },
      },
    },
  },
  plugins: [],
};
