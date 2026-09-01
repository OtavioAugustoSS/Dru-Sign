import { diasEntre, hojeCalendario } from '@/domain/ordem/datas'
import type { Tom } from '@/componentes/situacao'
import type { OrdemDaProducao } from '@/domain/producao/urgencia'

/**
 * As palavras do prazo, para o cartão e para o detalhe dizerem a mesma coisa.
 *
 * Fica aqui e não no domínio de propósito: `classificarUrgencia` decide em qual
 * GRUPO a ordem cai, que é regra; isto decide como a frase é escrita, que é
 * tela. A cor sai dos mesmos tons de `--ponto-*` que o resto do sistema usa.
 */

/** 'dia' e 'dias': a fila mostra "há 1 dia" e não "há 1 dias". */
function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`
}

export interface Prazo {
  texto: string
  tom: Tom
}

/**
 * O compromisso, escrito como a bancada pensa.
 *
 * Data crua não responde "isso é para agora?": quem está de pé com a peça na mão
 * conta dias, não lê calendário. "Atrasada há 3 dias" e "Em 2 dias" respondem;
 * "28/08/2026" obriga a fazer a conta. A data continua no detalhe, para quem
 * precisa do dia exato.
 */
export function prazoDe(ordem: OrdemDaProducao, agora: Date = new Date()): Prazo {
  if (ordem.prometidaPara === null) return { texto: 'Sem data combinada', tom: 'neutro' }
  const hoje = hojeCalendario(agora)
  const prometida = ordem.prometidaPara.slice(0, 10)
  const n = diasEntre(hoje, prometida)
  if (n < 0) return { texto: `Atrasada há ${dias(-n)}`, tom: 'ruim' }
  if (n === 0) return { texto: 'Para hoje', tom: 'atencao' }
  if (n === 1) return { texto: 'Para amanhã', tom: 'atencao' }
  return { texto: `Em ${dias(n)}`, tom: 'neutro' }
}

/** Há quanto tempo a ordem espera. É o que separa a fila velha da fila nova. */
export function esperaDe(ordem: OrdemDaProducao, agora: Date = new Date()): string {
  const n = diasEntre(hojeCalendario(new Date(ordem.abertaEm)), hojeCalendario(agora))
  if (n <= 0) return 'aberta hoje'
  return `na fila há ${dias(n)}`
}

/** O nome que se lê no cartão: o apelido ganha do nome de cadastro, que é longo. */
export function nomeDoCliente(ordem: OrdemDaProducao): string {
  return ordem.clienteApelido ?? ordem.clienteNome ?? 'Venda de balcão'
}
