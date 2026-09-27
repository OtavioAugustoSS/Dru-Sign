'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { interpretarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { ehUnidadeCobranca } from '@/infra/materiais/repositorio'
import { aplicar, criarFamilia, excluirFamilia, obterFamilia } from '@/infra/precificacao/repositorio'

export interface EstadoFamilia {
  erro?: string
  /** Quantos precos mudaram de fato, para a tela confirmar o que aconteceu. */
  aplicados?: { afetados: number; pulados: number }
  campos?: { margem: string; arredondamento: string; minimoCobranca: string }
}

export async function salvarFamilia(_estado: EstadoFamilia, formData: FormData): Promise<EstadoFamilia> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const campos = {
    margem: String(formData.get('margem') ?? '').trim(),
    arredondamento: String(formData.get('arredondamento') ?? '').trim(),
    minimoCobranca: String(formData.get('minimoCobranca') ?? '').trim(),
  }

  const familia = await obterFamilia(usuario.empresaId, id)
  if (!familia) return { erro: 'Família não encontrada.', campos }

  // Margem aceita negativo de proposito: vender abaixo do custo e decisao comercial.
  // O que nao pode e vir vazio ou como texto.
  const margem = interpretarMoeda(campos.margem)
  if (margem === null) return { erro: 'A margem precisa ser um número. Use vírgula para os centavos.', campos }

  const arredondamento = interpretarMoeda(campos.arredondamento)
  if (arredondamento === null || arredondamento.lte(0)) {
    return { erro: 'O arredondamento precisa ser maior que zero.', campos }
  }

  let minimoCobranca = null
  if (campos.minimoCobranca !== '') {
    minimoCobranca = interpretarMoeda(campos.minimoCobranca)
    if (minimoCobranca === null || minimoCobranca.lt(0)) {
      return { erro: 'O mínimo de cobrança precisa ser um número não negativo, ou ficar em branco.', campos }
    }
  }

  const r = await aplicar(
    usuario.empresaId,
    id,
    {
      nome: familia.nome,
      unidadePadrao: familia.unidadePadrao,
      margem,
      arredondamento,
      minimoCobranca: minimoCobranca === null ? null : dinheiro(minimoCobranca.toFixed()),
    },
    usuario.id,
  )

  revalidatePath('/precificacao')
  revalidatePath(`/precificacao/${id}`)
  revalidatePath('/materiais')
  return { aplicados: r, campos }
}

export interface EstadoNovaFamilia {
  erro?: string
  campos?: { nome: string; unidadePadrao: string; margem: string }
}

/**
 * Cria uma familia pela tela.
 *
 * Existe para o sistema nao depender do importador: perdido o banco, da para cadastrar a
 * politica de preco inteira a mao. Nasce com arredondamento ao centavo e sem minimo --
 * os dois se ajustam na tela da propria familia, que ja mostra o impacto de cada mudanca.
 */
export async function novaFamilia(_estado: EstadoNovaFamilia, formData: FormData): Promise<EstadoNovaFamilia> {
  const usuario = await exigirPapel('administracao')
  const campos = {
    nome: String(formData.get('nome') ?? '').trim(),
    unidadePadrao: String(formData.get('unidadePadrao') ?? ''),
    margem: String(formData.get('margem') ?? '').trim(),
  }

  if (campos.nome === '') return { erro: 'Dê um nome à família.', campos }
  if (!ehUnidadeCobranca(campos.unidadePadrao)) return { erro: 'Escolha como os materiais desta família são cobrados.', campos }
  const margem = interpretarMoeda(campos.margem)
  if (margem === null) return { erro: 'A margem precisa ser um número. Use vírgula para os centavos.', campos }

  try {
    await criarFamilia(usuario.empresaId, {
      nome: campos.nome,
      unidadePadrao: campos.unidadePadrao,
      margem,
      arredondamento: dinheiro('0.01'),
      minimoCobranca: null,
    })
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002') {
      return { erro: `Já existe uma família chamada “${campos.nome}”.`, campos }
    }
    throw e
  }
  revalidatePath('/precificacao')
  return {}
}

/** Excluir so vale enquanto ninguem depende dela: com material vinculado, o vinculo sumiria calado. */
export async function excluir(formData: FormData): Promise<void> {
  const usuario = await exigirPapel('administracao')
  const r = await excluirFamilia(usuario.empresaId, String(formData.get('id') ?? ''))
  revalidatePath('/precificacao')
  if (!r.excluida) redirect(`/precificacao?erro=materiais&n=${r.materiais}`)
  redirect('/precificacao')
}
