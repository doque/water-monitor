import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

// Force dynamic rendering for the entire app
export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = {
  title: "BFV Miesbach-Tegernsee Monitor",
  description: "Überwachung von Wasserständen, Temperaturen und Abflussraten bayerischer Flüsse",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "BFV Miesbach-Tegernsee Gewässer-Monitor",
    description:
      "Echtzeit-Überwachung von Wasserständen, Temperaturen und Abflussraten der Flüsse im Landkreis Miesbach-Tegernsee",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BFV Miesbach-Tegernsee Gewässer-Monitor",
    description:
      "Echtzeit-Überwachung von Wasserständen, Temperaturen und Abflussraten der Flüsse im Landkreis Miesbach-Tegernsee",
  },
  metadataBase: new URL("https://whatsapp-water-alerts.vercel.app"),
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
