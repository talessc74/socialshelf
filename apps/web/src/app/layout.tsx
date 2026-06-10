import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '../components/Providers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SocialShelf',
  description: 'Publicação social para criadores de conteúdo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
