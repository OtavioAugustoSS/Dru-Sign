/** Roda uma vez quando o servidor Next sobe: valida o ambiente cedo, em vez de na primeira consulta. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/infra/env')
    env()
  }
}
