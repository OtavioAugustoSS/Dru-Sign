import { describe, it, expect, beforeEach } from 'vitest'
import { bloqueadoAte, registrarFalha, registrarSucesso, _limparParaTestes } from './tentativas'

const T0 = 1_000_000

beforeEach(() => _limparParaTestes())

describe('limite de tentativas de login', () => {
  it('quatro erros nao bloqueiam; o quinto bloqueia por um minuto', () => {
    for (let i = 0; i < 4; i++) registrarFalha('odete', T0)
    expect(bloqueadoAte('odete', T0)).toBeNull()
    registrarFalha('odete', T0)
    expect(bloqueadoAte('odete', T0 + 59_000)).toBe(T0 + 60_000)
    expect(bloqueadoAte('odete', T0 + 60_000)).toBeNull()
  })

  it('sucesso zera a contagem', () => {
    for (let i = 0; i < 4; i++) registrarFalha('odete', T0)
    registrarSucesso('odete')
    registrarFalha('odete', T0)
    expect(bloqueadoAte('odete', T0)).toBeNull()
  })

  it('cada login tem a sua contagem', () => {
    for (let i = 0; i < 5; i++) registrarFalha('odete', T0)
    expect(bloqueadoAte('pedro', T0)).toBeNull()
  })
})
