import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '../components/Providers'
import { BuildBadge } from '../components/BuildBadge'

export const dynamic = 'force-dynamic'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'SocialShelf',
  description: 'Publicação social para criadores de conteúdo',
}

// Aplica o tema (claro/escuro) antes da primeira pintura para evitar flash.
// Segue a escolha salva pelo usuário ou, na ausência dela, a preferência do SO.
const themeBootScript = `
(function () {
  try {
    var pref = localStorage.getItem('ss-theme');
    var dark = pref === 'dark' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <BuildBadge />
      </body>
    </html>
  )
}
