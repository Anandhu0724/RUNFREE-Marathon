import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RUN FREE 2027 — Against Substance Abuse',
    short_name: 'RUN FREE',
    description: 'Join the RUN FREE 5 km community marathon against substance abuse.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e1250',
    theme_color: '#0e1250',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
