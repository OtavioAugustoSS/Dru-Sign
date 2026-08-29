import { EsqueletoTabela } from '@/componentes/esqueleto'

/**
 * O contorno padrao do app. Vale para toda tela que nao declarar o proprio, que
 * e a maioria: cabecalho, filtro e uma tabela dentro de um cartao.
 */
export default function Carregando() {
  return <EsqueletoTabela comAcao comFiltro linhas={8} colunas={6} />
}
