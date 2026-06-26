/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', '"Poke-GB"', 'monospace'],
      },
      colors: {
        poke: {
          red: '#ee1515',
          darkred: '#cc0000',
          blue: '#3b4cca',
          yellow: '#ffde00',
          gold: '#b3a125',
        },
      },
      boxShadow: {
        gb: '4px 4px 0 0 rgba(0,0,0,0.25)',
        gbsm: '2px 2px 0 0 rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
