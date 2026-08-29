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
