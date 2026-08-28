import type { DadosCliente } from './repositorio'

function campo(formData: FormData, nome: string): string {
  return String(formData.get(nome) ?? '').trim()
}

/** FormData -> DadosCliente. Nao valida: quem valida e a action (nome obrigatorio). */
export function lerFormularioCliente(formData: FormData): DadosCliente {
  return {
    nome: campo(formData, 'nome'),
    apelido: campo(formData, 'apelido'),
    documento: campo(formData, 'documento'),
    email: campo(formData, 'email'),
    contato: campo(formData, 'contato'),
    endereco: campo(formData, 'endereco'),
    bairro: campo(formData, 'bairro'),
    cidade: campo(formData, 'cidade'),
    uf: campo(formData, 'uf'),
    cep: campo(formData, 'cep'),
    observacoes: campo(formData, 'observacoes'),
    telefones: ['telefone1', 'telefone2', 'telefone3'].map((n) => campo(formData, n)).filter((t) => t !== ''),
  }
}
