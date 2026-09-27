// Uso: npm run catalogo:importar
//
// Le docs/precificacao/catalogo-materiais.csv e carrega as familias de preco e os
// materiais. Idempotente: roda duas vezes sem duplicar, porque material e familia sao
// unicos por [empresaId, nome] -- o que ja existe e atualizado, nao recriado.
//
// Regra de ativacao: so entra ATIVO o material que tem preco de venda e que ela confirmou.
// O resto e cadastrado inativo, de proposito. Material ativo a R$ 0,00 sairia numa ordem
// sem ninguem perceber -- `validarComum` aceita zero, que e item de cortesia.
import '../src/infra/carrega-env'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/infra/db/prisma'
import { dinheiro } from '../src/domain/precificacao/dinheiro'
import { paraBanco } from '../src/infra/db/decimal'
import type { UnidadeCobranca } from '../src/domain/precificacao/tipos'

const CSV = 'docs/precificacao/catalogo-materiais.csv'

/** Os parametros com que cada familia nasce. A tela de precificacao existe para mexer neles. */
const FAMILIAS: Record<string, { unidadePadrao: UnidadeCobranca; margem: string; arredondamento: string; minimoCobranca: string | null }> = {
  'Chapa rígida': { unidadePadrao: 'm2', margem: '120', arredondamento: '0.50', minimoCobranca: '1' },
  Bobina: { unidadePadrao: 'm2', margem: '110', arredondamento: '0.01', minimoCobranca: '1' },
  Acabamento: { unidadePadrao: 'metro_linear', margem: '150', arredondamento: '1.00', minimoCobranca: null },
  'Produto pronto': { unidadePadrao: 'unidade', margem: '100', arredondamento: '1.00', minimoCobranca: null },
}

type Linha = Record<string, string>

function lerCsv(caminho: string): Linha[] {
  const bruto = readFileSync(caminho, 'utf8').replace(/^﻿/, '')
  const linhas = bruto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const cabecalho = (linhas[0] ?? '').split(';')
  return linhas.slice(1).map((l) => {
    const campos = l.split(';')
    return Object.fromEntries(cabecalho.map((c, i) => [c, campos[i] ?? '']))
  })
}

/** "83,60" -> Decimal. Vazio vira null: o CSV usa celula vazia para "nao informado". */
function valor(v: string | undefined) {
  const t = (v ?? '').trim()
  return t === '' ? null : dinheiro(t.replace(',', '.'))
}

function ehUnidade(v: string): v is UnidadeCobranca {
  return v === 'm2' || v === 'unidade' || v === 'metro_linear'
}

async function main(): Promise<void> {
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const linhas = lerCsv(CSV)

  // 1. As familias primeiro: o material precisa do id delas para se vincular.
  const idPorFamilia = new Map<string, string>()
  for (const [nome, p] of Object.entries(FAMILIAS)) {
    const f = await prisma.familiaPreco.upsert({
      where: { empresaId_nome: { empresaId: empresa.id, nome } },
      update: {},
      create: {
        empresaId: empresa.id,
        nome,
        unidadePadrao: p.unidadePadrao,
        margem: paraBanco(dinheiro(p.margem)),
        arredondamento: paraBanco(dinheiro(p.arredondamento)),
        minimoCobranca: p.minimoCobranca === null ? null : paraBanco(dinheiro(p.minimoCobranca)),
      },
      select: { id: true },
    })
    idPorFamilia.set(nome, f.id)
  }

  // 2. Os materiais. `update` nao mexe em preco nem custo: quem ja ajustou o preco na
  //    tela nao perde o ajuste por alguem rodar o importador de novo.
  let criados = 0
  let atualizados = 0
  let ativos = 0
  const semUnidade: string[] = []

  for (const l of linhas) {
    const unidade = (l.unidade_cobranca ?? '').trim()
    if (!ehUnidade(unidade)) {
      semUnidade.push(l.nome ?? '(sem nome)')
      continue
    }
    const venda = valor(l.venda_rs)
    const custo = valor(l.custo_rs)
    const confirmado = (l.status ?? '').trim() === 'confirmado'
    const ativo = venda !== null && confirmado
    if (ativo) ativos += 1

    const categoria = (l.categoria ?? '').trim()
    const familiaId = idPorFamilia.get((l.familia ?? '').trim()) ?? null

    const existente = await prisma.material.findUnique({
      where: { empresaId_nome: { empresaId: empresa.id, nome: l.nome ?? '' } },
      select: { id: true },
    })

    if (existente) {
      await prisma.material.update({
        where: { id: existente.id },
        data: { categoria: categoria === '' ? null : categoria, familiaPrecoId: familiaId, unidadeCobranca: unidade },
      })
      atualizados += 1
    } else {
      await prisma.material.create({
        data: {
          empresaId: empresa.id,
          nome: l.nome ?? '',
          categoria: categoria === '' ? null : categoria,
          preco: paraBanco(venda ?? dinheiro(0)),
          custo: custo === null ? null : paraBanco(custo),
          familiaPrecoId: familiaId,
          unidadeCobranca: unidade,
          ativo,
        },
      })
      criados += 1
    }
  }

  console.log(
    `${linhas.length} linhas do catálogo: ${criados} materiais criados, ${atualizados} já existiam.\n` +
      `${ativos} entraram ativos (têm preço e foram confirmados); ${criados + atualizados - ativos} ficaram inativos aguardando preço.\n` +
      `${idPorFamilia.size} famílias de preço prontas em /precificacao.`,
  )
  if (semUnidade.length > 0) {
    console.log(`ignorados por unidade inválida: ${semUnidade.join(', ')}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
