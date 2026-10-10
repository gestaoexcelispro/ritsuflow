import { IBM_Plex_Sans, Manrope } from 'next/font/google'
import PrivacyPolicy from './PrivacyPolicy'

const display = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display', display: 'swap' })
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-body', display: 'swap' })

export const metadata = {
  title: 'Privacy policy',
  description: 'How ExcelisPro handles the personal data collected on the RitsuFlow website (LGPD).',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <PrivacyPolicy />
    </div>
  )
}
