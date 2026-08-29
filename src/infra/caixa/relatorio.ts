import { listarLivro } from './livro'
import { agruparPorConta, type RelatorioContador } from '@/domain/caixa/relatorio'

export async function montarRelatorio(empresaId: string, periodo: { de: string; ate: string }): Promise<RelatorioContador> {
  const livro = await listarLivro(empresaId, periodo)
  return agruparPorConta(livro.linhas)
}
