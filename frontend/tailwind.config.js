/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#edfcff',
          100: '#d6f7ff',
          200: '#b5f1ff',
          300: '#83e8ff',
          400: '#48d5ff',
          500: '#1eb8ff',
          600: '#0097e6',
          700: '#0079ba',
          800: '#006497',
          900: '#06527a',
        },
        dark: {
          900: '#080c10',
          800: '#0d1520',
          700: '#111d2e',
          600: '#162438',
          500: '#1a3050',
          400: '#1e3a5f',
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        sans: ['Barlow', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
