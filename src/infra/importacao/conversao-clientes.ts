import type { RegistroDbf } from './dbf'
import type { DadosCliente } from '@/infra/clientes/repositorio'

/** Modulo puro (sem Prisma): testavel sem banco e importavel de qualquer lugar. */

export interface ClienteLegado {
  codigoLegado: number
  apagado: boolean
  cadastradoEm: Date | null
  dados: DadosCliente
  /** Entradas de telefone com menos de 8 digitos, que nao valem guardar. */
  descartados: number
}

const COLUNAS_TELEFONE = [
  'TEL1', 'TEL2', 'TEL3', 'CEL', 'FAX',
  'TELEFONE1', 'CELULAR1', 'TELEFONE2', 'CELULAR2', 'TELEFONE3', 'CELULAR3', 'TELEFONE4', 'CELULAR4',
]

function texto(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function ouNulo(v: string): string | null {
  return v === '' ? null : v
}

function data(v: string): Date | null {
  if (!/^\d{8}$/.test(v)) return null
  const ano = Number(v.slice(0, 4))
  const mes = Number(v.slice(4, 6))
  const dia = Number(v.slice(6, 8))
  if (ano < 1990 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  // 30 de fevereiro "rola" para marco no Date; a spec registra datas absurdas na base — nao aceitar.
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia || d.getTime() > Date.now()) return null
  return d
}

/** Um registro do CLIENTES.DBF vira os dados de um cliente novo. */
export function converterRegistro(r: RegistroDbf): ClienteLegado {
  const v = r.valores
  const codigoLegado = Number(v.COD ?? 0)
  const nome = texto(v.NOM) || `(sem nome no legado, cod ${codigoLegado})`

  const telefones: string[] = []
  let descartados = 0
  for (const coluna of COLUNAS_TELEFONE) {
    const original = texto(v[coluna])
    const digitos = original.replace(/\D/g, '')
    if (digitos.length === 0) continue
    if (digitos.length < 8) {
      descartados++
      continue
    }
    if (!telefones.includes(original)) telefones.push(original)
  }

  const endereco = [texto(v.RUA), texto(v.CPL)].filter((x) => x !== '').join(', ')
  const observacoes = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => texto(v[`OBS${n}`]))
    .filter((x) => x !== '')
    .join('\n')

  return {
    codigoLegado,
    apagado: r.apagado,
    cadastradoEm: data(texto(v.DATA)),
    descartados,
    dados: {
      nome,
      apelido: ouNulo(texto(v.EST)),
      documento: ouNulo(texto(v.CGC) || texto(v.CPF)),
      email: ouNulo(texto(v.EMAIL) || texto(v.EMAIL1)),
      contato: ouNulo(texto(v.CTO) || texto(v.CONTATO1)),
      endereco: ouNulo(endereco),
      bairro: ouNulo(texto(v.BAI)),
      cidade: ouNulo(texto(v.CID)),
      uf: ouNulo(texto(v.UF)),
      cep: ouNulo(texto(v.CEP)),
      observacoes: ouNulo(observacoes),
      telefones,
    },
  }
}
