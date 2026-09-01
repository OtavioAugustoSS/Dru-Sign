import { diasEntre, hojeCalendario } from '@/domain/ordem/datas'

/**
 * Há quanto tempo, em dias, escrito como a loja fala.
 *
 * A fila de produção já resolveu isto e escreveu o porquê: quem está de pé com a
 * peça na mão conta dias, não lê calendário. As duas listas da tela inicial --
 * "abertas há mais de uma semana" e "concluídas e não pagas" -- existem
 * exatamente para dizer que alguma coisa está parada tempo demais, e mostravam
 * "27/05/2026 00:38". Com trinta linhas, achar a mais velha vira conta de cabeça
 * linha por linha; a lista já vem ordenada da mais antiga, e a frase é que
 * faltava para isso aparecer.
 *
 * A data exata continua na ordem, para quem precisa do dia.
 */
export function haQuantosDias(iso: string, agora: Date = new Date()): string {
  const n = diasEntre(hojeCalendario(new Date(iso)), hojeCalendario(agora))
  if (n <= 0) return 'hoje'
  if (n === 1) return 'ontem'
  return `há ${n} dias`
}
