import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
// Fixed import path to use existing AppProvider
import { AppProvider } from "@/contexts/app-context"

// Simplified font configuration to avoid build issues
const fontClass = "font-sans"

export const metadata: Metadata = {
  title: "Assistant IA Privé - RAG SaaS",
  description: "Plateforme d'assistant IA privé pour vos documents",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${fontClass} antialiased`} suppressHydrationWarning={true}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AppProvider>
            {children}
            <div id="portal-root" />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
