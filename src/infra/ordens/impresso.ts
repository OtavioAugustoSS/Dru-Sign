import 'server-only'
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { arredondarCentavos } from '@/domain/precificacao/dinheiro'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { normalizarTelefone } from '@/domain/clientes/telefone'
import type { DadosEmpresaImpresso, OrdemImpressa } from '@/domain/ordem/impresso'

export interface ImpressoCompleto {
  empresa: DadosEmpresaImpresso
  ordem: OrdemImpressa
}

/** Nada e recalculado aqui: o impresso le preco_calculado/preco_final como foram persistidos. */
export async function obterImpresso(empresaId: string, ordemId: string): Promise<ImpressoCompleto | null> {
  const o = await prisma.ordemServico.findFirst({
    where: { id: ordemId, empresaId },
    include: {
      empresa: {
        select: {
          razaoSocial: true, nomeFantasia: true, cnpj: true, endereco: true,
          bairro: true, cidade: true, uf: true, telefone1: true, telefone2: true,
        },
      },
      responsavel: { select: { nome: true } },
      cliente: { select: { documento: true } },
      itens: { where: { removidoEm: null }, orderBy: { ordemExibicao: 'asc' } },
      acrescimos: { where: { removidoEm: null }, orderBy: { criadoEm: 'asc' } },
    },
  })
  if (!o) return null

  const precoCalculado = paraDominio(o.precoCalculado)
  const precoFinal = paraDominio(o.precoFinal)
  const telefone = o.clienteTelefone ? normalizarTelefone(o.clienteTelefone).normalizado : null
  const ROTULO = { instalacao: 'Instalação', deslocamento: 'Deslocamento', frete: 'Frete', imposto: 'Imposto' } as const

  return {
    empresa: {
      // Sem nome fantasia, o nome grande do cabecalho e a propria razao social.
      nomeFantasia: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
      razaoSocial: o.empresa.razaoSocial,
      cnpj: o.empresa.cnpj,
      endereco: [o.empresa.endereco, o.empresa.bairro].filter(Boolean).join(' · ') || null,
      cidadeUf: o.empresa.cidade ? `${o.empresa.cidade}${o.empresa.uf ? `/${o.empresa.uf}` : ''}` : null,
      telefones: [o.empresa.telefone1, o.empresa.telefone2].filter((t): t is string => t !== null),
    },
    ordem: {
      numero: o.numero,
      estadoProducao: o.estadoProducao,
      abertaEm: o.abertaEm,
      prometidaPara: o.prometidaPara,
      responsavel: o.responsavel.nome,
      cliente: o.clienteNome === null ? null : {
        nome: o.clienteNome,
        apelido: o.clienteApelido,
        telefone: telefone ? formatarTelefone(telefone) : o.clienteTelefone,
        documento: o.cliente?.documento ?? null,
      },
      itens: o.itens.map((i) => ({
        quantidade: i.quantidade, descricao: i.descricao, unidade: i.unidadeCobranca,
        altura: i.altura === null ? null : Number(i.altura.toFixed()), largura: i.largura === null ? null : Number(i.largura.toFixed()),
        valorUnitario: paraDominio(i.valorUnitario), total: paraDominio(i.total),
      })),
      acrescimos: o.acrescimos.map((a) => ({ descricao: `${ROTULO[a.tipo]}${a.descricao ? ` · ${a.descricao}` : ''}`, valor: paraDominio(a.valor) })),
      subtotalItens: paraDominio(o.subtotalItens),
      precoCalculado,
      precoFinal,
      ajuste: arredondarCentavos(precoFinal.minus(precoCalculado)),
      motivoAjuste: o.motivoAjuste,
      observacoes: o.observacoes,
    },
  }
}
