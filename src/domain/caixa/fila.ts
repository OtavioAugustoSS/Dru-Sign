import { dinheiro } from '../precificacao/dinheiro'
import type { EstadoProducao } from '../ordem/estados'
import { resumirPagamento } from './pagamento'

/** Serializavel: e o que a infra monta com um groupBy de recebimentos e a tela recebe pronto. */
export interface OrdemDaFila {
  id: string
  numero: number
  clienteNome: string | null
  clienteApelido: string | null
  estadoProducao: EstadoProducao
  abertaEm: string
  concluidaEm: string | null
  prometidaPara: string | null
  precoFinal: string
  totalRecebido: string
}

export interface Fila {
  /** Abertas ha mais de `diasParada` dias, a mais antiga primeiro. */
  paradas: OrdemDaFila[]
  /** Concluidas e nao pagas, a concluida ha mais tempo primeiro, com o saldo de cada uma. */
  aCobrar: Array<OrdemDaFila & { saldo: string }>
  totalACobrar: string
}

const DIA_MS = 86_400_000

/** A tela inicial (spec, tela 1): duas listas, o total somado, nada de grafico. */
export function classificarFila(ordens: OrdemDaFila[], agora: Date, diasParada = 7): Fila {
  const limite = agora.getTime() - diasParada * DIA_MS
  const paradas = ordens
    .filter((o) => o.estadoProducao === 'aberta' && new Date(o.abertaEm).getTime() < limite)
    .sort((a, b) => a.abertaEm.localeCompare(b.abertaEm))

  const aCobrar = ordens
    .filter((o) => o.estadoProducao === 'concluida')
    .map((o) => ({ o, resumo: resumirPagamento(o.precoFinal, [o.totalRecebido]) }))
    .filter(({ resumo }) => resumo.estado !== 'pago')
    .sort((a, b) => (a.o.concluidaEm ?? '').localeCompare(b.o.concluidaEm ?? ''))
    .map(({ o, resumo }) => ({ ...o, saldo: resumo.saldo.toFixed(2) }))

  const totalACobrar = aCobrar.reduce((s, o) => s.plus(dinheiro(o.saldo)), dinheiro(0)).toFixed(2)
  return { paradas, aCobrar, totalACobrar }
}
