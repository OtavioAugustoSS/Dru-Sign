import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { agruparPorDocumento, type Carteira, type LinhaCarteira } from '@/domain/clientes/carteira'

/** Cancelada nao faturou; orcamento ainda nao e venda. */
const FATURAM = ['aberta', 'concluida'] as const

/**
 * Uma linha por cadastro; o dominio e quem junta os cadastros do mesmo documento.
 * Venda de balcao (ordem sem cliente) fica de fora: nao ha carteira sem nome.
 *
 * Conta as DUAS eras. A carteira responde "ha quanto tempo este cliente nao
 * aparece" e "quanto ele representa" -- perguntas sobre a relacao inteira, nao
 * sobre o sistema em que a ordem foi digitada. Lendo so o sistema novo, a tela
 * nasceu vazia e ia continuar assim por meses, enquanto 14 anos de compra
 * estavam parados no arquivo: 2.964 clientes, dos quais 212 sumiram ha 6 a 24
 * meses. E essa lista de 212 que faz a tela valer alguma coisa hoje.
 *
 * Do arquivo ficam de fora as 3.152 ordens em que o sistema antigo escreveu
 * "C A N C E L A D O" por cima do nome do cliente: aquilo nao foi venda.
 */
export async function carregarCarteira(empresaId: string, agora: Date = new Date()): Promise<Carteira> {
  const [clientes, novas, antigas] = await Promise.all([
    prisma.cliente.findMany({
      where: { empresaId, arquivadoEm: null },
      select: { id: true, nome: true, apelido: true, documento: true },
    }),
    prisma.ordemServico.groupBy({
      by: ['clienteId'],
      where: { empresaId, clienteId: { not: null }, estadoProducao: { in: [...FATURAM] } },
      _count: { _all: true },
      _sum: { precoFinal: true },
      _max: { abertaEm: true },
    }),
    prisma.ordemLegado.groupBy({
      by: ['clienteId'],
      where: { empresaId, clienteId: { not: null }, nomeDestruido: false },
      _count: { _all: true },
      _sum: { total: true },
      _max: { dataEntrada: true },
    }),
  ])

  const porClienteNovas = new Map(novas.map((g) => [g.clienteId as string, g]))
  const porClienteAntigas = new Map(antigas.map((g) => [g.clienteId as string, g]))

  const linhas: LinhaCarteira[] = clientes.map((c) => {
    const n = porClienteNovas.get(c.id)
    const a = porClienteAntigas.get(c.id)
    const faturado = dinheiro(0)
      .plus(n?._sum.precoFinal ? paraDominio(n._sum.precoFinal) : dinheiro(0))
      .plus(a?._sum.total ? paraDominio(a._sum.total) : dinheiro(0))
    // A mais recente das duas eras: a data do legado e @db.Date (meia-noite UTC)
    // e a do sistema novo tem hora; comparar como ISO resolve as duas.
    const datas = [n?._max.abertaEm?.toISOString(), a?._max.dataEntrada?.toISOString()].filter((d): d is string => !!d)
    return {
      id: c.id, nome: c.nome, apelido: c.apelido, documento: c.documento,
      ordens: (n?._count._all ?? 0) + (a?._count._all ?? 0),
      faturado: faturado.toFixed(2),
      ultimaOrdemEm: datas.length === 0 ? null : (datas.sort().at(-1) as string),
    }
  })
  return agruparPorDocumento(linhas, agora)
}

/**
 * O telefone de cada cadastro, para a lista de reativacao.
 *
 * A lista existe para alguem pegar o telefone e ligar. Sem o numero na linha,
 * cada nome custava uma ida a busca de clientes e uma volta -- cento e quarenta
 * e tres vezes. Nao entra no dominio da carteira porque nao participa de conta
 * nenhuma: e so o que a tela precisa mostrar.
 *
 * So os cadastros da pagina aberta: buscar os tres mil de uma vez para exibir
 * cinquenta seria pagar caro por nada.
 */
export async function telefonesDeClientes(empresaId: string, ids: string[]): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map()
  const linhas = await prisma.telefoneCliente.findMany({
    where: { empresaId, clienteId: { in: ids }, normalizado: { not: null } },
    orderBy: [{ clienteId: 'asc' }, { ordem: 'asc' }],
    select: { clienteId: true, normalizado: true },
  })
  const porCliente = new Map<string, string[]>()
  for (const l of linhas) {
    const lista = porCliente.get(l.clienteId)
    if (lista) lista.push(l.normalizado as string)
    else porCliente.set(l.clienteId, [l.normalizado as string])
  }
  return porCliente
}
