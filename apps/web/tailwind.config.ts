import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Elevação temática (clara/escura) via CSS vars — dá affordance aos cards.
        card: 'var(--ss-shadow)',
        'card-elev': 'var(--ss-shadow-elev)',
      },
      colors: {
        // Tokens semânticos do sistema de tema (claro/escuro via CSS vars).
        // Trocam de valor conforme a classe `.dark` no <html>.
        bg: 'var(--ss-bg)',
        card: 'var(--ss-card)',
        'card-2': 'var(--ss-card-2)',
        ink: 'var(--ss-ink)',
        muted: 'var(--ss-muted)',
        'muted-2': 'var(--ss-muted-2)',
        line: 'var(--ss-line)',
        accent: 'var(--ss-accent)',
        'accent-soft': 'var(--ss-accent-soft)',
        'accent-ink': 'var(--ss-accent-ink)',
        contrast: 'var(--ss-contrast)',
        'contrast-ink': 'var(--ss-contrast-ink)',
        positive: 'var(--ss-positive)',
        // Paleta legada — mantida durante a migração das telas internas.
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0369a1',
          700: '#075985',
          900: '#0c4a6e',
        },
        surface: {
          diagnostic: '#0a0e1a',
          operation: '#eef6fc',
        },
      },
    },
  },
  plugins: [],
}

export default config
