/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stone: {
          100: '#f6efe3',
          200: '#eadbc4',
          300: '#d8c0a0',
          400: '#b49672',
          500: '#8f7051',
          600: '#73593f',
          700: '#5a4431',
          800: '#453324',
          900: '#35281d',
        },
        amber: {
          100: '#fff3db',
          200: '#f6e0b6',
          300: '#ebc98c',
          400: '#d9ad61',
          500: '#c99343',
          600: '#ab7935',
          700: '#8a5f2a',
        },
        surface: {
          950: '#2a2118',
          900: '#3b2e22',
          800: '#544131',
          700: '#6a503c',
        },
        accent: {
          500: '#b88a3b',
          400: '#c8a35b',
          300: '#e2c98e',
        },
      },
    },
  },
  plugins: [],
};
  