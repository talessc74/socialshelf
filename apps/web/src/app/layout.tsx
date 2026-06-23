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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <BuildBadge />
      </body>
    </html>
  )
}
