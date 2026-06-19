import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf0f7',
          100: '#fbe2ef',
          200: '#f6b8da',
          300: '#f08dc3',
          500: '#e91e8c',
          600: '#c91577',
          700: '#a10f5f',
          900: '#5c0936',
        },
        surface: {
          diagnostic: '#15101c',
          operation: '#fbf7f2',
        },
      },
    },
  },
  plugins: [],
}

export default config
