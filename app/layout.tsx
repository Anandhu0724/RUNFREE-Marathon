import 'leaflet/dist/leaflet.css'
import type { Metadata, Viewport } from 'next'
import PWAInstall from '@/components/pwa-install'
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
  icons: {
    icon: [
      {
        url: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RUN FREE',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0e1250',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RUN FREE" />
      </head>
      <body className="antialiased">
        <PWAInstall />
        {children}
      </body>
    </html>
  )
}
