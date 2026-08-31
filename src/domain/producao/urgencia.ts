import { hojeCalendario } from '../ordem/datas'

export type GrupoUrgencia = 'atrasada' | 'hoje' | 'semana' | 'sem_data'

export const ROTULO_URGENCIA: Record<GrupoUrgencia, string> = {
  atrasada: 'Atrasadas',
  hoje: 'Para hoje',
  semana: 'Esta semana',
  sem_data: 'Sem data combinada',
}

/**
 * Uma linha de trabalho, em partes.
 *
 * Era uma string pronta ("12 x PLACA ACM ... - 0,61 x 0,40 m"). Virou tres campos
 * porque a tela precisa alinhar as QUANTIDADES numa coluna propria: com "12 x" e
 * "2 x" um embaixo do outro, alinhados a direita e em digitos tabulares, a lista
 * ganha uma borda numerica que se le de relance -- e de relance e como a bancada
 * le. Montar a string aqui e desmontar la com expressao regular seria o caminho
 * errado: a view nao deve fazer analise sintatica do que o servidor ja sabia.
 *
 * Nada disso e regra: `classificarUrgencia` continua identica.
 */
export interface ItemDaProducao {
  quantidade: number
  descricao: string
  /** "0,61 x 0,40 m" quando a cobranca tem medida; null quando e por unidade. */
  medida: string | null
}

/** Serializavel, e sem dinheiro: a producao nao ve preco (spec, secao 3). */
export interface OrdemDaProducao {
  id: string
  numero: number
  clienteNome: string | null
  clienteApelido: string | null
  /**
   * O telefone que a ordem congelou na criacao (`ordem_servico.cliente_telefone`),
   * e nao uma consulta ao cadastro. Entrou porque a bancada precisa ligar: peca
   * pronta, duvida no meio do servico, medida que nao bate. Nao muda regra
   * nenhuma -- e leitura, como todo o resto deste tipo.
   */
  clienteTelefone: string | null
  /**
   * O que o atendimento anotou para a bancada: "entregar direto no local",
   * "cliente vai buscar sabado", "conferir a cor com a arte antiga". Estava no
   * banco e nao chegava na fila -- a producao tinha de abrir a ordem para
   * descobrir que havia recado, ou nao descobria.
   */
  observacoes: string | null
  /** Quem no balcao atendeu: a bancada precisa saber a quem perguntar. */
  responsavelNome: string
  abertaEm: string
  /** ISO da @db.Date; null quando nao foi combinada. */
  prometidaPara: string | null
  /** Para o botao "Servico finalizado" ir com a trava otimista. */
  versao: number
  /** O que produzir, na ordem de exibicao: e o que a bancada le para trabalhar. */
  itens: ItemDaProducao[]
}

export interface GrupoDaFila {
  grupo: GrupoUrgencia
  ordens: OrdemDaProducao[]
}

export interface FilaProducao {
  /** So os grupos com ordem, na ordem de urgencia. */
  grupos: GrupoDaFila[]
  total: number
  atrasadas: number
}

const ORDEM_DOS_GRUPOS: GrupoUrgencia[] = ['atrasada', 'hoje', 'semana', 'sem_data']

/** 'AAAA-MM-DD' da coluna @db.Date, que o Prisma entrega a meia-noite UTC. */
function diaPrometido(iso: string): string {
  return iso.slice(0, 10)
}

/** Prometida longe demais nao e urgencia: cai junto com quem nao tem data. */
function grupoDe(o: OrdemDaProducao, hoje: string, fimDaSemana: string): GrupoUrgencia {
  if (o.prometidaPara === null) return 'sem_data'
  const dia = diaPrometido(o.prometidaPara)
  if (dia < hoje) return 'atrasada'
  if (dia === hoje) return 'hoje'
  return dia <= fimDaSemana ? 'semana' : 'sem_data'
}

/** A fila da producao (spec, tela 8): em ordem de urgencia, e a data prometida e o unico compromisso que existe. */
export function classificarUrgencia(ordens: OrdemDaProducao[], agora: Date): FilaProducao {
  const hoje = hojeCalendario(agora)
  const fimDaSemana = hojeCalendario(new Date(agora.getTime() + 7 * 86_400_000))

  const porGrupo = new Map<GrupoUrgencia, OrdemDaProducao[]>()
  for (const o of ordens) {
    const g = grupoDe(o, hoje, fimDaSemana)
    const lista = porGrupo.get(g)
    if (lista) lista.push(o)
    else porGrupo.set(g, [o])
  }

  const grupos: GrupoDaFila[] = []
  for (const grupo of ORDEM_DOS_GRUPOS) {
    const lista = porGrupo.get(grupo)
    if (!lista || lista.length === 0) continue
    // Com data: a mais proxima do vencimento primeiro (a mais atrasada e a menor data).
    // Sem data: a aberta ha mais tempo primeiro, que e quem esta esperando ha mais tempo.
    lista.sort((a, b) =>
      grupo === 'sem_data'
        ? a.abertaEm.localeCompare(b.abertaEm)
        : (a.prometidaPara ?? '').localeCompare(b.prometidaPara ?? ''),
    )
    grupos.push({ grupo, ordens: lista })
  }

  return { grupos, total: ordens.length, atrasadas: porGrupo.get('atrasada')?.length ?? 0 }
}
