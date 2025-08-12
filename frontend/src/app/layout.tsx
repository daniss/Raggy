import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Assistants RAG privés pour vos documents | Raggy',
  description: 'Assistant RAG privé pour vos documents. Ingestion multi-format, citations fiables, démo sandbox, déploiement sécurisé (FastAPI + pgvector). DPA disponible.',
  keywords: ['RAG', 'assistant IA privé', 'développement RAG', 'ingestion documents', 'citations sources', 'PDF DOCX', 'déploiement sécurisé', 'PME France', 'FastAPI', 'pgvector', 'DPA', 'RGPD'],
  authors: [{ name: 'Raggy Solutions' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'Assistants RAG privés pour vos documents | Raggy',
    description: 'Ingestion robuste. Citations fiables. Déploiement sécurisé. Démo prête. Nous développons des assistants RAG personnalisés pour les entreprises françaises.',
    siteName: 'Raggy',
    images: [
      {
        url: '/og/landing.png',
        width: 1200,
        height: 630,
        alt: 'Raggy - Assistants RAG privés pour vos documents'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Assistants RAG privés pour vos documents | Raggy',
    description: 'Ingestion robuste. Citations fiables. Déploiement sécurisé. Démo prête.',
    images: ['/og/landing.png']
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
        'min-h-screen bg-background font-sans antialiased transition-colors duration-300',
        inter.className
      )}>
        <div className="relative min-h-screen">
          <ThemeProvider>
            <AuthProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </AuthProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}