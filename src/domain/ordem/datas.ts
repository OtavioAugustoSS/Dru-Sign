const FUSO_LOJA = 'America/Sao_Paulo'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const dois = (n: number) => String(n).padStart(2, '0')

/** Para colunas @db.Date: o Prisma entrega meia-noite UTC; ler com getUTC* para nao voltar um dia. */
export function formatarDataCalendario(d: Date): string {
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/** "4 de setembro", como o artboard mostra a entrega prometida. */
export function formatarDataLonga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

/** Para timestamptz: sempre no fuso da loja, mesmo com o servidor em UTC (Vercel). */
export function formatarDataHora(d: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_LOJA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`
}

/** "2026-09-04" -> Date de meia-noite UTC (para gravar em @db.Date). null se invalida. */
export function lerDataCalendario(texto: string): Date | null {
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null
}

const FUSO = 'America/Sao_Paulo'

/** 'AAAA-MM-DD' do dia em Sao Paulo. O Brasil nao tem horario de verao desde 2019: e sempre UTC-3. */
export function hojeCalendario(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')}`
}

/** Primeiro e ultimo dia do mes de `agora`, em Sao Paulo. */
export function mesCalendario(agora: Date): { de: string; ate: string } {
  const hoje = hojeCalendario(agora)
  const [ano, mes] = hoje.split('-').map(Number) as [number, number]
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const mm = String(mes).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Intervalo [inicio, fim) em instantes, para filtrar timestamptz por dia do calendario de Sao Paulo. */
export function limitesDoDia(de: string, ate: string): { inicio: Date; fim: Date } | null {
  const d = lerDataCalendario(de)
  const a = lerDataCalendario(ate)
  if (!d || !a || d.getTime() > a.getTime()) return null
  const inicio = new Date(d.getTime() + 3 * 3_600_000)
  const fim = new Date(a.getTime() + 27 * 3_600_000)
  return { inicio, fim }
}
