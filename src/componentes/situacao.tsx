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
/**
 * A cor do PONTO de situacao -- que nao e a cor do texto.
 *
 * A primeira versao pintava o ponto com as classes de `TEXTO`, e ficou ilegivel
 * no tema claro: as `-emphasis` sao versoes ESCURECIDAS, feitas para letra sobre
 * fundo claro. O verde `-emphasis` da 10,66:1 sobre branco -- passa folgado em
 * contraste e mesmo assim ninguem reconhece que e verde, porque num circulo de
 * 8px o que identifica a cor e a saturacao, nao o quanto ela e escura.
 *
 * Entao o ponto ganha paleta propria: saturada o bastante para se ler como
 * verde, vermelho ou ambar, e ainda acima dos 3:1 que um grafico com significado
 * precisa. Os valores medidos estao no `tema.css`, ao lado de cada token.
 */
export const PONTO: Record<Tom, string> = {
  neutro: 'ponto-neutro',
  marca: 'ponto-marca',
  bom: 'ponto-bom',
  atencao: 'ponto-atencao',
  ruim: 'ponto-ruim',
}

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
  /* `-emphasis`, nao a cor cheia: `text-warning` sobre o fundo claro da 2,04:1,
   * e este e o titulo do grupo do trabalho DE HOJE -- o que a producao mais
   * precisa achar de relance. A varredura final pegou; era o unico dos quatro
   * rotulos de urgencia que ainda usava a cor de preencher para escrever. */
  hoje: 'text-warning-emphasis',
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

/**
 * A SITUACAO de um registro: um ponto na cor do estado e a palavra ao lado.
 *
 * Era um selo -- retangulo arredondado com fundo tingido, um por linha. Numa
 * lista onde doze de cada dezoito linhas dizem "Aberta", cento e sessenta
 * retangulos coloridos fazem a coluna inteira gritar e o olho nao acha a
 * cancelada. Some ainda que a largura do retangulo acompanha o tamanho da
 * palavra, entao a coluna fica com a borda direita serrilhada.
 *
 * Aqui a cor ocupa 8px e a palavra fica na cor normal do corpo -- que le melhor
 * do que qualquer texto tingido. A cor continua sendo o atalho para quem varre a
 * coluna, e a palavra continua sendo a resposta para quem le: nenhuma informacao
 * depende so da cor.
 */
export function Situacao({ tom, children, className, testId }: Props) {
  return (
    <span className={className ? `situacao ${className}` : 'situacao'} data-testid={testId}>
      <span className={`situacao-ponto ${PONTO[tom]}`} aria-hidden="true" />
      {/* O rotulo num span proprio: como `.situacao` e flex com `gap`, um texto
          solto com espaco no meio ("Falta R$ 80,00") viraria dois itens flex e
          ganharia um vao no meio da frase. */}
      <span>{children}</span>
    </span>
  )
}

/**
 * Uma qualificacao curta colada a um nome: o apelido, "arquivado", "voce".
 *
 * Tambem era selo, e tambem nao devia ser. Isto nao e a situacao de uma linha
 * numa coluna: e um aparte sobre o nome que vem antes -- e aparte se escreve
 * menor e mais claro, nao dentro de uma caixa colorida. O ponto separador vem
 * do CSS para que quem chama nao precise lembrar da margem.
 */
export function Anotacao({ children, tom = 'neutro', testId }: { children: ReactNode; tom?: Tom; testId?: string }) {
  return (
    <span className={tom === 'neutro' ? 'anotacao' : `anotacao ${TEXTO[tom]}`} data-testid={testId}>
      {children}
    </span>
  )
}

// Atalhos: o chamador passa o valor do dominio e nao decide cor nem texto.

export function SituacaoEstado({ estado, className }: { estado: EstadoProducao; className?: string }) {
  return (
    <Situacao tom={TOM_ESTADO[estado]} className={className}>
      {ROTULO_ESTADO[estado]}
    </Situacao>
  )
}

export function SituacaoPagamento({ estado, className, testId }: { estado: EstadoPagamento; className?: string; testId?: string }) {
  return (
    <Situacao tom={TOM_PAGAMENTO[estado]} className={className} testId={testId}>
      {ROTULO_PAGAMENTO[estado]}
    </Situacao>
  )
}

export function SituacaoRecencia({ recencia, className }: { recencia: Recencia; className?: string }) {
  return (
    <Situacao tom={TOM_RECENCIA[recencia]} className={className}>
      {ROTULO_RECENCIA[recencia]}
    </Situacao>
  )
}

export function SituacaoTipoLancamento({ tipo, className }: { tipo: TipoLancamento; className?: string }) {
  return (
    <Situacao tom={TOM_TIPO_LANCAMENTO[tipo]} className={className}>
      {ROTULO_TIPO_LANCAMENTO[tipo]}
    </Situacao>
  )
}

export function SituacaoTipoConta({ tipo, className }: { tipo: TipoConta; className?: string }) {
  return (
    <Situacao tom={TOM_TIPO_CONTA[tipo]} className={className}>
      {ROTULO_TIPO_CONTA[tipo]}
    </Situacao>
  )
}

/** O apelido pelo qual a loja chama o cliente. Aparecia como o mesmo JSX em seis telas. */
export function Apelido({ apelido }: { apelido: string | null | undefined }) {
  if (!apelido) return null
  return <Anotacao>{apelido}</Anotacao>
}

export { ROTULO_URGENCIA }
