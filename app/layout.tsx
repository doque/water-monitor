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
    apple: "/apple-touch-icon.png", // Apple touch icon
  },
  manifest: "/site.webmanifest", // Link to the web app manifest
  openGraph: {
    title: "BFV Miesbach-Tegernsee Gewässer-Monitor",
    description:
      "Echtzeit-Überwachung von Wasserständen, Temperaturen und Abflussraten der Flüsse im Landkreis Miesbach-Tegernsee",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "/images/mbteg-logo-256.png",
        width: 256,
        height: 208,
        alt: "BFV Miesbach-Tegernsee Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "BFV Miesbach-Tegernsee Gewässer-Monitor",
    description:
      "Echtzeit-Überwachung von Wasserständen, Temperaturen und Abflussraten der Flüsse im Landkreis Miesbach-Tegernsee",
    images: ["/images/mbteg-logo.png"],
  },
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
        {/* PWA Meta Tags for Apple */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Gewässer-Monitor" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Dynamic Theme Colors for PWA */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
