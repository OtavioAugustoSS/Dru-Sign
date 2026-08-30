import { hojeCalendario } from '@/domain/ordem/datas'

/**
 * Os periodos que alguem realmente pede numa loja.
 *
 * Digitar duas datas para ver "o mes passado" e trabalho toda vez, e e a
 * pergunta mais comum do caixa. Isto nao e regra de negocio: e a lista de
 * atalhos que as telas de dinheiro e de indicadores oferecem.
 *
 * Tudo em 'AAAA-MM-DD' no fuso da loja, o mesmo formato que os campos de data
 * do formulario usam.
 */

export interface Periodo {
  chave: string
  rotulo: string
  de: string
  ate: string
}

const dois = (n: number) => String(n).padStart(2, '0')

function dia(ano: number, mes: number, d: number): string {
  return `${ano}-${dois(mes)}-${dois(d)}`
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/** Soma dias a uma data de calendario sem passar por fuso: a conta e em UTC puro. */
function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(a, m - 1, d + dias))
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`
}

export function periodosUsuais(agora: Date): Periodo[] {
  const hoje = hojeCalendario(agora)
  const [ano, mes] = hoje.split('-').map(Number) as [number, number]
  const mesPassado = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }

  return [
    { chave: 'hoje', rotulo: 'Hoje', de: hoje, ate: hoje },
    // 7 dias CONTANDO hoje: "os ultimos 7 dias" inclui o dia de hoje para quem
    // esta olhando o caixa a tarde.
    { chave: '7dias', rotulo: '7 dias', de: somarDias(hoje, -6), ate: hoje },
    { chave: '30dias', rotulo: '30 dias', de: somarDias(hoje, -29), ate: hoje },
    { chave: 'mes', rotulo: 'Este mês', de: dia(ano, mes, 1), ate: dia(ano, mes, ultimoDiaDoMes(ano, mes)) },
    {
      chave: 'mespassado',
      rotulo: 'Mês passado',
      de: dia(mesPassado.ano, mesPassado.mes, 1),
      ate: dia(mesPassado.ano, mesPassado.mes, ultimoDiaDoMes(mesPassado.ano, mesPassado.mes)),
    },
    { chave: 'ano', rotulo: 'Este ano', de: dia(ano, 1, 1), ate: dia(ano, 12, 31) },
    { chave: 'anopassado', rotulo: 'Ano passado', de: dia(ano - 1, 1, 1), ate: dia(ano - 1, 12, 31) },
  ]
}

/** Qual atalho corresponde ao periodo em vigor; null quando as datas foram digitadas na mao. */
export function atalhoAtivo(periodos: Periodo[], de: string, ate: string): string | null {
  return periodos.find((p) => p.de === de && p.ate === ate)?.chave ?? null
}
