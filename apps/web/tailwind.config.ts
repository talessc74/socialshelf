import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Display da nova entrada /dashboard (BDR-010, seção redesign).
        cinzel: ['var(--font-cinzel)', 'Georgia', 'serif'],
        condensed: ['var(--font-condensed)', 'system-ui', 'sans-serif'],
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
        'accent-text': 'var(--ss-accent-text)',
        contrast: 'var(--ss-contrast)',
        'contrast-ink': 'var(--ss-contrast-ink)',
        positive: 'var(--ss-positive)',
        // Paleta legada — mantida durante a migração das telas internas.
        brand: {
          50: '#f5f9fa',
          100: '#ddf0f8',
          200: '#b3dcea',
          300: '#44a9c1',
          400: '#39a3cc',
          500: '#347aae',
          600: '#1c426d',
          700: '#153352',
          900: '#0c1e33',
        },
        surface: {
          diagnostic: '#0b0e14',
          operation: '#ebedf1',
        },
      },
    },
  },
  plugins: [],
}

export default config
