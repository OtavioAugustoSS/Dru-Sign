/**
 * Guarda contra apagar o banco errado: o harness de integracao faz TRUNCATE em todas as tabelas,
 * entao ele so roda com NODE_ENV=test e com DATABASE_URL apontando para um banco cujo nome termina
 * em `_test`. Uma DATABASE_URL exportada no shell (que o @next/env nao sobrescreve) apontando para
 * o banco de desenvolvimento apagaria os 3.219 clientes importados sem aviso.
 */
export function exigirBancoDeTeste(url: string | undefined): string {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Recusando: NODE_ENV="${process.env.NODE_ENV ?? ''}", esperado "test"`)
  }
  if (!url) {
    throw new Error('DATABASE_URL ausente. Rode `npm run db:local:test` e copie a URL para .env.test.local')
  }
  const caminho = new URL(url).pathname
  if (!/_test$/.test(caminho)) {
    throw new Error(`Recusando TRUNCATE: DATABASE_URL nao aponta para um banco *_test (${caminho})`)
  }
  return url
}
