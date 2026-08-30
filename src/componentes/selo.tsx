import type { ReactNode } from 'react'
import { ROTULO_ESTADO, type EstadoPagamento, type EstadoProducao } from '@/domain/ordem/estados'
import { ROTULO_PAGAMENTO } from '@/domain/caixa/pagamento'
import { ROTULO_RECENCIA, type Recencia } from '@/domain/clientes/carteira'
import {
  ROTULO_TIPO_CONTA,
  ROTULO_TIPO_LANCAMENTO,
  type TipoConta,
  type TipoLancamento,
} from '@/domain/caixa/lancamento'
import { ROTULO_URGENCIA, type GrupoUrgencia } from '@/domain/producao/urgencia'

/**
 * O que a cor quer dizer, nao qual cor e. Assim a decisao "atrasado e vermelho"
 * fica num lugar so, e trocar a paleta nao exige caçar classe por tela.
 */
export type Tom = 'neutro' | 'marca' | 'bom' | 'atencao' | 'ruim'

const FUNDO: Record<Tom, string> = {
  neutro: 'bg-secondary-lt',
  marca: 'bg-primary-lt',
  bom: 'bg-success-lt',
  atencao: 'bg-warning-lt',
  ruim: 'bg-danger-lt',
}

/**
 * Para texto colorido fora de selo (titulo de grupo, valor de indicador).
 *
 * Usa as versoes `-emphasis` em verde, ambar e vermelho: as cores cheias existem
 * para preencher fundo, nao para escrever. `text-success` cheio da 2,74:1 sobre
 * branco, muito abaixo dos 4,5:1 de texto. Primaria e secundaria ja passam
 * inteiras, entao ficam como estao.
 */
export const TEXTO: Record<Tom, string> = {
  neutro: 'text-secondary',
  marca: 'text-primary',
  bom: 'text-success-emphasis',
  atencao: 'text-warning-emphasis',
  ruim: 'text-danger-emphasis',
}

// ---------------------------------------------------------------------------
// O significado de cada valor do dominio. Antes disto havia sete mapas
// espalhados por sete arquivos, com COR_PAGAMENTO duplicado byte a byte em dois
// deles e mais quatro decisoes tomadas por ternario dentro do JSX.
// ---------------------------------------------------------------------------

export const TOM_ESTADO: Record<EstadoProducao, Tom> = {
  orcamento: 'neutro',
  aberta: 'marca',
  concluida: 'bom',
  cancelada: 'ruim',
}

export const TOM_PAGAMENTO: Record<EstadoPagamento, Tom> = {
  nao_pago: 'ruim',
  parcial: 'atencao',
  pago: 'bom',
}

export const TOM_RECENCIA: Record<Recencia, Tom> = {
  ativo: 'bom',
  adormecido: 'atencao',
  perdido: 'neutro',
}

export const TOM_TIPO_LANCAMENTO: Record<TipoLancamento, Tom> = {
  entrada: 'bom',
  saida: 'ruim',
}

export const TOM_TIPO_CONTA: Record<TipoConta, Tom> = {
  receita: 'bom',
  despesa: 'ruim',
}

/**
 * Urgencia so aparece como cor de titulo de grupo, nunca como selo, entao tem
 * mapa proprio de classe de texto em vez de tom.
 *
 * "Esta semana" fica com a cor normal do corpo de proposito: se tudo tem cor,
 * nada tem. O que precisa saltar e o atrasado.
 */
export const TEXTO_URGENCIA: Record<GrupoUrgencia, string> = {
  atrasada: 'text-danger-emphasis',
  hoje: 'text-warning',
  semana: '',
  sem_data: 'text-secondary',
}

interface Props {
  tom: Tom
  children: ReactNode
  className?: string
  /** So onde o teste de ponta a ponta ja depende do valor. Nao inventar novos. */
  testId?: string
}

export function Selo({ tom, children, className, testId }: Props) {
  return (
    <span className={`badge ${FUNDO[tom]}${className ? ` ${className}` : ''}`} data-testid={testId}>
      {children}
    </span>
  )
}

// Atalhos: o chamador passa o valor do dominio e nao decide cor nem texto.

export function SeloEstado({ estado, className }: { estado: EstadoProducao; className?: string }) {
  return (
    <Selo tom={TOM_ESTADO[estado]} className={className}>
      {ROTULO_ESTADO[estado]}
    </Selo>
  )
}

export function SeloPagamento({ estado, className, testId }: { estado: EstadoPagamento; className?: string; testId?: string }) {
  return (
    <Selo tom={TOM_PAGAMENTO[estado]} className={className} testId={testId}>
      {ROTULO_PAGAMENTO[estado]}
    </Selo>
  )
}

export function SeloRecencia({ recencia, className }: { recencia: Recencia; className?: string }) {
  return (
    <Selo tom={TOM_RECENCIA[recencia]} className={className}>
      {ROTULO_RECENCIA[recencia]}
    </Selo>
  )
}

export function SeloTipoLancamento({ tipo, className }: { tipo: TipoLancamento; className?: string }) {
  return (
    <Selo tom={TOM_TIPO_LANCAMENTO[tipo]} className={className}>
      {ROTULO_TIPO_LANCAMENTO[tipo]}
    </Selo>
  )
}

export function SeloTipoConta({ tipo, className }: { tipo: TipoConta; className?: string }) {
  return (
    <Selo tom={TOM_TIPO_CONTA[tipo]} className={className}>
      {ROTULO_TIPO_CONTA[tipo]}
    </Selo>
  )
}

/** O apelido pelo qual a loja chama o cliente. Aparecia como o mesmo JSX em seis telas. */
export function SeloApelido({ apelido }: { apelido: string | null | undefined }) {
  if (!apelido) return null
  return (
    <Selo tom="marca" className="ms-2">
      {apelido}
    </Selo>
  )
}

export { ROTULO_URGENCIA }
