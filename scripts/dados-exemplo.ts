/**
 * DADOS DE EXEMPLO — para ver as telas povoadas, e para desfazer depois.
 *
 *   npm run exemplo:criar     cria
 *   npm run exemplo:remover   desfaz
 *
 * Por que existe: o banco de desenvolvimento tem as 18.443 ordens do sistema
 * ANTIGO (que só alimentam o Histórico e a Carteira) e quase nada do sistema
 * novo. Painel, Livro-caixa, Fila de trabalho e Fila de produção ficam vazios, e
 * tela vazia não se avalia.
 *
 * COMO ELE É REVERSÍVEL, que é a parte que importa: no início ele grava
 * `.dados-exemplo.json` com a hora de começo, a empresa e o contador de OS. O
 * removedor apaga tudo que nasceu DEPOIS daquela hora e devolve o contador ao
 * valor anterior. Não é adivinhação por nome nem lista de ids: é recorte de
 * tempo, dentro de uma janela em que só este script escreveu. É a mesma técnica
 * da faxina do e2e (`e2e/faxina.ts`), e pelo mesmo motivo.
 *
 * E ele passa pelas FUNÇÕES DO PRÓPRIO SISTEMA -- `criarOrdem`, `adicionarItem`,
 * `registrarRecebimento`, `registrarSaida` --, não por INSERT na mão. Assim o
 * preço é calculado pelo motor de verdade, o recebimento nasce colado ao
 * lançamento do caixa, a numeração sai do contador com trava, e o que você vê na
 * tela é exatamente o que o sistema produziria. Dado de mentira feito por INSERT
 * mente também sobre o comportamento.
 *
 * Os clientes são os REAIS, importados do legado: assim a Carteira, o "quem mais
 * comprou" do Painel e os links de cliente funcionam de verdade. Nenhum cadastro
 * novo é criado -- o que muda neles é a data da última compra, que volta sozinha
 * quando as ordens somem.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { criarOrdem, adicionarItem } from '../src/infra/ordens/repositorio'
import { registrarRecebimento, concluirOrdem } from '../src/infra/caixa/recebimentos'
import { registrarSaida } from '../src/infra/caixa/livro'
import type { Contexto } from '../src/infra/mutacoes/idempotencia'
import { MARCA, exigirBancoLocal } from './exemplo-marca'

exigirBancoLocal(process.env.DATABASE_URL)
if (existsSync(MARCA)) {
  console.error('Já existem dados de exemplo (a marca .dados-exemplo.json está aí).')
  console.error('Rode `npm run exemplo:remover` antes de criar outra leva.')
  process.exit(1)
}

const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' }, select: { id: true, contaRecebimentoId: true } })
if (!empresa.contaRecebimentoId) {
  console.error('Nenhuma conta recebe as vendas. Escolha uma no plano de contas antes.')
  process.exit(1)
}
const usuario = await prisma.usuario.findFirstOrThrow({ where: { empresaId: empresa.id, papel: 'administracao', ativo: true }, select: { id: true } })
const contador = await prisma.contadorEmpresa.findUniqueOrThrow({ where: { empresaId: empresa.id }, select: { proximaOs: true } })

const inicio = new Date()
writeFileSync(MARCA, JSON.stringify({
  inicio: inicio.toISOString(),
  empresaId: empresa.id,
  proximaOsAntes: contador.proximaOs,
}), 'utf8')

/** Cada chamada leva a própria chave: é assim que a idempotência do sistema espera ser usada. */
const ctx = (): Contexto => ({ empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() })

const HOJE = new Date()
const dia = (n: number): string => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Clientes reais, procurados pelo começo do nome. Se algum não estiver neste
 * banco, a ordem simplesmente sai como venda de balcão -- o script não quebra
 * por causa de um cadastro ausente.
 */
async function cliente(comeco: string): Promise<string | null> {
  const c = await prisma.cliente.findFirst({
    where: { empresaId: empresa.id, nome: { startsWith: comeco }, arquivadoEm: null },
    orderBy: { nome: 'asc' },
    select: { id: true },
  })
  return c?.id ?? null
}

type Item = [quantidade: number, descricao: string, valorUnitario: string, altura?: string, largura?: string]

async function ordem(dados: {
  cliente: string | null
  estado: 'aberta' | 'orcamento'
  prometida: string | null
  /** Há quantos dias a ordem foi aberta. */
  abertaHa: number
  itens: Item[]
}): Promise<{ id: string; versao: number; numero: number }> {
  const clienteId = dados.cliente ? await cliente(dados.cliente) : null
  const o = await criarOrdem(ctx(), { estado: dados.estado, clienteId, prometidaPara: dados.prometida })
  let versao = o.versao
  for (const [quantidade, descricao, valorUnitario, altura, largura] of dados.itens) {
    const r = await adicionarItem(ctx(), o.id, versao, {
      descricao, materialId: null, quantidade,
      altura: altura ?? null, largura: largura ?? null,
      unidadeCobranca: altura && largura ? 'm2' : 'unidade',
      valorUnitario,
    })
    versao = r.versao
  }
  // `abertaEm` não é parâmetro de `criarOrdem` -- e não deve ser, porque no uso
  // real a ordem nasce agora. Aqui ela é recuada depois, só para o Painel ter
  // barras em mais de um mês e a fila ter idades diferentes.
  if (dados.abertaHa > 0) {
    const quando = new Date(HOJE)
    quando.setDate(quando.getDate() - dados.abertaHa)
    await prisma.ordemServico.update({ where: { id: o.id }, data: { abertaEm: quando } })
  }
  return { id: o.id, versao, numero: o.numero }
}

const FORMAS = ['pix', 'dinheiro', 'cartao_debito', 'transferencia', 'cartao_credito'] as const

console.log('criando ordens em produção...')

/* NA BANCADA AGORA: é a Fila de produção, e o que alimenta "em aberto" no Painel. */
const emProducao: { cliente: string | null; prometida: string | null; abertaHa: number; itens: Item[] }[] = [
  { cliente: 'PREFEITURA MUN/ UNAI SAUDE', prometida: dia(-3), abertaHa: 12, itens: [
    [12, 'PLACA ACM BRANCO COM ADESIVO IMPRESSO', '61.00', '0.61', '0.40'],
    [2, 'FAIXA LONA COM ILHOS', '45.00', '3.00', '0.80'] ] },
  { cliente: 'SINDICATO DOS PRODUTORES', prometida: dia(-1), abertaHa: 9, itens: [
    [1, 'LETRA CAIXA PVC EXPANDIDO 10MM PINTADA', '380.00', '2.40', '0.35'] ] },
  { cliente: 'MAPA CONSTRUTORA', prometida: dia(0), abertaHa: 4, itens: [
    [6, 'PLACA DE OBRA EM LONA COM ESTRUTURA', '190.00', '2.00', '1.00'],
    [6, 'ADESIVO VINIL RECORTE ELETRONICO', '35.00'],
    [1, 'INSTALACAO NO LOCAL', '250.00'] ] },
  { cliente: 'UNAI LEILOES', prometida: dia(0), abertaHa: 2, itens: [
    [30, 'CRACHA PVC IMPRESSO FRENTE E VERSO', '9.50'] ] },
  { cliente: 'AGRORESERVAS DO BRASIL', prometida: dia(1), abertaHa: 3, itens: [
    [2, 'BANNER LONA 440G IMPRESSO', '55.00', '1.20', '0.80'] ] },
  { cliente: null, prometida: dia(2), abertaHa: 1, itens: [
    [1, 'ADESIVO RECORTE PARA PORTA DE VIDRO', '120.00', '2.10', '0.90'] ] },
  { cliente: 'PREFEITURA MUNICIPAL DE URUANA', prometida: dia(4), abertaHa: 6, itens: [
    [4, 'TOTEM PVC EXPANDIDO COM BASE METALICA', '420.00', '1.80', '0.60'] ] },
  { cliente: 'CONTROL UNION', prometida: dia(5), abertaHa: 5, itens: [
    [8, 'PLACA SINALIZACAO INTERNA PS 2MM', '28.00', '0.30', '0.20'],
    [8, 'FITA DUPLA FACE 3M', '6.50'] ] },
  { cliente: 'CLIENTE DIVERSOS', prometida: null, abertaHa: 21, itens: [
    [1, 'PORTEIRA COM LOGO PINTADO A MAO', '900.00', '4.00', '1.50'] ] },
  { cliente: null, prometida: null, abertaHa: 15, itens: [
    [3, 'PAINEL LONA PARA FORMATURA', '160.00', '3.00', '2.00'] ] },
]
for (const o of emProducao) await ordem({ ...o, estado: 'aberta' })

console.log('criando ordens entregues e pagas...')

/* ENTREGUES E PAGAS: é o que dá movimento ao Livro-caixa, ao faturamento do
 * Painel mês a mês e à aba "sistema novo" do Histórico. Espalhadas por cinco
 * meses para o gráfico ter mais de uma barra. */
const pagas: { cliente: string | null; abertaHa: number; itens: Item[] }[] = [
  { cliente: 'PREFEITURA MUN/ UNAI SAUDE', abertaHa: 128, itens: [[20, 'PLACA DE IDENTIFICACAO DE SALA EM ACM', '48.00', '0.30', '0.15']] },
  { cliente: 'MAPA CONSTRUTORA', abertaHa: 112, itens: [[2, 'PLACA DE OBRA 2X1 EM LONA', '210.00', '2.00', '1.00']] },
  { cliente: 'UNAI LEILOES', abertaHa: 96, itens: [[1, 'BACKDROP IMPRESSO COM ESTRUTURA', '1250.00', '3.00', '2.40']] },
  { cliente: 'AGRORESERVAS DO BRASIL', abertaHa: 74, itens: [[6, 'ADESIVO PARA FROTA RECORTADO', '95.00']] },
  { cliente: 'SINDICATO DOS PRODUTORES', abertaHa: 58, itens: [[1, 'FACHADA EM ACM COM LETRA CAIXA', '3400.00', '6.00', '1.20']] },
  { cliente: 'CONTROL UNION', abertaHa: 41, itens: [[40, 'CRACHA PVC COM CORDAO', '11.00']] },
  { cliente: null, abertaHa: 27, itens: [[1, 'PLACA DE ENDERECO RESIDENCIAL', '180.00', '0.50', '0.30']] },
  { cliente: 'PREFEITURA MUNICIPAL DE URUANA', abertaHa: 14, itens: [[10, 'PLACA DE TRANSITO REFLETIVA', '165.00', '0.60', '0.60']] },
]
for (const [i, p] of pagas.entries()) {
  const o = await ordem({ ...p, estado: 'aberta', prometida: null })
  const total = await prisma.ordemServico.findUniqueOrThrow({ where: { id: o.id }, select: { precoFinal: true } })
  await registrarRecebimento(ctx(), o.id, o.versao, {
    valor: total.precoFinal.toFixed(2),
    forma: FORMAS[i % FORMAS.length] as string,
    // Recebida no dia em que o serviço saiu: alguns dias depois de aberta.
    data: dia(-(p.abertaHa - 3)),
    concluir: true,
  })
}

console.log('criando ordens entregues e ainda não pagas...')

/* ENTREGUES E NÃO PAGAS: é o "A receber" do Painel e o bloco "Concluídas e não
 * pagas" da Fila de trabalho -- o problema que derrubou o sistema antigo. */
const aCobrar: { cliente: string | null; abertaHa: number; parcial: string | null; itens: Item[] }[] = [
  { cliente: 'PREFEITURA MUN/ UNAI SAUDE', abertaHa: 38, parcial: null, itens: [[15, 'PLACA DE SINALIZACAO EM PVC', '72.00', '0.40', '0.25']] },
  { cliente: 'CLIENTE DIVERSOS', abertaHa: 22, parcial: '300.00', itens: [[1, 'PAINEL DE LED PARA VITRINE', '1800.00']] },
  { cliente: 'MAPA CONSTRUTORA', abertaHa: 9, parcial: null, itens: [[3, 'ADESIVO DE OBRA EM VINIL', '140.00', '1.00', '0.70']] },
]
for (const a of aCobrar) {
  const o = await ordem({ ...a, estado: 'aberta', prometida: null })
  if (a.parcial) {
    // Pagou uma entrada e ficou devendo: é a linha "Falta R$ ..." da lista de ordens.
    await registrarRecebimento(ctx(), o.id, o.versao, { valor: a.parcial, forma: 'pix', data: dia(-(a.abertaHa - 2)), concluir: true })
  } else {
    await concluirOrdem(ctx(), o.id, o.versao)
  }
}

console.log('criando orçamentos...')

/* ORÇAMENTOS: esperando aprovação. Aparecem no Painel e no filtro de Ordens. */
for (const orc of [
  { cliente: 'AGRORESERVAS DO BRASIL', abertaHa: 5, itens: [[1, 'COMUNICACAO VISUAL COMPLETA DA LOJA', '8500.00']] as Item[] },
  { cliente: 'UNAI LEILOES', abertaHa: 2, itens: [[25, 'PLACA DE LEILAO EM PVC', '38.00', '0.40', '0.30']] as Item[] },
  { cliente: null, abertaHa: 1, itens: [[1, 'ORCAMENTO DE FACHADA A COMBINAR', '2200.00']] as Item[] },
]) {
  await ordem({ ...orc, estado: 'orcamento', prometida: null })
}

console.log('lançando saídas do caixa...')

/* SAÍDAS: sem elas o Livro-caixa só tem entrada, o saldo do Painel fica igual ao
 * faturado e "por onde o dinheiro saiu" fica vazio. Espalhadas pelas contas de
 * despesa que vieram do plano do legado. */
const contas = await prisma.contaPlano.findMany({
  where: { empresaId: empresa.id, tipo: 'despesa', ativa: true },
  orderBy: { codigo: 'asc' },
  select: { id: true, nome: true },
})
const contaDe = (nome: string) => contas.find((c) => c.nome.startsWith(nome)) ?? contas[0]

const saidas: [nome: string, historico: string, valor: string, diasAtras: number, fornecedor: string][] = [
  ['Material de impressão', 'Bobina de lona 440g', '1850.00', 118, 'Distribuidora Alfa'],
  ['Chapas e placas', 'Chapas de ACM branco', '3200.00', 110, 'Metal Center'],
  ['Aluguel', 'Aluguel do galpão', '2400.00', 92, 'Imobiliária Central'],
  ['Energia elétrica', 'Conta de luz', '780.00', 90, 'CEMIG'],
  ['Material de impressão', 'Tinta e cartuchos', '640.00', 76, 'Distribuidora Alfa'],
  ['Frete e combustível', 'Combustível das entregas', '420.00', 62, 'Posto Unaí'],
  ['Aluguel', 'Aluguel do galpão', '2400.00', 61, 'Imobiliária Central'],
  ['Serviços de terceiros', 'Instalação em altura', '900.00', 48, 'Equipe terceirizada'],
  ['Energia elétrica', 'Conta de luz', '812.00', 45, 'CEMIG'],
  ['Chapas e placas', 'PVC expandido 10mm', '1560.00', 33, 'Metal Center'],
  ['Aluguel', 'Aluguel do galpão', '2400.00', 31, 'Imobiliária Central'],
  ['Internet e telefone', 'Internet da loja', '260.00', 30, 'Provedor local'],
  ['Frete e combustível', 'Combustível das entregas', '385.00', 18, 'Posto Unaí'],
  ['Material de impressão', 'Vinil adesivo', '1120.00', 12, 'Distribuidora Alfa'],
  ['Água', 'Conta de água', '190.00', 8, 'COPASA'],
]
for (const [nome, historico, valor, diasAtras, fornecedor] of saidas) {
  const conta = contaDe(nome)
  if (!conta) continue
  await registrarSaida(ctx(), {
    valor, data: dia(-diasAtras), historico, contaId: conta.id,
    fornecedor, parcela: '1', totalParcelas: '1',
  })
}

const criadas = await prisma.ordemServico.count({ where: { empresaId: empresa.id, criadoEm: { gte: inicio } } })
console.log('')
console.log(`pronto: ${criadas} ordens e ${saidas.length} saídas de caixa.`)
console.log('para desfazer: npm run exemplo:remover')
await prisma.$disconnect()
