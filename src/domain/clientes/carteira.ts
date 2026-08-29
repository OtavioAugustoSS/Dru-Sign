import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'

/**
 * Ativo, adormecido e perdido, medidos no ORDEM.DBF do legado: dos 3.153 clientes com ordem,
 * 131 compraram nos ultimos 6 meses, 66 entre 6 e 12, 188 entre 1 e 2 anos e 2.768 ha mais de
 * dois. A faixa adormecida da 254 nomes — uma lista que cabe num dia de telefonemas.
 */
export type Recencia = 'ativo' | 'adormecido' | 'perdido'

export const ROTULO_RECENCIA: Record<Recencia, string> = { ativo: 'Ativo', adormecido: 'Adormecido', perdido: 'Perdido' }

const MES_MS = 30 * 86_400_000
const MESES_ATIVO = 6
const MESES_PERDIDO = 24

/** Uma linha por cadastro, com ordens e faturamento ja somados pela infra. */
export interface LinhaCarteira {
  id: string
  nome: string
  apelido: string | null
  /** So digitos: 11 (CPF) ou 14 (CNPJ); null quando nao informado. */
  documento: string | null
  ordens: number
  faturado: string
  /** ISO da ordem mais recente; null quando o cliente nunca comprou. */
  ultimaOrdemEm: string | null
}

export interface GrupoCarteira {
  /** null quando o cadastro nao tem documento: cada um e seu proprio grupo. */
  documento: string | null
  /** O nome do cadastro que mais faturou no grupo. */
  nome: string
  apelido: string | null
  /** Quantos cadastros o grupo reune. A Prefeitura de Unai sao 18, um por secretaria. */
  cadastros: number
  clienteIds: string[]
  ordens: number
  faturado: string
  /** Fatia do faturamento total, uma casa decimal. */
  fatiaPct: string
  ultimaOrdemEm: string
  recencia: Recencia
}

export interface Carteira {
  /** Do maior faturamento para o menor. Cliente que nunca comprou fica de fora. */
  grupos: GrupoCarteira[]
  faturadoTotal: string
  contagem: Record<Recencia, number>
  /** So a faixa adormecida: quem some ha mais de dois anos nao e campanha, e cauda morta. */
  paraReativar: GrupoCarteira[]
}

function recenciaDe(ultima: string, agora: Date): Recencia {
  const meses = (agora.getTime() - new Date(ultima).getTime()) / MES_MS
  if (meses <= MESES_ATIVO) return 'ativo'
  return meses <= MESES_PERDIDO ? 'adormecido' : 'perdido'
}

/**
 * Agrupar por documento e o que revela o maior cliente da empresa (spec, secao 4): a Prefeitura
 * de Unai existe em 18 cadastros sob o mesmo CNPJ porque cada secretaria tem empenho separado.
 */
export function agruparPorDocumento(linhas: LinhaCarteira[], agora: Date): Carteira {
  const comOrdem = linhas.filter((l) => l.ordens > 0 && l.ultimaOrdemEm !== null)

  // Chave por documento; sem documento, o proprio id — nunca juntar dois anonimos.
  const porChave = new Map<string, LinhaCarteira[]>()
  for (const l of comOrdem) {
    const chave = l.documento ?? `id:${l.id}`
    const lista = porChave.get(chave)
    if (lista) lista.push(l)
    else porChave.set(chave, [l])
  }

  let faturadoTotal = dinheiro(0)
  const grupos: GrupoCarteira[] = []
  for (const lista of porChave.values()) {
    const porFaturado = [...lista].sort((a, b) => dinheiro(b.faturado).comparedTo(dinheiro(a.faturado)))
    const principal = porFaturado[0] as LinhaCarteira
    const faturado = lista.reduce((s, l) => s.plus(dinheiro(l.faturado)), dinheiro(0))
    const ultimaOrdemEm = lista.reduce((maior, l) => ((l.ultimaOrdemEm as string) > maior ? (l.ultimaOrdemEm as string) : maior), lista[0]?.ultimaOrdemEm as string)
    faturadoTotal = faturadoTotal.plus(faturado)
    grupos.push({
      documento: principal.documento,
      nome: principal.nome,
      apelido: principal.apelido,
      cadastros: lista.length,
      clienteIds: lista.map((l) => l.id),
      ordens: lista.reduce((s, l) => s + l.ordens, 0),
      faturado: arredondarCentavos(faturado).toFixed(2),
      fatiaPct: '0.0', // preenchido abaixo, quando o total existe
      ultimaOrdemEm,
      recencia: recenciaDe(ultimaOrdemEm, agora),
    })
  }

  grupos.sort((a, b) => dinheiro(b.faturado).comparedTo(dinheiro(a.faturado)))
  const total = arredondarCentavos(faturadoTotal)
  for (const g of grupos) {
    g.fatiaPct = total.isZero() ? '0.0' : dinheiro(g.faturado).dividedBy(total).times(100).toFixed(1)
  }

  const contagem: Record<Recencia, number> = { ativo: 0, adormecido: 0, perdido: 0 }
  for (const g of grupos) contagem[g.recencia] += 1

  return {
    grupos,
    faturadoTotal: total.toFixed(2),
    contagem,
    paraReativar: grupos.filter((g) => g.recencia === 'adormecido'),
  }
}
