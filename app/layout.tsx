import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

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
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BFV Miesbach-Tegernsee Gewässer-Monitor",
      },
    ],
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BFV Miesbach-Tegernsee Gewässer-Monitor",
    description:
      "Echtzeit-Überwachung von Wasserständen, Temperaturen und Abflussraten der Flüsse im Landkreis Miesbach-Tegernsee",
    images: ["/images/og-image.png"],
  },
  metadataBase: new URL("https://whatsapp-water-alerts.vercel.app"),
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
