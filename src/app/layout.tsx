import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@tabler/core/dist/css/tabler.min.css'
import './tema.css'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

// O sistema tem UMA face, e ela e escura: nao ha preferencia a declarar nem a
// consultar. `colorScheme: 'dark'` avisa o navegador, e com isso campo de data,
// select e barra de rolagem ja nascem escuros -- sem ele ficavam brancos no meio
// da tela.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#111827',
}

/**
 * O tema escuro e o sistema, nao uma opcao.
 *
 * O atributo e fixo no <html>. Antes ele saía de um cookie com tres estados
 * (sistema/claro/escuro) e, quando a escolha era "sistema", um script sincrono no
 * <body> resolvia a preferencia do Windows antes da primeira pintura. Nada disso
 * existe mais: sem escolha nao ha o que resolver, entao caem juntos o script, o
 * cookie, a server action, o seletor no menu do usuario e o
 * `suppressHydrationWarning` que existia porque o script escrevia por cima do
 * que o React tinha renderizado.
 *
 * A folha impressa e a unica excecao, e ela se declara sozinha: o layout de
 * `(impresso)` poe `data-bs-theme="light"` no proprio <main>, porque papel e
 * branco com tinta preta em qualquer sistema.
 */
export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-bs-theme="dark"
      // O Tabler poe `scroll-behavior: smooth` no <html>. Sem este atributo o
      // Next avisa que a rolagem suave atrapalha a troca de rota: ao navegar,
      // em vez de comecar no topo, a pagina desliza ate la.
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  )
}
