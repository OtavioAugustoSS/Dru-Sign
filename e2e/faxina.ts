import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'

/**
 * Faxina da rodada de testes de ponta a ponta.
 *
 * Os testes rodam contra o banco de DESENVOLVIMENTO de proposito: eles dependem
 * dos 3.219 clientes e das 18.443 ordens que vieram do sistema antigo, e copiar
 * isso para um banco de teste a cada rodada custaria minutos. O preco era que
 * cada rodada deixava lixo na loja -- ordens de balcao, "Cliente e2e 1788…",
 * "Fulano de Teste" -- e em poucas semanas os numeros da tela inicial eram mais
 * teste do que trabalho.
 *
 * Entao a rodada anota a hora em que comecou e, no fim, apaga o que nasceu
 * depois dela. Nao e adivinhacao por nome: e recorte de tempo, dentro da janela
 * em que so os testes estavam escrevendo.
 *
 * A marca fica num arquivo, e nao so na memoria: rodada interrompida no meio
 * (Ctrl+C, processo morto, maquina desligada) nunca chega no fim e deixaria a
 * sujeira para sempre. A rodada seguinte encontra a marca orfa e limpa a janela
 * da anterior antes de comecar a sua.
 */

const MARCA = '.playwright-faxina.json'

interface Marca {
  inicio: string
  empresaId: string
  proximaOsAntes: number | null
}

/** Recusa em banco que nao seja local: isto apaga linhas por data de criacao. */
function exigirBancoLocal(url: string | undefined): void {
  if (!url) throw new Error('DATABASE_URL ausente')
  const host = new URL(url).hostname
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Recusando a faxina do e2e: DATABASE_URL nao e local (${host})`)
  }
}

async function limpar(marca: Marca, rotulo: string): Promise<void> {
  exigirBancoLocal(process.env.DATABASE_URL)
  const empresaId = marca.empresaId
  const nascidoAgora = { gte: new Date(marca.inicio) }

  const ordens = await prisma.ordemServico.findMany({ where: { empresaId, criadoEm: nascidoAgora }, select: { id: true } })
  const ordemIds = ordens.map((o) => o.id)
  const clientes = await prisma.cliente.findMany({ where: { empresaId, criadoEm: nascidoAgora }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)
  const usuarios = await prisma.usuario.findMany({ where: { empresaId, criadoEm: nascidoAgora }, select: { id: true } })
  const usuarioIds = usuarios.map((u) => u.id)

  await prisma.$transaction([
    // Recebimento antes do lancamento: um aponta para o outro.
    prisma.recebimento.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
    prisma.lancamentoCaixa.deleteMany({ where: { empresaId, criadoEm: nascidoAgora } }),
    prisma.acrescimoOrdem.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
    prisma.itemOrdem.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
    prisma.mutacao.deleteMany({ where: { empresaId, criadaEm: nascidoAgora } }),
    prisma.ordemServico.deleteMany({ where: { empresaId, id: { in: ordemIds } } }),
    // Historico e familia de preco entraram depois desta faxina e ficavam para tras: em
    // duas semanas eram 44 familias "Bobina e2e …" na tela de precificacao da loja.
    // Historico antes do material; familia depois, porque o material aponta para ela.
    prisma.historicoPreco.deleteMany({ where: { empresaId, criadoEm: nascidoAgora } }),
    prisma.material.deleteMany({ where: { empresaId, criadoEm: nascidoAgora } }),
    prisma.familiaPreco.deleteMany({ where: { empresaId, criadoEm: nascidoAgora } }),
    prisma.contaPlano.deleteMany({ where: { empresaId, criadoEm: nascidoAgora } }),
    prisma.telefoneCliente.deleteMany({ where: { clienteId: { in: clienteIds } } }),
    prisma.cliente.deleteMany({ where: { empresaId, id: { in: clienteIds } } }),
    // Usuario por ultimo: ordem, recebimento e lancamento apontam para ele.
    prisma.sessao.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.usuario.deleteMany({ where: { empresaId, id: { in: usuarioIds } } }),
  ])

  // A numeracao da OS nao volta sozinha: e um contador, nao uma sequence.
  if (marca.proximaOsAntes !== null) {
    await prisma.contadorEmpresa.updateMany({ where: { empresaId }, data: { proximaOs: marca.proximaOsAntes } })
  }
  console.log(`faxina do e2e (${rotulo}): ${ordemIds.length} ordens, ${clienteIds.length} clientes, ${usuarioIds.length} usuarios e o que nasceu junto`)
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  exigirBancoLocal(process.env.DATABASE_URL)

  if (existsSync(MARCA)) {
    try {
      await limpar(JSON.parse(readFileSync(MARCA, 'utf8')) as Marca, 'rodada anterior interrompida')
    } catch (e) {
      console.warn('faxina do e2e: nao consegui limpar a rodada anterior —', e)
    }
    rmSync(MARCA, { force: true })
  }

  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const contador = await prisma.contadorEmpresa.findUnique({ where: { empresaId: empresa.id }, select: { proximaOs: true } })
  const marca: Marca = { inicio: new Date().toISOString(), empresaId: empresa.id, proximaOsAntes: contador?.proximaOs ?? null }
  writeFileSync(MARCA, JSON.stringify(marca), 'utf8')

  return async function globalTeardown(): Promise<void> {
    await limpar(marca, 'fim da rodada')
    rmSync(MARCA, { force: true })
    await prisma.$disconnect()
  }
}
