import Link from 'next/link'
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react'

export type Direcao = 'asc' | 'desc'

export interface Ordenacao {
  campo: string
  direcao: Direcao
}

/**
 * Lê `ordenar` e `direcao` do endereço, aceitando só o que a tela declara.
 *
 * A lista de campos permitidos vem de quem chama, e não de uma cadeia de texto
 * livre: o valor entra numa cláusula `orderBy` do Prisma, e campo vindo da URL
 * sem conferência é campo que a pessoa escolhe digitando na barra do navegador.
 */
export function lerOrdenacao<C extends string>(
  campos: readonly C[],
  padrao: { campo: C; direcao: Direcao },
  params: { ordenar?: string; direcao?: string },
): { campo: C; direcao: Direcao } {
  const campo = campos.find((c) => c === params.ordenar) ?? padrao.campo
  const direcao: Direcao = params.direcao === 'asc' || params.direcao === 'desc' ? params.direcao : padrao.direcao
  return { campo, direcao }
}

interface Props {
  /** O nome do campo no endereço; precisa estar na lista que a tela permite. */
  campo: string
  children: React.ReactNode
  atual: { campo: string; direcao: Direcao }
  base: string
  /** Os outros parâmetros da tela, para ordenar não apagar o filtro. */
  parametros: Record<string, string | undefined>
  /** Números e datas começam do maior; texto começa do A. */
  primeiraDirecao?: Direcao
  className?: string
}

/**
 * Um cabeçalho de coluna que ordena a tabela.
 *
 * É link, não botão: ordenar muda o endereço, então a ordem escolhida sobrevive
 * ao recarregar, pode ser guardada nos favoritos e mandada para outra pessoa —
 * "olha a lista pelo maior valor" vira um endereço, não uma instrução.
 *
 * A seta só aparece na coluna que está ordenando. Nas outras fica o ícone neutro,
 * mais claro, que diz "dá para clicar aqui" sem competir com a que vale.
 */
export function ColunaOrdenavel({ campo, children, atual, base, parametros, primeiraDirecao = 'asc', className }: Props) {
  const ativa = atual.campo === campo
  // Clicar na coluna ativa inverte; clicar numa nova começa pela direção natural dela.
  const proxima: Direcao = ativa ? (atual.direcao === 'asc' ? 'desc' : 'asc') : primeiraDirecao

  const busca = new URLSearchParams()
  for (const [k, v] of Object.entries(parametros)) if (v) busca.set(k, v)
  busca.set('ordenar', campo)
  busca.set('direcao', proxima)

  const Seta = ativa ? (atual.direcao === 'asc' ? IconArrowUp : IconArrowDown) : IconArrowsSort

  return (
    <th className={className} aria-sort={ativa ? (atual.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link href={`${base}?${busca.toString()}`} className="coluna-ordenavel">
        {children}
        <Seta className={ativa ? 'icon coluna-seta' : 'icon coluna-seta coluna-seta-fria'} aria-hidden="true" />
      </Link>
    </th>
  )
}
