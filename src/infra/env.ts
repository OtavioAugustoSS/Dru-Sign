/**
 * Variaveis de ambiente do DruSign.
 * Sem zod: validacao manual, um unico erro listando tudo que falta.
 * Avaliacao lazy (env()) para nao estourar durante `next build`, onde nao ha banco.
 */

export type Ambiente = 'development' | 'production' | 'test'

export interface Env {
  readonly NODE_ENV: Ambiente
  /** Conexao usada pelo PrismaClient em runtime (na Neon, host com -pooler). */
  readonly DATABASE_URL: string
  /** Conexao direta usada so pelo Prisma CLI (migrate). Opcional em runtime. */
  readonly DIRECT_URL: string | undefined
  /**
   * Teto do pool de conexoes do adapter pg. Ausente = padrao do pg (10).
   * Existe por causa do `prisma dev` local (PGlite), que aceita poucas conexoes simultaneas.
   */
  readonly DATABASE_POOL_MAX: number | undefined
}

const AMBIENTES: readonly string[] = ['development', 'production', 'test']

function ehUrlPostgres(v: string): boolean {
  return /^postgres(ql)?:\/\/.+/.test(v)
}

export function validarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const erros: string[] = []

  const nodeEnvBruto = fonte.NODE_ENV ?? 'development'
  const nodeEnvValido = AMBIENTES.includes(nodeEnvBruto)
  if (!nodeEnvValido) {
    erros.push(`NODE_ENV invalido: "${nodeEnvBruto}" (use development, production ou test)`)
  }
  const NODE_ENV = (nodeEnvValido ? nodeEnvBruto : 'development') as Ambiente

  const DATABASE_URL = fonte.DATABASE_URL ?? ''
  if (DATABASE_URL === '') erros.push('DATABASE_URL ausente')
  else if (!ehUrlPostgres(DATABASE_URL)) erros.push('DATABASE_URL nao e uma URL postgresql://')

  const DIRECT_URL = fonte.DIRECT_URL || undefined
  if (DIRECT_URL !== undefined && !ehUrlPostgres(DIRECT_URL)) {
    erros.push('DIRECT_URL nao e uma URL postgresql://')
  }

  const poolBruto = fonte.DATABASE_POOL_MAX || undefined
  let DATABASE_POOL_MAX: number | undefined
  if (poolBruto !== undefined) {
    if (!/^[1-9]\d*$/.test(poolBruto)) erros.push(`DATABASE_POOL_MAX invalido: "${poolBruto}" (inteiro maior que zero)`)
    else DATABASE_POOL_MAX = Number(poolBruto)
  }

  if (erros.length > 0) {
    throw new Error(
      `Configuracao de ambiente invalida:\n  - ${erros.join('\n  - ')}\n` +
        'Veja .env.example para o formato esperado.',
    )
  }

  return Object.freeze({ NODE_ENV, DATABASE_URL, DIRECT_URL, DATABASE_POOL_MAX })
}

let cache: Env | undefined

/** Lazy e memoizado: lanca na primeira leitura se faltar algo. */
export function env(): Env {
  if (!cache) cache = validarEnv()
  return cache
}
