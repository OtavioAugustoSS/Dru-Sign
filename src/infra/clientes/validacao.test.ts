import { describe, it, expect } from 'vitest'
import { validarDadosCliente } from './validacao'

const ok = { nome: 'Bretas', telefones: ['(38) 99968-1168'] }

describe('validarDadosCliente', () => {
  it('aceita dados dentro dos limites', () => {
    expect(validarDadosCliente({ ...ok, documento: '39.346.861/0286-86', uf: 'mg', cep: '38610-000' })).toBeNull()
  })

  it.each([
    [{ ...ok, nome: '  ' }, /obrigatório/],
    [{ ...ok, cep: '38.610-000' }, /CEP deve ter até 9/],
    [{ ...ok, nome: 'x'.repeat(121) }, /Nome deve ter até 120/],
    [{ ...ok, uf: 'MGX' }, /UF deve ter 2 letras/],
    [{ ...ok, documento: '123.456.789-0' }, /11 dígitos/],
    [{ ...ok, telefones: ['(38) 9 9999-9999 ramal 12'] }, /Telefone deve ter até 20/],
  ])('recusa %o', (dados, mensagem) => {
    expect(validarDadosCliente(dados)).toMatch(mensagem)
  })
})
