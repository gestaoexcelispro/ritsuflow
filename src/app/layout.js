import './globals.css'
import { LanguageProvider } from '../contexts/LanguageContext'
import LocaleDocumentSync from '../components/i18n/LocaleDocumentSync'

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
        <LanguageProvider>
          <LocaleDocumentSync />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
