import { hash, verify } from '@node-rs/argon2'

/**
 * Perfil OWASP (Password Storage Cheat Sheet): Argon2id, m = 19 MiB, t = 2, p = 1. ~65 ms por hash.
 * Argon2id e o algoritmo padrao da lib (o enum `Algorithm` e const enum ambiente, que o
 * isolatedModules proibe); o teste do prefixo `$argon2id$` garante que continua sendo.
 */
const PARAMETROS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashSenha(senha: string): Promise<string> {
  if (senha.length === 0) throw new Error('senha vazia')
  return hash(senha, PARAMETROS)
}

export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha)
  } catch {
    // hash malformado conta como senha invalida
    return false
  }
}

let dummy: Promise<string> | undefined

/**
 * Hash de referencia para quando o login nao existe: a verificacao demora o mesmo
 * tempo que uma verificacao real, e o tempo de resposta nao revela quais logins existem.
 */
export function hashDummy(): Promise<string> {
  dummy ??= hash('senha-que-nunca-e-usada', PARAMETROS)
  return dummy
}
