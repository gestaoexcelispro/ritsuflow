'use client'

import { useEffect } from 'react'

export default function RitsuCadLogoBridge() {
  useEffect(() => {
    const applyHeaderLogo = () => {
      const header = document.querySelector('[class*="applicationHeader"]')

      if (!header) return

      const images = header.querySelectorAll('img')

      images.forEach((image) => {
        const alt = (image.getAttribute('alt') || '').toLowerCase()
        const src = image.getAttribute('src') || ''

        if (alt.includes('ritsuflow') || src.endsWith('/logo.png')) {
          if (image.getAttribute('src') !== '/logo-white.png') {
            image.setAttribute('src', '/logo-white.png')
          }
        }
      })
    }

    applyHeaderLogo()

    const observer = new MutationObserver(applyHeaderLogo)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return null
}
