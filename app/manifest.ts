import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RUN FREE 2027 — Against Substance Abuse',
    short_name: 'RUN FREE',
    description: 'Join the RUN FREE 5 km community marathon against substance abuse.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0e1250',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
    categories: ['sports', 'health'],
  }
}
