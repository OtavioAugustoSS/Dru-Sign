import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@tabler/core/dist/css/tabler.min.css'
import './tema.css'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

// `colorScheme` avisa o navegador que as duas faces existem: sem isso ele pinta
// campo de data, select e barra de rolagem sempre no claro, e eles ficam brancos
// no meio da tela escura. `themeColor` e a cor da barra do navegador no celular.
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
