import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PROIBIDOS = ['next', 'react', '@prisma/client', 'node:fs', 'node:http']

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivosDe(p)
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : []
  })
}

describe('pureza do dominio', () => {
  it('nenhum modulo de dominio importa framework ou I/O', () => {
    const violacoes: string[] = []
    for (const arq of arquivosDe(join(process.cwd(), 'src', 'domain'))) {
      const src = readFileSync(arq, 'utf-8')
      for (const p of PROIBIDOS) {
        if (new RegExp(`from\s+['"]${p.replace('/', '\/')}`).test(src)) {
          violacoes.push(`${arq} importa ${p}`)
        }
      }
    }
    expect(violacoes).toEqual([])
  })
})
