import { describe, expect, it } from 'vitest'
import { hashSenha, verificarSenha, hashDummy } from './senha'

describe('senha (argon2id real, sem mock)', () => {
  it('gera hash PHC argon2id com os parametros OWASP e verifica a senha correta', async () => {
    const h = await hashSenha('Segredo!2026')
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    expect(await verificarSenha(h, 'Segredo!2026')).toBe(true)
  })

  it('rejeita senha errada', async () => {
    const h = await hashSenha('Segredo!2026')
    expect(await verificarSenha(h, 'segredo!2026')).toBe(false)
  })

  it('dois hashes da mesma senha sao diferentes (salt) e ambos verificam', async () => {
    const [a, b] = await Promise.all([hashSenha('x'), hashSenha('x')])
    expect(a).not.toBe(b)
    expect(await verificarSenha(a, 'x')).toBe(true)
    expect(await verificarSenha(b, 'x')).toBe(true)
  })

  it('hash invalido devolve false em vez de lancar', async () => {
    expect(await verificarSenha('nao-e-um-hash', 'x')).toBe(false)
  })

  it('senha vazia e recusada no hash', async () => {
    await expect(hashSenha('')).rejects.toThrow('senha vazia')
  })

  it('o hash dummy e um argon2id valido e nao confere com uma senha qualquer', async () => {
    const h = await hashDummy()
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    expect(await verificarSenha(h, 'qualquer-coisa')).toBe(false)
    expect(await hashDummy()).toBe(h) // memoizado
  })
})
