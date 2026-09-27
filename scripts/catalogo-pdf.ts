// Uso: npm run catalogo:pdf [-- --html caminho.html]
//
// Le docs/precificacao/catalogo-materiais.csv e gera o PDF do catalogo de materiais.
// O CSV e a fonte da verdade: quando a dona da empresa devolver os precos, edita-se o
// CSV e roda-se isto de novo. Nao toca no banco -- cadastrar material sem preco deixaria
// ordem saindo a zero, e `validarComum` aceita zero de proposito (item de cortesia).
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const CSV = 'docs/precificacao/catalogo-materiais.csv'
const PDF = 'docs/precificacao/catalogo-materiais.pdf'

type Coluna =
  | 'familia' | 'categoria' | 'nome' | 'variacao' | 'espessura_mm' | 'gramatura_g' | 'trama'
  | 'largura_mm' | 'comprimento_mm' | 'area_m2' | 'unidade_cobranca' | 'custo_rs' | 'venda_rs'
  | 'status' | 'origem' | 'observacao'
type Linha = Record<Coluna, string>

function lerCsv(caminho: string): Linha[] {
  // BOM fora antes de tudo: ele gruda no nome da primeira coluna e quebra o acesso por chave.
  const bruto = readFileSync(caminho, 'utf8').replace(/^﻿/, '')
  const linhas = bruto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const cabecalho = (linhas[0] ?? '').split(';')
  return linhas.slice(1).map((l) => {
    const campos = l.split(';')
    return Object.fromEntries(cabecalho.map((c, i) => [c, campos[i] ?? ''])) as Linha
  })
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const metros = (mm: string) => (Number(mm) / 1000).toFixed(2).replace('.', ',')
const centimetros = (mm: string) => String(Number(mm) / 10).replace('.', ',')

/** A lista mistura unidades: chapa e bobina em metros, produto pronto em centimetros. */
function medida(l: Linha): string {
  if (!l.largura_mm || !l.comprimento_mm) return '—'
  return l.familia === 'Produto pronto'
    ? `${centimetros(l.largura_mm)} × ${centimetros(l.comprimento_mm)} cm`
    : `${metros(l.largura_mm)} × ${metros(l.comprimento_mm)} m`
}

/** Espessura, gramatura e trama numa coluna so -- cada familia usa uma delas. */
function especificacao(l: Linha): string {
  const partes = [
    l.espessura_mm ? `${l.espessura_mm}mm` : '',
    l.gramatura_g ? `${l.gramatura_g}g` : '',
    l.trama ? `trama ${l.trama}` : '',
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : '—'
}

/** A observacao aponta as perguntas que resolvem a linha; a tabela so mostra os numeros. */
function duvidas(l: Linha): string {
  return [...l.observacao.matchAll(/duvida (\d+)/g)].map((m) => m[1] ?? '').join(', ')
}

const COBRANCA: Record<string, string> = {
  m2: 'por m²',
  unidade: 'por unidade',
  metro_linear: 'por metro linear',
}

function tabela(linhas: Linha[]): string {
  const corpo = linhas
    .map((l) => {
      const suposta = l.status === 'a confirmar'
      return `<tr${suposta ? ' class="suposta"' : ''}>
<td>${esc(l.nome)}${suposta ? ' <span class="marca">deduzido</span>' : ''}</td>
<td>${esc(medida(l))}</td>
<td>${esc(especificacao(l))}</td>
<td class="numero">${l.area_m2 ? esc(l.area_m2) : '—'}</td>
<td>${esc(COBRANCA[l.unidade_cobranca] ?? l.unidade_cobranca)}</td>
<td class="preencher"></td>
<td class="preencher">${esc(l.venda_rs)}</td>
<td class="numero ver">${duvidas(l)}</td>
</tr>`
    })
    .join('\n')
  return `<table class="itens">
<thead><tr>
<th>Material</th><th>Medida</th><th>Especificação</th><th class="numero">Área m²</th>
<th>Cobrança</th><th class="preencher">Custo R$</th><th class="preencher">Venda R$</th><th class="numero">Ver</th>
</tr></thead>
<tbody>
${corpo}
</tbody>
</table>`
}

const COMO_LER: [string, string][] = [
  ['As espessuras soltas herdam a linha de cima.', 'Depois de “PVC expandido 5mm 1,22 × 2,44” vieram só “10mm”, “15mm”, “20mm”, “30mm” — material e medida da chapa vêm da primeira linha. O mesmo vale para o acrílico e para a lona.'],
  ['As medidas estão em duas unidades.', 'Chapa e bobina em metros (1,22 × 5; 1 × 2; 3,20 × 50); produto pronto em centímetros (estojo 25 × 18, placa 40 × 60).'],
  ['O apóstrofo é vírgula decimal.', '“250’00” é R$ 250,00 e “0’70 × 50” é a bobina de 0,70 m — o teclado do celular trocou a vírgula.'],
  ['Os dois números antes da medida da lona são a trama do tecido.', '“Lona 440gr brilho 500 × 500 3,20mts × 50mts”: o 500 × 500 é o fio, e é assim que o mercado especifica lona. Falta confirmar (pergunta 12).'],
  ['“Aí vem lona fosca / nas mesmas largura” é dado, não conversa.', 'Manda repetir na fosca as oito larguras da brilho. As oito linhas estão na tabela, marcadas como deduzidas.'],
  ['Toda bobina tem 50 m.', 'Sem exceção, em lona e em adesivo. O que muda é a largura — e é a largura que decide o aproveitamento e a sobra.'],
]

const INCONSISTENCIAS: [string, string][] = [
  ['Os dois ACM são iguais e têm preços diferentes.', 'Mesma medida (1,22 × 5), R$ 250,00 e R$ 265,00. Nada na lista diz o que separa um do outro.'],
  ['O acrílico preto pulou o 6mm.', 'O cristal tem 2, 3, 4, 5, 6, 8 e 10. O preto tem 2, 3, 4, 5, 8 e 10.'],
  ['O adesivo aparece como 1,26 e como 1,27.', 'O brilho veio 1,26; o fosco e o transparente, 1,27. Quase certamente é a mesma bobina escrita de dois jeitos.'],
  ['A lona 280g só aparece em 3,20.', 'A 440g tem oito larguras. Não dá para saber se a 280g só existe em 3,20 ou se a lista parou ali.'],
  ['“Placa alumínio 6.32” tem um número sem unidade.', 'O 6.32 não se repete em nenhum outro item da lista e não é espessura plausível para placa.'],
  ['“01 acm” abre as duas linhas de ACM e some.', 'Provável numeração de item que não teve continuação.'],
]

const PERGUNTAS: [string, string[]][] = [
  ['Preço — o maior buraco', [
    'Dos 82 itens da lista, só os dois ACM vieram com preço. O resto a senhora passa por m² e por peça? Prefere preencher na própria lista que está aqui?',
    'Os R$ 250,00 e R$ 265,00 são o preço de venda ao cliente ou o custo de compra da chapa?',
    'Esse preço do ACM é só o material, ou já inclui corte, serviço e instalação?',
  ]],
  ['ACM', [
    'As duas linhas de ACM 1,22 × 5 têm a mesma medida e preços diferentes (250 e 265). O que muda entre elas — espessura, cor, marca, fornecedor?',
    'O ACM só existe em 1,22 × 5? E quais cores a senhora trabalha?',
  ]],
  ['PVC expandido', [
    'Todas as espessuras (5, 10, 15, 20 e 30mm) são em chapa 1,22 × 2,44?',
    'Sai em quais cores?',
  ]],
  ['Acrílico', [
    'O preto tem 6mm? O cristal tem, e o preto pulou essa espessura na lista.',
    'O “cristal” é extrudado ou cast? O preço muda em relação ao cast branco?',
    'Vermelho e verde só existem em 3mm? E o espelhado dourado e prata, só em 2mm?',
    'A chapa de acrílico é sempre 1,00 × 2,00 m?',
  ]],
  ['Lona', [
    'Os números antes da medida — “500 × 500”, “1000 × 1000” — são a trama do tecido? A 280g fosca ficou 1000 × 1000 e a 440g ficou 500 × 500; está certo assim?',
    'A lona 280g (brilho e fosca) existe nas mesmas oito larguras da 440g, ou só em 3,20?',
    'Confirmando as oito larguras da 440g: 3,20 · 2,20 · 1,80 · 1,60 · 1,50 · 1,20 · 1,00 · 0,70 — todas com 50 m.',
    'O preço por m² muda conforme a largura da bobina, ou é o mesmo preço e a largura só serve para aproveitar melhor? Se for o mesmo preço, essas 32 linhas de lona viram 4.',
  ]],
  ['Adesivo', [
    'O “0.10” do vinil de impressão é a espessura? Vale também para o fosco e para o perfurado?',
    'A largura do brilho é 1,26 ou 1,27?',
    'O transparente só existe em 1,27?',
  ]],
  ['Acabamento de lona', [
    'Ilhós, solda eletrônica e bastão com corda e ponteira: a senhora cobra por peça pronta, por metro, por ilhós — ou isso já está no preço da lona?',
  ]],
  ['Produtos prontos', [
    'No estojo aveludado, o preço é do conjunto (estojo mais placa) ou cada um separado? E a placa é de que material?',
    'Troféu e medalha de acrílico: em que tamanhos? O preço muda por tamanho?',
    'Na “placa alumínio 6.32 40 × 60”, o que é o 6.32?',
    'Nas placas de inox e de alumínio, a gravação já está no preço da placa?',
    'Metalon: cobra por metro da barra? Qual bitola a senhora usa? Solda e pintura entram à parte?',
  ]],
  ['Regras gerais — refinam, não travam', [
    'Existe valor mínimo de cobrança, tipo mínimo de 1 m² por trabalho?',
    'A senhora arredonda a medida do cliente para cima? De quanto em quanto?',
    'A sobra da bobina, quando o trabalho não fecha a largura, entra no preço do cliente?',
    'Arte e layout são cobrados à parte?',
    'Instalação é cobrada à parte?',
    'Caneca e os outros brindes têm preço por quantidade (1, 10, 50)?',
    'A laminação do adesivo é vendida à parte?',
    'Ficou faltando algum material que a empresa trabalha — lona backlight ou blackout, vinil de recorte colorido, ferragem?',
  ]],
]

const CSS = `
@page { size: A4 portrait; margin: 12mm 12mm 14mm; }
:root { --tinta: #111; --fraca: #555; --linha: #999; --faixa: #f0f0f0; --alerta: #7a4a00; }
* { box-sizing: border-box; }
body {
  margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-variant-numeric: tabular-nums;
  color: var(--tinta); background: #fff; font-size: 9.5pt; line-height: 1.4;
}
h1 { margin: 0; font-size: 20pt; font-weight: 700; letter-spacing: -0.01em; }
h2 {
  margin: 7mm 0 2.5mm; font-size: 12pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; border-bottom: 1px solid var(--tinta); padding-bottom: 1mm;
  break-after: avoid;
}
h3 { margin: 4mm 0 1.5mm; font-size: 10pt; font-weight: 600; color: var(--fraca); break-after: avoid; }
p { margin: 0 0 2mm; }
.capa { border-bottom: 2px solid var(--tinta); padding-bottom: 3mm; }
.capa .fonte { font-size: 9pt; color: var(--fraca); margin-top: 1.5mm; }
.aviso {
  margin: 3mm 0 0; padding: 2.5mm 3mm; background: var(--faixa); border-left: 3px solid var(--alerta);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; break-inside: avoid;
}
.aviso strong { color: var(--alerta); }
dl.notas { margin: 0; }
dl.notas dt { font-weight: 600; margin-top: 2.5mm; }
dl.notas dd { margin: 0; color: var(--fraca); }
dl.notas dt:first-child { margin-top: 0; }
.itens { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
.itens th, .itens td { padding: 1.3mm 1.6mm; vertical-align: top; text-align: left; }
.itens thead { display: table-header-group; }
.itens thead th {
  border-bottom: 1px solid var(--tinta); font-size: 8pt; text-transform: uppercase;
  letter-spacing: .04em; white-space: nowrap;
}
.itens tbody tr { break-inside: avoid; }
.itens tbody td { border-bottom: 1px solid #ddd; }
.itens .numero { text-align: right; white-space: nowrap; }
/* Medida e especificacao inteiras numa linha so: quebradas, empurram a marca
 * "deduzido" para baixo e a linha da tabela dobra de altura. */
.itens td:nth-child(2), .itens td:nth-child(3) { white-space: nowrap; }
.itens .ver { color: var(--fraca); font-size: 8.5pt; }
.itens .preencher {
  background: #fffbe6; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  min-width: 17mm; text-align: right; white-space: nowrap;
}
.itens .suposta td { color: var(--fraca); background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.itens .suposta .preencher { background: #fdf8e3; }
.marca {
  font-size: 7pt; text-transform: uppercase; letter-spacing: .05em; color: var(--alerta);
  border: 1px solid var(--alerta); border-radius: 2px; padding: 0 1mm; white-space: nowrap;
}
ol.perguntas { margin: 0 0 3mm; padding-left: 6mm; }
ol.perguntas li { margin-bottom: 1.5mm; break-inside: avoid; }
.bloco-perguntas { break-inside: avoid; }
.rodape { margin-top: 8mm; padding-top: 2mm; border-top: 1px solid var(--linha); font-size: 8.5pt; color: var(--fraca); }
`

function montarHtml(linhas: Linha[]): string {
  const comPreco = linhas.filter((l) => l.venda_rs !== '').length
  const supostas = linhas.filter((l) => l.status === 'a confirmar').length
  const hoje = new Date().toLocaleDateString('pt-BR')

  // Uma secao por familia, e dentro dela uma tabela por categoria -- e a categoria
  // que o sistema usa para juntar as variacoes do mesmo material na tela da ordem.
  const familias = [...new Set(linhas.map((l) => l.familia))]
  const secoes = familias
    .map((familia) => {
      const daFamilia = linhas.filter((l) => l.familia === familia)
      const categorias = [...new Set(daFamilia.map((l) => l.categoria))]
      const blocos = categorias
        .map((c) => `<h3>${esc(c)}</h3>\n${tabela(daFamilia.filter((l) => l.categoria === c))}`)
        .join('\n')
      return `<section><h2>${esc(familia)} <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--fraca)">· ${daFamilia.length} itens</span></h2>\n${blocos}</section>`
    })
    .join('\n')

  const notas = (pares: [string, string][]) =>
    `<dl class="notas">${pares.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`

  let n = 0
  const perguntas = PERGUNTAS.map(
    ([titulo, itens]) =>
      `<div class="bloco-perguntas"><h3>${esc(titulo)}</h3><ol class="perguntas" start="${n + 1}">${itens
        .map((p) => {
          n += 1
          return `<li>${esc(p)}</li>`
        })
        .join('')}</ol></div>`,
  ).join('\n')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Catálogo de materiais — DruSign</title>
<style>${CSS}</style></head><body>
<header class="capa">
  <h1>Catálogo de materiais</h1>
  <div class="fonte">Levantado a partir das mensagens de 14/09/2026 · ${linhas.length} itens · gerado em ${hoje}</div>
</header>

<div class="aviso">
  <strong>Faltam os preços.</strong> De ${linhas.length} itens, ${comPreco} vieram com preço — os dois ACM.
  A lista diz <em>o que a empresa vende</em>, com as medidas de cada coisa; o quanto custa ainda não foi passado.
  As colunas de custo e venda estão em amarelo, prontas para preencher.
  As ${supostas} linhas em cinza não foram ditas: foram deduzidas da lista e precisam de confirmação.
  A última coluna de cada tabela aponta a pergunta que resolve aquela linha.
</div>

<section><h2>Como ler esta lista</h2>${notas(COMO_LER)}</section>

${secoes}

<section><h2>O que não fecha</h2>${notas(INCONSISTENCIAS)}</section>

<section><h2>Pontos a confirmar</h2>
<p>As perguntas estão na ordem das dúvidas citadas nas tabelas: o número da coluna “Ver” é o número da pergunta.</p>
${perguntas}
</section>

<div class="rodape">DruSign · catalogo-materiais.csv é a fonte deste documento — alterou o CSV, rode <code>npm run catalogo:pdf</code> de novo.</div>
</body></html>`
}

async function main(): Promise<void> {
  const linhas = lerCsv(CSV)
  const html = montarHtml(linhas)

  const saidaHtml = process.argv.indexOf('--html')
  if (saidaHtml !== -1) {
    const destino = process.argv[saidaHtml + 1]
    if (destino) writeFileSync(destino, html, 'utf8')
  }

  const navegador = await chromium.launch()
  try {
    const pagina = await navegador.newPage()
    await pagina.setContent(html, { waitUntil: 'load' })
    await pagina.emulateMedia({ media: 'print' })
    // O CSS de impressao leva um tempo para recalcular; medir ou imprimir antes disso mente.
    await pagina.waitForTimeout(1000)
    await pagina.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await navegador.close()
  }

  const comPreco = linhas.filter((l) => l.venda_rs !== '').length
  console.log(`${PDF}: ${linhas.length} itens, ${comPreco} com preco, ${linhas.length - comPreco} a preencher`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
