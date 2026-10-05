import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'

export const metadata = {
  title: {
    default: 'RitsuFlow',
    template: '%s | RitsuFlow',
  },
  description:
    'Location-based construction planning and flow control software.',
  applicationName: 'RitsuFlow',
  keywords: [
    'location-based planning',
    'construction planning',
    'flow control',
    'lean construction',
    'master planning',
    'lookahead planning',
    'weekly planning',
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-US">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
