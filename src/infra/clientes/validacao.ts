import type { DadosCliente } from './repositorio'
import { normalizarDocumento } from '@/domain/clientes/documento'

/** Limites do schema (prisma/schema.prisma, Cliente e TelefoneCliente). O banco recusaria; aqui avisamos antes. */
export const LIMITES_CLIENTE = {
  nome: 120, apelido: 60, email: 120, contato: 80, endereco: 160, bairro: 60, cidade: 60, uf: 2, cep: 9, telefone: 20,
} as const

const ROTULOS = {
  nome: 'Nome', apelido: 'Apelido', email: 'E-mail', contato: 'Contato', endereco: 'Endereço',
  bairro: 'Bairro', cidade: 'Cidade', uf: 'UF', cep: 'CEP',
} as const

/** Primeira mensagem de erro, ou null quando os dados podem ser gravados. */
export function validarDadosCliente(dados: DadosCliente): string | null {
  if (dados.nome.trim() === '') return 'O nome é obrigatório.'

  for (const campo of Object.keys(ROTULOS) as Array<keyof typeof ROTULOS>) {
    if (campo === 'uf') continue // a UF tem regra propria abaixo (2 letras)
    const valor = (dados[campo] ?? '').trim()
    const limite = LIMITES_CLIENTE[campo]
    if (valor.length > limite) return `${ROTULOS[campo]} deve ter até ${limite} caracteres.`
  }

  const uf = (dados.uf ?? '').trim()
  if (uf !== '' && !/^[A-Za-z]{2}$/.test(uf)) return 'UF deve ter 2 letras.'

  const documento = (dados.documento ?? '').trim()
  if (documento !== '' && normalizarDocumento(documento) === null) {
    return 'Documento deve ter 11 dígitos (CPF) ou 14 (CNPJ).'
  }

  for (const telefone of dados.telefones) {
    if (telefone.trim().length > LIMITES_CLIENTE.telefone) {
      return `Telefone deve ter até ${LIMITES_CLIENTE.telefone} caracteres.`
    }
  }

  return null
}
