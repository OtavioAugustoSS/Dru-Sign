import { prisma } from '@/infra/db/prisma'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { normalizarTelefone } from '@/domain/clientes/telefone'
import { normalizarDocumento } from '@/domain/clientes/documento'

export interface EmpresaTela {
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  telefone1: string | null
  telefone2: string | null
}

export async function obterEmpresa(empresaId: string): Promise<EmpresaTela> {
  return prisma.empresa.findUniqueOrThrow({
    where: { id: empresaId },
    select: {
      razaoSocial: true, nomeFantasia: true, cnpj: true, endereco: true, bairro: true,
      cidade: true, uf: true, cep: true, telefone1: true, telefone2: true,
    },
  })
}

const texto = (v: string, tamanho: number): string | null => v.trim().replace(/\s+/g, ' ').slice(0, tamanho) || null

/** normalizarTelefone devolve { normalizado: string | null, inferido: boolean }: null e o que nao disca. */
function telefone(v: string): string | null {
  const t = v.trim()
  if (t === '') return null
  const { normalizado } = normalizarTelefone(t)
  if (normalizado === null) throw new ErroDeValidacao(`telefone inválido: ${t}`)
  return normalizado
}

/** O que sai no cabecalho do impresso (spec, tela 15). So a razao social e obrigatoria. */
export async function salvarEmpresa(empresaId: string, dados: Record<keyof EmpresaTela, string>): Promise<void> {
  const razaoSocial = texto(dados.razaoSocial, 160)
  if (razaoSocial === null) throw new ErroDeValidacao('a razão social é obrigatória')

  // normalizarDocumento devolve { digitos, tipo } ou null; aqui so CNPJ serve.
  let cnpj: string | null = null
  if (dados.cnpj.trim() !== '') {
    const d = normalizarDocumento(dados.cnpj)
    if (d === null || d.tipo !== 'cnpj') throw new ErroDeValidacao('CNPJ inválido')
    cnpj = d.digitos
  }
  const uf = texto(dados.uf.toUpperCase(), 2)
  if (uf !== null && !/^[A-Z]{2}$/.test(uf)) throw new ErroDeValidacao('UF inválida')

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      razaoSocial, cnpj, uf,
      nomeFantasia: texto(dados.nomeFantasia, 80),
      endereco: texto(dados.endereco, 160),
      bairro: texto(dados.bairro, 60),
      cidade: texto(dados.cidade, 60),
      cep: texto(dados.cep, 9),
      telefone1: telefone(dados.telefone1),
      telefone2: telefone(dados.telefone2),
    },
  })
}
