import Link from 'next/link'
import { valorEmReais } from './dinheiro'

/**
 * Graficos desenhados no servidor, em SVG e CSS.
 *
 * Sem biblioteca e sem JavaScript no navegador, por tres motivos que importam
 * aqui: cada barra vira um LINK de verdade (o pedido era "todos os dados
 * clicaveis"), a cor sai dos mesmos tokens do resto do sistema e acompanha o
 * modo claro e escuro sozinha, e a tela nao carrega 200 KB de biblioteca para
 * desenhar doze retangulos.
 *
 * Todo grafico tem legenda em texto: quem usa leitor de tela nao ve barra.
 */

export interface Fatia {
  rotulo: string
  valor: number
  /** Para onde a barra leva. Sem isto ela e so um desenho. */
  href?: string
  /** Texto pronto do valor; sem ele, formata como dinheiro. */
  texto?: string
  /** Uma das cores de situacao: neutro, marca, bom, atencao, ruim. */
  tom?: 'neutro' | 'marca' | 'bom' | 'atencao' | 'ruim'
}

function formatar(f: Fatia): string {
  return f.texto ?? valorEmReais(f.valor.toFixed(2))
}

/**
 * O valor curto que cabe em cima de uma barra.
 *
 * Quinze anos de faturamento em quinze barras dao 58px por barra; "R$
 * 504.036,26" precisa de 90px, e os rotulos se atropelavam. Grafico nao e
 * extrato: os centavos moram no titulo da barra e no relatorio. Aqui vale a
 * ordem de grandeza.
 */
function valorCurto(f: Fatia): string {
  if (f.texto !== undefined) return f.texto
  const v = f.valor
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

/**
 * Barras verticais para uma serie no tempo: doze meses de faturamento.
 *
 * A altura e proporcional ao maior valor da serie, e nao a um teto fixo: a
 * pergunta e "qual mes foi melhor", nao "quanto falta para uma meta".
 */
export function BarrasNoTempo({
  fatias,
  rotulo,
  altura = 160,
}: {
  fatias: Fatia[]
  /** Para o leitor de tela saber o que a serie mede. */
  rotulo: string
  altura?: number
}) {
  const maior = Math.max(...fatias.map((f) => f.valor), 0)
  if (fatias.length === 0) return null

  /*
   * Com muitas barras, so o pico leva o valor escrito.
   *
   * Doze meses ainda cabem: 73px por coluna contra os 55px de "R$ 504 mil".
   * Quinze anos nao: dao 58px por coluna, e onze dos quinze rotulos ficavam
   * por cima do vizinho. O numero exato continua no titulo de cada barra e na
   * tela para onde ela leva; escrito, fica so o que da a escala.
   */
  const soOPico = fatias.length > 12

  return (
    <div className="grafico-tempo" role="group" aria-label={rotulo}>
      {fatias.map((f) => {
        // Barra de valor zero nao some: fica um tracinho, senao o mes
        // desaparece do eixo e a serie parece ter onze meses.
        const proporcao = maior === 0 ? 0 : f.valor / maior
        const alturaBarra = f.valor === 0 ? 2 : Math.max(2, Math.round(proporcao * altura))
        const corpo = (
          <>
            <span className="grafico-valor">
              {f.valor === 0 || (soOPico && f.valor !== maior) ? '' : valorCurto(f)}
            </span>
            <span className={`grafico-barra ${f.tom ? `tom-${f.tom}` : 'tom-marca'}`} style={{ height: `${alturaBarra}px` }} />
            <span className="grafico-rotulo">{f.rotulo}</span>
          </>
        )
        const titulo = `${f.rotulo}: ${formatar(f)}`
        return f.href ? (
          <Link key={f.rotulo} href={f.href} className="grafico-coluna" title={titulo} aria-label={titulo}>
            {corpo}
          </Link>
        ) : (
          <span key={f.rotulo} className="grafico-coluna" title={titulo} aria-label={titulo}>
            {corpo}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Barras horizontais para um ranking: quem mais comprou, por onde o dinheiro
 * saiu. Horizontal porque o rotulo e um nome de cliente ou de conta, e nome nao
 * cabe embaixo de uma barra vertical sem virar texto de lado.
 */
export function BarrasEmLista({ fatias, rotulo }: { fatias: Fatia[]; rotulo: string }) {
  const maior = Math.max(...fatias.map((f) => f.valor), 0)
  return (
    <ul className="grafico-lista" aria-label={rotulo}>
      {fatias.map((f) => {
        const largura = maior === 0 ? 0 : Math.max(1, Math.round((f.valor / maior) * 100))
        const corpo = (
          <>
            <span className="grafico-lista-nome">{f.rotulo}</span>
            <span className="grafico-lista-trilho">
              <span className={`grafico-lista-barra ${f.tom ? `tom-${f.tom}` : 'tom-marca'}`} style={{ width: `${largura}%` }} />
            </span>
            <span className="grafico-lista-valor numero">{formatar(f)}</span>
          </>
        )
        return (
          <li key={f.rotulo}>
            {f.href ? (
              <Link href={f.href} className="grafico-lista-linha">{corpo}</Link>
            ) : (
              <span className="grafico-lista-linha">{corpo}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Duas series no mesmo eixo: entradas e saidas mes a mes.
 *
 * Lado a lado, e nao empilhadas: a pergunta e "entrou mais do que saiu?", e
 * empilhar responde "quanto girou", que e outra coisa.
 */
export function BarrasPareadas({
  meses,
  rotulo,
  altura = 140,
}: {
  meses: Array<{ rotulo: string; href?: string; entrada: number; saida: number }>
  rotulo: string
  altura?: number
}) {
  const maior = Math.max(...meses.flatMap((m) => [m.entrada, m.saida]), 0)
  const alturaDe = (v: number) => (maior === 0 || v === 0 ? 2 : Math.max(2, Math.round((v / maior) * altura)))

  return (
    <div>
      <div className="grafico-tempo" role="group" aria-label={rotulo}>
        {meses.map((m) => {
          const titulo = `${m.rotulo}: entrou ${valorEmReais(m.entrada.toFixed(2))}, saiu ${valorEmReais(m.saida.toFixed(2))}`
          const corpo = (
            <>
              <span className="grafico-par">
                <span className="grafico-barra tom-bom" style={{ height: `${alturaDe(m.entrada)}px` }} />
                <span className="grafico-barra tom-ruim" style={{ height: `${alturaDe(m.saida)}px` }} />
              </span>
              <span className="grafico-rotulo">{m.rotulo}</span>
            </>
          )
          return m.href ? (
            <Link key={m.rotulo} href={m.href} className="grafico-coluna" title={titulo} aria-label={titulo}>{corpo}</Link>
          ) : (
            <span key={m.rotulo} className="grafico-coluna" title={titulo} aria-label={titulo}>{corpo}</span>
          )
        })}
      </div>
      <div className="d-flex gap-3 mt-2 text-secondary small">
        <span className="d-inline-flex align-items-center gap-1">
          <span className="grafico-amostra tom-bom" aria-hidden="true" /> entrou
        </span>
        <span className="d-inline-flex align-items-center gap-1">
          <span className="grafico-amostra tom-ruim" aria-hidden="true" /> saiu
        </span>
      </div>
    </div>
  )
}
