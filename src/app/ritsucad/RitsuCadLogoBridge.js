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

        if (alt.includes('ritsuflow') || src.endsWith('/logo.png') || src.endsWith('/logo-white.png')) {
          if (image.getAttribute('src') !== '/logo-white.png') {
            image.setAttribute('src', '/logo-white.png')
          }

          image.style.display = 'block'
          image.style.width = 'auto'
          image.style.height = '30px'
          image.style.maxWidth = '150px'
          image.style.objectFit = 'contain'

          const container = image.closest('a')

          if (container) {
            container.style.display = 'inline-flex'
            container.style.alignItems = 'center'
            container.style.justifyContent = 'center'
            container.style.flex = '0 0 auto'
            container.style.height = '44px'
            container.style.padding = '0 4px'
            container.style.marginLeft = '4px'
            container.style.border = '0'
            container.style.borderRadius = '0'
            container.style.background = 'transparent'
            container.style.boxShadow = 'none'
            container.style.textDecoration = 'none'
            container.style.overflow = 'visible'
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
