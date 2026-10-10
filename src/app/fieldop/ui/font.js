import { IBM_Plex_Sans } from 'next/font/google'

// IBM Plex Sans: engineering roots, clear at small sizes, tabular figures for quantities.
export const plex = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--fo-font',
})
