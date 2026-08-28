import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Pacotes e prefixos que o dominio nunca importa: framework, banco, infra do proprio repo e I/O do Node. */
const PROIBIDOS = [
  'next', 'react', 'server-only', '@prisma/client', '@/generated', '@/infra', '@/app', '@/componentes',
  'node:', 'fs', 'path', 'child_process', 'http', 'https', 'net', 'crypto', 'os', 'process',
]

/** Qualquer forma de importar: `from '...'`, `import '...'`, `import('...')`, `require('...')`. */
const ESPECIFICADOR = /(?:\bfrom\s*|^\s*import\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/gm

/** Caminho relativo que sai do dominio e entra em infra/, generated/, app/ ou componentes/. */
const RELATIVO_PROIBIDO = /^\.{1,2}\/(?:\.\.\/)*(?:src\/)?(?:infra|generated|app|componentes)(?:\/|$)/

export function especificadorProibido(spec: string): boolean {
  if (RELATIVO_PROIBIDO.test(spec)) return true
  return PROIBIDOS.some((p) => (p.endsWith(':') ? spec.startsWith(p) : spec === p || spec.startsWith(`${p}/`)))
}

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivosDe(p)
    const ehFonte = p.endsWith('.ts') || p.endsWith('.tsx')
    const ehTeste = p.endsWith('.test.ts') || p.endsWith('.test.tsx')
    return ehFonte && !ehTeste ? [p] : []
  })
}

describe('pureza do dominio', () => {
  it('nenhum modulo de dominio importa framework, banco, infra ou I/O, por nenhuma forma de import', () => {
    const violacoes: string[] = []
    for (const arq of arquivosDe(join(process.cwd(), 'src', 'domain'))) {
      const src = readFileSync(arq, 'utf-8')
      for (const m of src.matchAll(ESPECIFICADOR)) {
        const spec = m[1] ?? ''
        if (especificadorProibido(spec)) violacoes.push(`${arq} importa ${spec}`)
      }
    }
    expect(violacoes).toEqual([])
  })

  it.each([
    ['next/headers', true],
    ['react', true],
    ['@prisma/client', true],
    ['@/generated/prisma/client', true],
    ['@/infra/db/prisma', true],
    ['node:fs', true],
    ['fs', true],
    ['crypto', true],
    ['../infra/db/prisma', true],
    ['../../infra/db/prisma', true],
    ['./dinheiro', false],
    ['../precificacao/dinheiro', false],
    ['decimal.js', false],
    ['vitest', false],
  ])('%s proibido: %s', (spec, esperado) => {
    expect(especificadorProibido(spec)).toBe(esperado)
  })
})
