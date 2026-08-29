'use server'

import { gravarTemaNoCookie } from '@/infra/tema/cookie'
import { normalizarTema } from '@/infra/tema/preferencia'

/**
 * Grava a escolha de tema. O seletor ja pintou a tela antes de chamar aqui, entao
 * esta action so serve para a proxima visita comecar certa — nao precisa
 * revalidar rota nenhuma.
 */
export async function escolherTema(valor: string): Promise<void> {
  await gravarTemaNoCookie(normalizarTema(valor))
}
