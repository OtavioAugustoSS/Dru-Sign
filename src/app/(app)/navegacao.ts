import type { PapelUsuario } from '@/domain/usuarios/tipos'

export type GrupoNavegacao = 'atendimento' | 'producao' | 'financeiro' | 'arquivo' | 'configuracao'

/** O cabecalho de cada grupo, na ordem em que aparecem na lateral. */
export const GRUPOS: { chave: GrupoNavegacao; rotulo: string }[] = [
  { chave: 'atendimento', rotulo: 'Atendimento' },
  { chave: 'producao', rotulo: 'Produção' },
  { chave: 'financeiro', rotulo: 'Financeiro' },
  { chave: 'arquivo', rotulo: 'Arquivo' },
  { chave: 'configuracao', rotulo: 'Configuração' },
]

export type IconeNavegacao =
  | 'fila' | 'producao' | 'ordens' | 'historico' | 'clientes' | 'carteira'
  | 'materiais' | 'indicadores' | 'financeiro' | 'contador' | 'plano'
  | 'usuarios' | 'empresa'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: IconeNavegacao
  /** Sem grupo: fica no topo, acima dos cabecalhos. */
  grupo?: GrupoNavegacao
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

/**
 * O nome aqui e o mesmo titulo que a tela mostra. Antes o menu dizia
 * "Financeiro" e a pagina dizia "Livro-caixa"; o menu dizia "Operacao" e a
 * pagina mostrava indicadores.
 *
 * "Nova saida" NAO entra aqui, ainda que seja uma tela sem entrada no menu: e
 * uma acao, nao um lugar. Ela continua sendo o botao da tela do livro-caixa,
 * que e de onde ela faz sentido.
 */
export const NAVEGACAO: ItemNavegacao[] = [
  // Para quem e da operacao, `/` ja e a fila de producao: um item "Fila de trabalho"
  // levando ao mesmo lugar com outro nome so confunde.
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila', papel: 'administracao' },

  { href: '/ordens', titulo: 'Ordens', icone: 'ordens', grupo: 'atendimento' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes', grupo: 'atendimento' },
  { href: '/clientes/carteira', titulo: 'Carteira de clientes', icone: 'carteira', grupo: 'atendimento', papel: 'administracao' },

  { href: '/producao', titulo: 'Fila de produção', icone: 'producao', grupo: 'producao' },

  { href: '/financeiro', titulo: 'Livro-caixa', icone: 'financeiro', grupo: 'financeiro', papel: 'administracao' },
  { href: '/financeiro/contador', titulo: 'Relatório do contador', icone: 'contador', grupo: 'financeiro', papel: 'administracao' },
  { href: '/plano-de-contas', titulo: 'Plano de contas', icone: 'plano', grupo: 'financeiro', papel: 'administracao' },

  { href: '/historico', titulo: 'Histórico', icone: 'historico', grupo: 'arquivo' },

  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', grupo: 'configuracao', papel: 'administracao' },
  { href: '/operacao', titulo: 'Indicadores', icone: 'indicadores', grupo: 'configuracao', papel: 'administracao' },
  { href: '/usuarios', titulo: 'Usuários', icone: 'usuarios', grupo: 'configuracao', papel: 'administracao' },
  { href: '/empresa', titulo: 'Dados da empresa', icone: 'empresa', grupo: 'configuracao', papel: 'administracao' },
]

/**
 * O menu que cada papel enxerga.
 *
 * Alem de filtrar, corrige o destino da fila de producao: para quem e da
 * operacao a raiz `/` JA E a fila de producao (ver `page.tsx`), entao o item
 * precisa apontar para la. Sem isto a pessoa entra, cai em `/` e nao ve nada
 * aceso no menu -- fica sem saber onde esta.
 */
export function navegacaoPara(papel: PapelUsuario): ItemNavegacao[] {
  return NAVEGACAO.filter((item) => !item.papel || item.papel === papel).map((item) =>
    papel === 'operacao' && item.href === '/producao' ? { ...item, href: '/' } : item,
  )
}

/**
 * Qual item da lateral corresponde ao endereco aberto.
 *
 * Vence o endereco mais longo que casa, senao `/clientes/carteira` acenderia
 * "Clientes" em vez de "Carteira", e `/financeiro/contador` acenderia
 * "Livro-caixa". A raiz `/` so casa com ela mesma, senao acenderia em tudo.
 */
export function hrefAtivo(caminho: string, hrefs: string[]): string | null {
  let melhor: string | null = null
  for (const href of hrefs) {
    const casa = href === '/' ? caminho === '/' : caminho === href || caminho.startsWith(`${href}/`)
    if (casa && (melhor === null || href.length > melhor.length)) melhor = href
  }
  return melhor
}
