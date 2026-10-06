import { IBM_Plex_Sans, Manrope } from 'next/font/google'
import Landing from './_landing/Landing'

const display = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' })
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' })

const description =
  'RitsuFlow connects quantity takeoff, estimating (BDI and markups), Lean planning and field control for construction teams. V1 trial opens November 2026.'

export const metadata = {
  title: { absolute: 'RitsuFlow™ | From takeoff to the field' },
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'RitsuFlow',
    title: 'RitsuFlow™ — From takeoff to the field. One continuous flow.',
    description,
    locale: 'en_US',
    alternateLocale: ['pt_BR', 'es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RitsuFlow™ — From takeoff to the field.',
    description,
  },
}

export default function HomePage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <Landing />
    </div>
  )
}
