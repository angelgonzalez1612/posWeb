/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0ea5e9',
          soft: '#e0f2fe',
        },
        panel: '#f8fafc',
        sale: '#10b981',
      },
    },
  },
  plugins: [],
}
