import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/infra/auth/constantes'

const ROTAS_PUBLICAS = ['/entrar']

/**
 * Verificacao OTIMISTA: so olha se o cookie existe, sem tocar no banco. Quem valida de
 * verdade e exigirUsuario() no layout. Por isso o proxy NAO redireciona /entrar para /
 * quando ha cookie: um cookie velho faria um loop. A pagina /entrar faz isso apos validar.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const temCookie = request.cookies.has(COOKIE_SESSAO)
  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (!temCookie && !ehPublica) {
    const url = new URL('/entrar', request.nextUrl)
    url.searchParams.set('proximo', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Tudo, exceto assets internos e arquivos estaticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)'],
}
