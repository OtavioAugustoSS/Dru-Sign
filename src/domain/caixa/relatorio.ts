import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'
import type { LinhaLivro, TipoLancamento } from './lancamento'

export interface ContaDoRelatorio {
  codigo: number
  nome: string
  lancamentos: number
  total: string
}

export interface RelatorioContador {
  entradas: ContaDoRelatorio[]
  saidas: ContaDoRelatorio[]
  totalEntradas: string
  totalSaidas: string
  saldo: string
}

function somarPorConta(linhas: LinhaLivro[], tipo: TipoLancamento): ContaDoRelatorio[] {
  const contas = new Map<number, ContaDoRelatorio>()
  for (const l of linhas) {
    if (l.tipo !== tipo) continue
    const atual = contas.get(l.contaCodigo)
    if (atual) {
      atual.lancamentos += 1
      atual.total = arredondarCentavos(dinheiro(atual.total).plus(dinheiro(l.valor))).toFixed(2)
    } else {
      contas.set(l.contaCodigo, { codigo: l.contaCodigo, nome: l.contaNome, lancamentos: 1, total: dinheiro(l.valor).toFixed(2) })
    }
  }
  return [...contas.values()].sort((a, b) => dinheiro(b.total).comparedTo(dinheiro(a.total)))
}

/** O que o contador pede por telefone todo mes: quanto entrou e saiu, por conta. Estornado nao e movimento. */
export function agruparPorConta(linhas: LinhaLivro[]): RelatorioContador {
  const vivas = linhas.filter((l) => l.estornadoEm === null)
  const entradas = somarPorConta(vivas, 'entrada')
  const saidas = somarPorConta(vivas, 'saida')
  const soma = (contas: ContaDoRelatorio[]) => contas.reduce((s, c) => s.plus(dinheiro(c.total)), dinheiro(0))
  const totalEntradas = arredondarCentavos(soma(entradas))
  const totalSaidas = arredondarCentavos(soma(saidas))
  return {
    entradas,
    saidas,
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    saldo: totalEntradas.minus(totalSaidas).toFixed(2),
  }
}

const brasileiro = (v: string) => v.replace('.', ',')
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
/** Ponto e virgula e o separador que o Excel em portugues espera; nome com `;` vai entre aspas. */
const campo = (v: string) => (v.includes(';') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)

export function paraCsv(r: RelatorioContador, periodo: { de: string; ate: string }): string {
  const linhas: string[] = [
    `Periodo;${dataBr(periodo.de)};${dataBr(periodo.ate)}`,
    '',
    'Tipo;Codigo;Conta;Lancamentos;Total',
    ...r.entradas.map((c) => `Entrada;${c.codigo};${campo(c.nome)};${c.lancamentos};${brasileiro(c.total)}`),
    ...r.saidas.map((c) => `Saida;${c.codigo};${campo(c.nome)};${c.lancamentos};${brasileiro(c.total)}`),
    '',
    `Total de entradas;;;;${brasileiro(r.totalEntradas)}`,
    `Total de saidas;;;;${brasileiro(r.totalSaidas)}`,
    `Saldo;;;;${brasileiro(r.saldo)}`,
  ]
  return linhas.join('\r\n')
}
