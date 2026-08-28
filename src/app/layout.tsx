import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
