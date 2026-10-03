/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        psp: '0 0 0 1px rgba(255,255,255,0.18), 0 18px 50px rgba(0,0,0,0.38)',
      },
    },
  },
  plugins: [],
};