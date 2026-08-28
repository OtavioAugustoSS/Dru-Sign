import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@tabler/core/dist/css/tabler.min.css'
import './tema.css'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
