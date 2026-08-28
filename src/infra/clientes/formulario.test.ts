import { describe, it, expect } from 'vitest'
import { lerFormularioCliente } from './formulario'

function form(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('lerFormularioCliente', () => {
  it('le os campos e junta os tres telefones, ignorando vazios', () => {
    const dados = lerFormularioCliente(form({
      nome: '  Cencosud Brasil Comercial ', apelido: 'Bretas', documento: '39.346.861/0286-86',
      telefone1: '', telefone2: '(38)9968-1168', telefone3: '  ', email: 'obra@x.com', uf: 'mg',
    }))
    expect(dados.nome).toBe('Cencosud Brasil Comercial')
    expect(dados.apelido).toBe('Bretas')
    expect(dados.documento).toBe('39.346.861/0286-86')
    expect(dados.telefones).toEqual(['(38)9968-1168'])
    expect(dados.uf).toBe('mg')
    expect(dados.contato).toBe('')
  })

  it('nome ausente vira string vazia (a action rejeita)', () => {
    expect(lerFormularioCliente(form({})).nome).toBe('')
  })
})
