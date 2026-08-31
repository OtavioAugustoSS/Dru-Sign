/**
 * A marca dos dados de exemplo: o que torna a leva REVERSÍVEL.
 *
 * Guarda a hora em que o seed começou, a empresa e o contador de OS de antes.
 * O removedor apaga o que nasceu depois daquela hora e devolve o contador. Fica
 * num arquivo, e não só na memória do processo, porque um seed interrompido no
 * meio (Ctrl+C, máquina desligada) precisa poder ser desfeito depois.
 */
export const MARCA = '.dados-exemplo.json'

export interface Marca {
  inicio: string
  empresaId: string
  proximaOsAntes: number
}

/**
 * Recusa em banco que não seja local.
 *
 * Isto apaga linhas por data de criação. Rodar contra a Neon de produção
 * apagaria trabalho de verdade da loja, e a diferença entre um banco e outro é
 * uma variável de ambiente — barata demais para confiar na atenção de quem
 * digita. Mesma guarda de `e2e/faxina.ts`, pelo mesmo motivo.
 */
export function exigirBancoLocal(url: string | undefined): void {
  if (!url) throw new Error('DATABASE_URL ausente')
  const host = new URL(url).hostname
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Recusando: DATABASE_URL não é local (${host}). Dados de exemplo só em desenvolvimento.`)
  }
}
