/**
 * De onde a pessoa veio para esta ordem, e para onde o "voltar" leva.
 *
 * O `CabecalhoPagina` diz, em comentario, que o voltar e FIXO de proposito:
 * destino previsivel vale mais que destino exato, porque quem chega na ficha do
 * cliente pela busca e quem chega pela carteira quer a mesma coisa -- a lista de
 * clientes. Isso continua valendo em toda tela, e esta e a unica excecao.
 *
 * A ordem e diferente porque seus seis pontos de entrada nao sao rotas para a
 * mesma lista: sao TRABALHOS diferentes. Quem abriu a ordem pela fila de
 * producao esta na bancada e quer voltar para a bancada; mandar essa pessoa
 * para /ordens e joga-la numa tela de balcao, com dinheiro, que a fila de
 * producao evita de proposito. Quem veio do livro-caixa estava conferindo
 * dinheiro. Quem veio da ficha de um cliente estava olhando aquele cliente.
 *
 * `de` vem do endereco e portanto de fora: nunca vira href diretamente. Chave
 * desconhecida cai no padrao, que e a lista de ordens.
 */

export interface Voltar {
  href: string
  rotulo: string
}

const PADRAO: Voltar = { href: '/ordens', rotulo: 'Ordens' }

/**
 * Os destinos fixos. A ficha do cliente fica fora porque o endereco dela depende
 * da ordem.
 *
 * `Map`, e nao objeto literal: com objeto, `FIXOS['constructor']` e
 * `FIXOS['toString']` devolvem funcoes herdadas do `Object.prototype` em vez de
 * cair no padrao, e uma funcao no lugar do destino vira um `href` indefinido no
 * cabecalho. A chave vem do endereco -- basta alguem digitar. Pego pelo teste.
 */
const FIXOS = new Map<string, Voltar>([
  ['fila', { href: '/', rotulo: 'Fila de trabalho' }],
  ['ordens', PADRAO],
  ['producao', { href: '/producao', rotulo: 'Fila de produção' }],
  ['historico', { href: '/historico', rotulo: 'Histórico' }],
  ['financeiro', { href: '/financeiro', rotulo: 'Livro-caixa' }],
])

export type Origem = 'fila' | 'ordens' | 'producao' | 'historico' | 'financeiro' | 'cliente'

/**
 * `de=cliente` nao carrega o id do cliente no endereco: a propria ordem sabe de
 * quem ela e. Um parametro a menos e um lugar a menos por onde entrar lixo.
 * Ordem sem cliente (venda de balcao) nao tem ficha para onde voltar.
 */
export function voltarDaOrdem(
  de: string | undefined,
  cliente: { id: string | null; nome: string | null } | null,
): Voltar {
  if (de === 'cliente') {
    return cliente?.id ? { href: `/clientes/${cliente.id}`, rotulo: cliente.nome ?? 'Cliente' } : PADRAO
  }
  return FIXOS.get(de ?? '') ?? PADRAO
}
