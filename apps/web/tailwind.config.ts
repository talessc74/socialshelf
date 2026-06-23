import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          500: '#eab308',
          600: '#a16207',
          700: '#854d0e',
          900: '#713f12',
        },
        surface: {
          diagnostic: '#15140f',
          operation: '#f7f2e7',
        },
      },
    },
  },
  plugins: [],
}

export default config
