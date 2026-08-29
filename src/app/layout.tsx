import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { lerTemaDoCookie } from '@/infra/tema/cookie'
import { atributoDoTema } from '@/infra/tema/preferencia'
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

/**
 * Roda antes da primeira pintura, so quando a preferencia e "Sistema" — nesse
 * caso o servidor nao tem como saber o tema do Windows de quem abriu, e escrever
 * o atributo errado significaria a tela piscar branco antes de escurecer.
 *
 * Fica em `<body>` e e sincrono de proposito: bloqueia a analise do resto do
 * documento, entao o atributo ja esta la quando o navegador pinta.
 */
const SCRIPT_TEMA_DO_SISTEMA = `(function(){try{var c=matchMedia('(prefers-color-scheme: dark)'),a=function(){document.documentElement.setAttribute('data-bs-theme',c.matches?'dark':'light')};a();c.addEventListener('change',a)}catch(e){}})()`

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  const atributo = atributoDoTema(await lerTemaDoCookie())

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-bs-theme={atributo ?? undefined}
      // O script abaixo escreve `data-bs-theme` antes da hidratacao, entao o
      // <html> que o React renderizou de proposito nao bate com o que esta na
      // tela. E o caso exato para o qual isto existe.
      suppressHydrationWarning
    >
      <body>
        {atributo === null ? <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_DO_SISTEMA }} /> : null}
        {children}
      </body>
    </html>
  )
}
