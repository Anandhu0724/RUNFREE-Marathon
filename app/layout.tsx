import { Analytics } from '@vercel/analytics/next'
import 'leaflet/dist/leaflet.css'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RUN FREE 2027 — Against Substance Abuse',
  description: 'Join RUN FREE, a 5 km community run from Kuttikkanam Town to MBCCET on 12 January 2027. Run for a cause: say no to drugs, say yes to life.',
  applicationName: 'RUN FREE',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'RUN FREE 2027 — Against Substance Abuse',
    description: 'A community run from Kuttikkanam Town to MBCCET on 12 January 2027.',
    type: 'website',
  },
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0e1250',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
