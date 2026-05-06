/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'zbucks-green':      '#0D6E56',
        'zbucks-green-dark': '#0a5a47',
        'zbucks-cream':      '#FAF6F0',
        'zbucks-brown':      '#3E2C1C',
        'zbucks-gold':       '#E8B547',
        'zbucks-mute':       '#888888',
      },
    },
  },
  plugins: [],
  // Tailwind 3 purge guard: keep these dynamic status pill colors
  safelist: [
    'bg-amber-100',  'text-amber-800',
    'bg-sky-100',    'text-sky-800',
    'bg-green-100',  'text-green-800',
    'bg-rose-100',   'text-rose-800',
  ],
};
