'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => undefined)
    }

    // Handle app installed
    if ('onappinstalled' in window) {
      window.addEventListener('appinstalled', () => {
        setIsInstalled(true)
        setShowBanner(false)
      })
    }

    // Handle before install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if app is already installed (PWA running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      setShowBanner(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setShowBanner(false)
      } else {
        setShowBanner(false)
      }

      setInstallPrompt(null)
    } catch {
      setShowBanner(false)
    }
  }

  if (!showBanner || isInstalled) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-green-400 p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-white font-semibold mb-1">Install RUN FREE App</p>
          <p className="text-white text-sm opacity-90">Install our app for offline access and a native experience</p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => setShowBanner(false)}
            className="px-4 py-2 text-white font-medium hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
