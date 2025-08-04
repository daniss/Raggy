import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Raggy - Assistant IA Privé pour Entreprises',
  description: 'Plateforme SaaS RAG - Chaque entreprise a son assistant IA privé alimenté par ses documents internes. Multi-tenant, sécurisé, collaboratif.',
  keywords: ['SaaS', 'RAG', 'IA', 'assistant privé', 'entreprise', 'multi-tenant', 'documents internes', 'PME', 'TPE', 'collaboration'],
  authors: [{ name: 'Raggy Team' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'Raggy - Assistant IA Privé pour Entreprises',
    description: 'Plateforme SaaS RAG - Un assistant IA privé pour chaque entreprise, alimenté par leurs documents internes',
    siteName: 'Raggy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Raggy - Assistant IA Privé pour Entreprises',
    description: 'Plateforme SaaS RAG - Un assistant IA privé pour chaque entreprise',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body className={cn(
        'min-h-screen bg-background font-sans antialiased',
        inter.className
      )}>
        <div className="relative flex min-h-screen flex-col">
          <div className="flex-1">
            <AuthProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </AuthProvider>
          </div>
        </div>
      </body>
    </html>
  )
}