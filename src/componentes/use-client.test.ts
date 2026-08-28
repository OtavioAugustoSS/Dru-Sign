import { describe, expect, it } from 'vitest'
import { globSync, readFileSync } from 'node:fs'

describe('react-bootstrap so em Client Components', () => {
  it("todo arquivo que importa react-bootstrap comeca com 'use client'", () => {
    const arquivos = globSync('src/**/*.{ts,tsx}').filter((f) => !f.includes('generated'))
    const ofensores = arquivos.filter((f) => {
      const src = readFileSync(f, 'utf8')
      return /from\s+['"]react-bootstrap/.test(src) && !/^['"]use client['"]/.test(src)
    })
    expect(ofensores).toEqual([])
  })
})
