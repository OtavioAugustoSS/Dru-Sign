# Fase 3 — Ordem de serviço: entrada assistida, itens, acréscimos, ajuste de preço e impresso

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela mais importante do sistema: abrir uma ordem, digitar `12 placas ACM 61x40 61,00` e ver o item estruturado com o total; itens nas três formas de cobrança, acréscimos, preço calculado e preço final com ajuste registrado, aprovação de orçamento, cancelamento com motivo, e o impresso A4 — reproduzindo a OS 18449 do legado (seis itens de ACM somando R$ 2.528,00).

**Architecture:** Cada mutação da ordem é **uma Server Action** que roda numa transação interativa: grava, recompõe `preco_calculado`/`preco_final` com o `comporOrdem` da 1A, incrementa `versao` (trava otimista) e registra a chave de idempotência na tabela `mutacao`. Tabela de itens e painel de totais são Server Components: a action chama `revalidatePath` e a rota volta re-renderizada na mesma resposta — o cliente nunca soma dinheiro. O único estado no navegador é o texto sendo digitado e o preview, calculado pelo domínio puro rodando no cliente. Sem sucesso otimista: o campo só é limpo depois do commit.

**Tech Stack:** o mesmo. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 4, 5, 6, 7 — telas 2, 3 e 7 —, 9 e 13)

## Global Constraints

- Dinheiro em `Decimal` no domínio, `numeric(12,4)` no banco, **string decimal** na fronteira cliente→action (`'61.00'`); nunca `Number(prismaDecimal)`.
- Nada em `src/domain/` importa framework, banco ou infra (trava de pureza).
- **Nada de `DELETE`** em dado de negócio: item e acréscimo removidos ganham `removido_em` (uma ordem aberta pode já ter sido impressa e entregue); ordem cancela com motivo e preserva tudo.
- `preco_calculado` recalculado e persistido a cada alteração, na mesma transação; `preco_final` não é sobrescrito quando há ajuste manual — a tela avisa a divergência (spec, seção 5).
- Toda mutação carrega `versao` (trava otimista) e chave de idempotência (spec, seção 9). Sem sucesso otimista em dinheiro.
- Toda tabela carrega `empresa_id`. Numeração continua em **18461**, por empresa, sem buraco.
- Nenhum modal na tela de ordem; teclado primeiro (spec, seção 7).
- TypeScript 7 (sem `baseUrl`; `it.each` declara todos os elementos); Postgres local sem shadow: migrar com `npm run db:migrar -- <nome>`; comandos de shell curtos; arquivo com barra dupla nunca sai de heredoc.

## O que este plano decide (pesquisa de 4 agentes + crítico, 28/08/2026)

| Decisão | Escolha | Por quê |
|---|---|---|
| Arquitetura dos itens | uma Server Action por mutação, transação interativa, `revalidatePath('/ordens/<id>')`, tabela e painel como Server Components | os três invariantes (preço persistido, sem otimismo, trava) são naturais aqui; a `versao` vem sempre das props (a rota é re-renderizada na mesma resposta); Server Actions são despachadas em série por cliente |
| Idempotência | tabela `mutacao` (`empresa_id`, `chave` única, `acao`, `resposta` JSON); INSERT no **início** da transação, UPDATE do `resposta` no fim; chave `crypto.randomUUID()` gerada no cliente por tentativa e renovada só após resposta do servidor | o INSERT toma o lock antes do trabalho; um retry concorrente bloqueia e cai em P2002 com o resultado já gravado |
| Número da OS | tabela `contador_empresa` (`proxima_os`), `update { increment: 1 }` dentro da transação que cria a ordem; seed semeia 18461 | `TRUNCATE RESTART IDENTITY` do harness zeraria uma sequence; sequence pula número em rollback; multi-empresa pronto |
| Remoção de item/acréscimo | soft delete (`removido_em`, `removido_por_id`), permitida em `orcamento`/`aberta`, recusada no servidor em `concluida`/`cancelada`; filtro numa constante `VIVOS` | regra da spec é literal; um teste de integração prova que o removido não entra no preço |
| Cliente na ordem | snapshot `cliente_nome`/`cliente_apelido`/`cliente_telefone` copiado na criação e na troca; `cliente_id` continua para a ficha | impresso e histórico não mudam quando o cadastro muda; balcão com nome avulso cabe |
| Unidade do item | material do catálogo → unidade do material; sem material → **`unidade`**; sufixo `/un` `/m2` `/ml` ou o `<select>` vencem; altura/largura gravadas sempre que informadas | a OS 18449 e a spec (`R$ 61,00/un`) cobram por unidade com a medida como descrição; a sugestão `m2` do parser da 1A **não** é o padrão |
| Sufixo `CD <total>` do legado | removido antes do parser e usado como conferência no preview | a Odete digita como sempre digitou; o parser pegaria o total como unitário |
| Ajuste e aprovação | `preco_calculado_no_ajuste` persistido; aviso = `ajustado_por_id != null && preco_calculado != preco_calculado_no_ajuste`, com "Manter" e "Usar o calculado"; aprovar grava `aprovado_em` e `preco_aprovado` (não vira ajuste) | o aviso precisa sobreviver a reload; aprovar não pode rotular a ordem como "ajustada" |
| Estado inicial | escolhido em `/ordens/nova` (dois botões: Ordem de serviço / Orçamento), sem `@default` | regra da spec: nenhum valor de fábrica que ninguém troca |
| Erros nas actions | `{ ok: false }` só para `ConflitoVersao`, `OrdemNaoEditavel` e `ErroDeValidacao`; o resto estoura para o `error.tsx` | falha de banco nunca pode parecer resposta normal |
| Datas | `@db.Date` formatado com getters UTC; `timestamptz` com `Intl` em `America/Sao_Paulo` | na Vercel o servidor é UTC |
| Testes | domínio puro em node; integração contra o banco (gabarito 18449); e2e Playwright (cria a ordem pela interface, digita as seis linhas do legado, confere 2.528,00, segundo Enter sem conflito, conflito real); **sem jsdom** | o que pode falhar (RSC após action em transition, foco, dispatch em série) só aparece no navegador |
| Escopo | `/ordens` (lista), `/ordens/nova`, `/ordens/[id]`, `/ordens/[id]/impresso` (1 via, `?vias=2`) | edição inline, reordenação, desfazer, mini-cadastro de cliente inline, parser de data `+7`, percentual, `LogAuditoria`, "Concluir e receber" (Fase 4) e anexo (Fase 6) ficam fora |

**Decisões do dono a registrar (não bloqueiam):** placas ACM devem entrar no catálogo **por unidade** (é como a loja cobra: 407/407 no legado); `responsavel` nasce com o usuário logado (pré-seleção com significado); itens continuam editáveis em `aberta` depois de aprovado; o artboard mostra "área · 2,88 m²" em itens cobrados por unidade — a tela segue os números, não o rótulo; confirmar a impressora do balcão (laser/jato; matricial não imprime HTML).

**Fatos do legado usados aqui:** próxima OS é 18461 (máximo atual 18460). A OS 18449 tem seis linhas em `OBS1..OBS6`, todas com preço por unidade: `06 PLACAS ACM 60X 80 … 120,50 CD 723,00`, `01 PLACA ACM 50 X 50 … 62,00`, `03PLACAS ACM 51X 61 … 76,00 CD 228,00`, `12 PLACAS ACM 61 X 40 … 61,00 CD 732,00`, `06PLACAS ACM 61 X 61 … 93,00 CD 558,00`, `03 PLACAS 50 X 60 … 75,00 CD 225,00` → total 2.528,00. O impresso do legado (`DOT4_001.PRN`): cabeçalho DRUSIGN + CNPJ 05.348.499/0001-46, "ORDEM DE SERVICO nº · Hora · Data", cliente com contato e telefone, "Observacoes Gerais", rodapé "Sempre guarde esse comprovante como sua garantia de entrega!", "Responsável:", "VALOR PRODUTOS R$".

---

### Task 1: Domínio — valores como string, resolução da linha, permissões e formatadores do impresso

**Files:**
- Modify: `src/domain/precificacao/tipos.ts`, `src/domain/precificacao/formulas.ts`, `src/domain/precificacao/ordem.ts`, `src/domain/ordem/estados.ts`
- Create: `src/domain/precificacao/erros.ts`, `src/domain/precificacao/resolucao.ts`, `src/domain/ordem/datas.ts`, `src/domain/ordem/impresso.ts`
- Test: `src/domain/precificacao/resolucao.test.ts`, `src/domain/ordem/estados.test.ts` (acrescenta), `src/domain/ordem/datas.test.ts`, `src/domain/ordem/impresso.test.ts`

**Interfaces:**
- Produces:
  - `type ValorNumerico = number | string` em `ItemCobranca.valorUnitario/altura/largura`, `Acrescimo.valor`, `comporOrdem(…, precoFinalManual?: ValorNumerico)`
  - `class ErroDeValidacao extends Error` — lançada por `calcularItem`/`comporOrdem` (mensagens inalteradas)
  - `resolverLinha(texto, catalogo, opcoes?): LinhaResolvida` (`{ tipo: 'item', quantidade, descricao, material, candidatos, altura?, largura?, unidade, origemUnidade, valorUnitario?, valorDoCatalogo, totalDigitado?, pendencias }` ou `{ tipo: 'acrescimo', tipoAcrescimo, descricao, valor?, pendencias }`), `descreverLinha(r): { texto; total: string | null; conferencia: 'ok' | 'diverge' | null }`, `lerMedida`, `proximaUnidade`, `MaterialCatalogo`
  - `permissoes(estado): PermissoesOrdem`, `ROTULO_ESTADO`, `ajusteDesatualizado(...)`
  - `formatarDataCalendario(d)` (UTC, `dd/mm/aaaa`), `formatarDataHora(d)` (`America/Sao_Paulo`), `formatarDataLonga(d)` ("4 de setembro")
  - `descreverCobranca(item)`, `formatarDimensao(a, l)`, `tituloDocumento(estado)`, `TEXTOS_IMPRESSO`

- [x] **Step 1: `ValorNumerico` e `ErroDeValidacao`**

`src/domain/precificacao/erros.ts`:
```ts
/** Erro de regra de negocio: a action devolve a mensagem ao operador. Qualquer outro erro estoura. */
export class ErroDeValidacao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeValidacao'
  }
}
```

Em `src/domain/precificacao/tipos.ts`, trocar `valorUnitario: number`, `altura?: number`, `largura?: number` por `ValorNumerico` e acrescentar antes de `ItemCobranca`:
```ts
/** number vindo do formulario; string exata (Decimal.toFixed()) vindo do banco. Nunca passa por float. */
export type ValorNumerico = number | string
```

Em `src/domain/precificacao/formulas.ts`: importar `ErroDeValidacao` e trocar os quatro `throw new Error(` por `throw new ErroDeValidacao(`; trocar as duas comparações `item.altura <= 0 || item.largura <= 0` por `dinheiro(item.altura).lte(0) || dinheiro(item.largura).lte(0)` e `item.quantidade <= 0` fica (é `number`). O TypeScript 7 recusa `'0.61' <= 0` (TS2365) — a troca é obrigatória.

Em `src/domain/precificacao/ordem.ts`: `Acrescimo.valor: ValorNumerico`, `precoFinalManual?: ValorNumerico`, `if (dinheiro(precoFinalManual).lt(0)) throw new ErroDeValidacao('preco final nao pode ser negativo')`.

Run: `npm test -- precificacao` → PASS (os testes da 1A continuam: `number` segue aceito).

- [x] **Step 2: Teste da resolução da linha**

`src/domain/precificacao/resolucao.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolverLinha, descreverLinha, lerMedida, proximaUnidade, type MaterialCatalogo } from './resolucao'

const CATALOGO: MaterialCatalogo[] = [
  { id: 'acm', nome: 'ACM 3 mm', preco: '61.0000', unidadeCobranca: 'unidade' },
  { id: 'lona', nome: 'Lona 440 g', preco: '83.0000', unidadeCobranca: 'm2' },
  { id: 'letra', nome: 'Letra caixa PVC 10 mm', preco: '34.0000', unidadeCobranca: 'unidade' },
  { id: 'perfil', nome: 'Perfil de alumínio', preco: '28.0000', unidadeCobranca: 'metro_linear' },
]

function item(texto: string, catalogo: MaterialCatalogo[] = []) {
  const r = resolverLinha(texto, catalogo)
  if (r.tipo !== 'item') throw new Error('esperava item')
  return r
}

describe('resolverLinha — as seis linhas da OS 18449, como estao no legado', () => {
  it.each([
    ['06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00', 6, 0.6, 0.8, 120.5, '723,00'],
    ['01 PLACA ACM 50 X 50 E ADES/ IMP  62,00', 1, 0.5, 0.5, 62, '62,00'],
    ['03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00', 3, 0.51, 0.61, 76, '228,00'],
    ['12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00', 12, 0.61, 0.4, 61, '732,00'],
    ['06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00', 6, 0.61, 0.61, 93, '558,00'],
    ['03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00', 3, 0.5, 0.6, 75, '225,00'],
  ])('%s', (texto, qtd, altura, largura, unitario, total) => {
    const r = item(texto)
    expect(r.quantidade).toBe(qtd)
    expect(r.altura).toBeCloseTo(altura, 4)
    expect(r.largura).toBeCloseTo(largura, 4)
    expect(r.valorUnitario).toBe(unitario)
    expect(r.unidade).toBe('unidade')
    expect(r.pendencias).toEqual([])
    const d = descreverLinha(r)
    expect(d.total).toBe(`R$ ${total}`)
    expect(d.conferencia).toBe(texto.includes(' CD ') ? 'ok' : null)
  })

  it('a soma das seis fecha em 2.528,00', () => {
    const linhas = [
      '06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00', '01 PLACA ACM 50 X 50 E ADES/ IMP  62,00',
      '03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00', '12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00',
      '06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00', '03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00',
    ]
    const soma = linhas.reduce((s, l) => s + item(l).quantidade * item(l).valorUnitario!, 0)
    expect(soma).toBe(2528)
  })

  it('CD com total diferente de qtd x unitario avisa divergencia', () => {
    const r = item('12 PLACAS ACM 61 X 40 61,00 CD 700,00')
    expect(r.totalDigitado).toBe(700)
    expect(descreverLinha(r).conferencia).toBe('diverge')
  })
})

describe('resolverLinha — catalogo, unidade e pendencias', () => {
  it('acha o material pelos tokens e herda a unidade dele', () => {
    const r = item('2 lona 440 1,20x2,40 90,00', CATALOGO)
    expect(r.material?.id).toBe('lona')
    expect(r.unidade).toBe('m2')
    expect(r.origemUnidade).toBe('material')
    expect(descreverLinha(r).total).toBe('R$ 518,40')
  })

  it('ACM cadastrado por unidade: 12 x 61,00 = 732,00 mesmo com medida', () => {
    const r = item('12 placas ACM 61x40 61,00', CATALOGO)
    expect(r.material?.id).toBe('acm')
    expect(r.unidade).toBe('unidade')
    expect(descreverLinha(r).total).toBe('R$ 732,00')
  })

  it('sem valor usa o preco do catalogo e marca a origem', () => {
    const r = item('18 letra caixa PVC', CATALOGO)
    expect(r.material?.id).toBe('letra')
    expect(r.valorUnitario).toBe(34)
    expect(r.valorDoCatalogo).toBe(true)
    expect(r.pendencias).toEqual([])
  })

  it('sufixo /m2 vence a unidade do material; Alt+U (opcao) vence o sufixo', () => {
    const r = item('12 placas ACM 61x40 61,00 /m2', CATALOGO)
    expect(r.unidade).toBe('m2')
    expect(r.origemUnidade).toBe('sufixo')
    const forcado = resolverLinha('12 placas ACM 61x40 61,00 /m2', CATALOGO, { unidadeEscolhida: 'metro_linear' })
    expect(forcado.tipo === 'item' && forcado.unidade).toBe('metro_linear')
  })

  it('material escolhido a mao (Alt+M) vence a busca por tokens', () => {
    const r = resolverLinha('12 placas 61x40 61,00', CATALOGO, { materialEscolhido: CATALOGO[3]! })
    expect(r.tipo === 'item' && r.material?.id).toBe('perfil')
    expect(r.tipo === 'item' && r.unidade).toBe('metro_linear')
  })

  it('pendencias: valor, dimensao e quantidade', () => {
    expect(item('3 banner 200x100').pendencias).toEqual(['valor'])
    expect(item('2 lona 440 90,00', CATALOGO).pendencias).toEqual(['dimensao'])
    expect(item('0 placas 10,00').pendencias).toContain('quantidade')
    expect(descreverLinha(item('3 banner 200x100')).total).toBeNull()
  })

  it('descreve a linha como no artboard', () => {
    expect(descreverLinha(item('12 placas ACM 61x40 61,00', CATALOGO)).texto)
      .toBe('qtd 12 · ACM 3 mm · 0,61 × 0,40 m · R$ 61,00/un')
    expect(descreverLinha(item('2 lona 440 1,20x2,40 90,00', CATALOGO)).texto)
      .toBe('qtd 2 · Lona 440 g · 1,20 × 2,40 m · R$ 90,00/m²')
  })
})

describe('resolverLinha — acrescimos com prefixo +', () => {
  it.each([
    ['+instalacao 280', 'instalacao', '', 280],
    ['+deslocamento 34 km 102,00', 'deslocamento', '34 km', 102],
    ['+frete 50', 'frete', '', 50],
    ['+imp 120,00', 'imposto', '', 120],
  ])('%s', (texto, tipo, descricao, valor) => {
    const r = resolverLinha(texto, [])
    expect(r).toMatchObject({ tipo: 'acrescimo', tipoAcrescimo: tipo, descricao, valor, pendencias: [] })
  })

  it('tipo desconhecido e valor ausente sao pendencias', () => {
    expect(resolverLinha('+entrega 50', []).pendencias).toContain('tipo_acrescimo')
    expect(resolverLinha('+frete', []).pendencias).toContain('valor')
  })
})

describe('lerMedida e proximaUnidade', () => {
  it('le centimetros e metros', () => {
    expect(lerMedida('61x40')).toEqual({ altura: 0.61, largura: 0.4 })
    expect(lerMedida('1,35 x 0,75')).toEqual({ altura: 1.35, largura: 0.75 })
    expect(lerMedida('61')).toBeNull()
  })
  it('cicla unidade -> m2 -> metro_linear -> unidade', () => {
    expect(proximaUnidade('unidade')).toBe('m2')
    expect(proximaUnidade('m2')).toBe('metro_linear')
    expect(proximaUnidade('metro_linear')).toBe('unidade')
  })
})
```

- [x] **Step 3: Rodar e ver falhar**

Run: `npm test -- resolucao`
Expected: FAIL — `Cannot find module './resolucao'`

- [x] **Step 4: Criar `src/domain/precificacao/resolucao.ts`**

```ts
import { interpretarLinha, normalizarDimensao } from './parser'
import { calcularItem } from './formulas'
import { formatarMoeda } from './moeda'
import { dinheiro } from './dinheiro'
import type { UnidadeCobranca } from './tipos'

/** O que a tela recebe do catalogo: preco como string decimal (Decimal nao atravessa a fronteira). */
export interface MaterialCatalogo {
  id: string
  nome: string
  preco: string
  unidadeCobranca: UnidadeCobranca
}

export type TipoAcrescimo = 'instalacao' | 'deslocamento' | 'frete' | 'imposto'
export type Pendencia = 'valor' | 'quantidade' | 'dimensao' | 'tipo_acrescimo'
export type OrigemUnidade = 'material' | 'padrao' | 'sufixo' | 'escolhida'

export interface ItemResolvido {
  tipo: 'item'
  quantidade: number
  descricao: string
  material: MaterialCatalogo | null
  /** Outros materiais com a mesma pontuacao: a tela oferece a troca. */
  candidatos: MaterialCatalogo[]
  altura?: number
  largura?: number
  unidade: UnidadeCobranca
  origemUnidade: OrigemUnidade
  valorUnitario?: number
  valorDoCatalogo: boolean
  /** O "CD 723,00" do legado: total digitado, usado so para conferir. */
  totalDigitado?: number
  pendencias: Pendencia[]
}

export interface AcrescimoResolvido {
  tipo: 'acrescimo'
  tipoAcrescimo: TipoAcrescimo | null
  descricao: string
  valor?: number
  pendencias: Pendencia[]
}

export type LinhaResolvida = ItemResolvido | AcrescimoResolvido

export interface OpcoesResolucao {
  /** Unidade escolhida pelo operador (select ou Alt+U); vence sufixo e material. */
  unidadeEscolhida?: UnidadeCobranca
  /** Material escolhido a mao; null = descricao livre, sem material. */
  materialEscolhido?: MaterialCatalogo | null
}

const SUFIXO_UNIDADE: Record<string, UnidadeCobranca> = { un: 'unidade', m2: 'm2', ml: 'metro_linear' }
const RE_SUFIXO = /\s*\/(un|m2|ml)\s*$/i
const RE_VALOR = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}|\d+,\d{2}|\d+)/
/** "CD 723,00", "= 723,00", "TOTAL 723,00" no fim da linha, como o legado datilografava. */
const RE_TOTAL_LEGADO = new RegExp(`\\s+(?:CD|=|TOTAL)\\s*${RE_VALOR.source}\\s*$`, 'i')
const RE_VALOR_FIM = new RegExp(`${RE_VALOR.source}\\s*$`)
/** Palavras que aparecem em qualquer descricao e nao identificam material. */
const STOPWORDS = new Set(['de', 'da', 'do', 'com', 'e', 'em', 'para', 'placa', 'adesivo', 'impresso', 'impressao', 'ades', 'imp', 'mm'])
const TIPOS_ACRESCIMO: TipoAcrescimo[] = ['instalacao', 'deslocamento', 'frete', 'imposto']

export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function tokens(s: string): string[] {
  return normalizarTexto(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
}

/** Pontua cada material pelos tokens da descricao presentes no nome; empate -> nome mais curto. */
export function acharMaterial(
  descricao: string,
  catalogo: MaterialCatalogo[],
): { escolhido: MaterialCatalogo | null; candidatos: MaterialCatalogo[] } {
  const pistas = tokens(descricao).filter((t) => !STOPWORDS.has(t))
  if (pistas.length === 0) return { escolhido: null, candidatos: [] }
  let melhor = 0
  const pontuados: Array<{ m: MaterialCatalogo; p: number }> = []
  for (const m of catalogo) {
    const nome = new Set(tokens(m.nome))
    const p = pistas.filter((t) => nome.has(t)).length
    if (p > 0) pontuados.push({ m, p })
    if (p > melhor) melhor = p
  }
  if (melhor === 0) return { escolhido: null, candidatos: [] }
  const empatados = pontuados.filter((x) => x.p === melhor).map((x) => x.m).sort((a, b) => a.nome.length - b.nome.length)
  return { escolhido: empatados[0] ?? null, candidatos: empatados.slice(1) }
}

function paraNumero(token: string): number {
  return Number(token.replace(/\./g, '').replace(',', '.'))
}

function resolverAcrescimo(texto: string): AcrescimoResolvido {
  let resto = texto.replace(/^\+\s*/, '').trim()
  const pendencias: Pendencia[] = []
  const primeira = resto.split(/\s+/)[0] ?? ''
  const chave = normalizarTexto(primeira)
  const tipoAcrescimo = TIPOS_ACRESCIMO.find((t) => chave.length >= 3 && t.startsWith(chave)) ?? null
  if (!tipoAcrescimo) pendencias.push('tipo_acrescimo')
  else resto = resto.slice(primeira.length).trim()

  let valor: number | undefined
  const mVal = resto.match(RE_VALOR_FIM)
  if (mVal?.[1]) {
    valor = paraNumero(mVal[1])
    resto = resto.slice(0, resto.length - mVal[0].length).trim()
  } else {
    pendencias.push('valor')
  }
  return { tipo: 'acrescimo', tipoAcrescimo, descricao: resto, valor, pendencias }
}

export function resolverLinha(texto: string, catalogo: MaterialCatalogo[], opcoes: OpcoesResolucao = {}): LinhaResolvida {
  const aparado = texto.trim()
  if (aparado.startsWith('+')) return resolverAcrescimo(aparado)

  let totalDigitado: number | undefined
  const semTotal = aparado.replace(RE_TOTAL_LEGADO, (_, v: string) => {
    totalDigitado = paraNumero(v)
    return ''
  })

  let unidadeSufixo: UnidadeCobranca | undefined
  const semSufixo = semTotal.replace(RE_SUFIXO, (_, s: string) => {
    unidadeSufixo = SUFIXO_UNIDADE[s.toLowerCase()]
    return ''
  })

  const linha = interpretarLinha(semSufixo)
  const busca = opcoes.materialEscolhido !== undefined
    ? { escolhido: opcoes.materialEscolhido, candidatos: [] }
    : acharMaterial(linha.descricao, catalogo)
  const material = busca.escolhido

  // Regra do legado e da spec: sem material do catalogo o preco e por unidade; m2 so vem do
  // material, do sufixo ou da escolha do operador. A sugestao do parser nao e usada.
  let unidade: UnidadeCobranca
  let origemUnidade: OrigemUnidade
  if (opcoes.unidadeEscolhida) { unidade = opcoes.unidadeEscolhida; origemUnidade = 'escolhida' }
  else if (unidadeSufixo) { unidade = unidadeSufixo; origemUnidade = 'sufixo' }
  else if (material) { unidade = material.unidadeCobranca; origemUnidade = 'material' }
  else { unidade = 'unidade'; origemUnidade = 'padrao' }

  const valorDoCatalogo = linha.valorUnitario === undefined && material !== null
  const valorUnitario = linha.valorUnitario ?? (material ? Number(material.preco) : undefined)

  const pendencias: Pendencia[] = []
  if (!(linha.quantidade > 0) || linha.quantidade > 9999) pendencias.push('quantidade')
  const temMedida = linha.altura !== undefined && linha.largura !== undefined && linha.altura > 0 && linha.largura > 0
  if (unidade !== 'unidade' && !temMedida) pendencias.push('dimensao')
  if (valorUnitario === undefined) pendencias.push('valor')

  return {
    tipo: 'item',
    quantidade: linha.quantidade,
    descricao: linha.descricao,
    material,
    candidatos: busca.candidatos,
    altura: linha.altura,
    largura: linha.largura,
    unidade,
    origemUnidade,
    valorUnitario,
    valorDoCatalogo,
    totalDigitado,
    pendencias,
  }
}

function metros(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

const SUFIXO_LEGIVEL: Record<UnidadeCobranca, string> = { unidade: '/un', m2: '/m²', metro_linear: '/m linear' }

export interface DescricaoLinha {
  texto: string
  /** Total formatado, ou null quando ainda nao da para calcular. */
  total: string | null
  /** Quando a linha trouxe "CD <total>": bate ou nao com qtd x unitario. */
  conferencia: 'ok' | 'diverge' | null
}

/** "qtd 12 · ACM 3 mm · 0,61 × 0,40 m · R$ 61,00/un" e o total, como no artboard. */
export function descreverLinha(r: LinhaResolvida): DescricaoLinha {
  if (r.tipo === 'acrescimo') {
    const partes = ['Acréscimo', r.tipoAcrescimo ?? 'tipo?']
    if (r.descricao) partes.push(r.descricao)
    const total = r.valor !== undefined ? formatarMoeda(dinheiro(r.valor)) : null
    return { texto: partes.join(' · '), total, conferencia: null }
  }

  const partes = [`qtd ${r.quantidade}`, r.material?.nome ?? r.descricao]
  if (r.altura !== undefined && r.largura !== undefined) partes.push(`${metros(r.altura)} × ${metros(r.largura)} m`)
  if (r.valorUnitario !== undefined) partes.push(`${formatarMoeda(dinheiro(r.valorUnitario))}${SUFIXO_LEGIVEL[r.unidade]}`)

  let total: string | null = null
  let conferencia: DescricaoLinha['conferencia'] = null
  if (r.pendencias.length === 0 && r.valorUnitario !== undefined) {
    try {
      const calc = calcularItem({
        unidade: r.unidade, quantidade: r.quantidade, valorUnitario: r.valorUnitario, altura: r.altura, largura: r.largura,
      })
      total = formatarMoeda(calc.total)
      if (r.totalDigitado !== undefined) conferencia = calc.total.equals(dinheiro(r.totalDigitado)) ? 'ok' : 'diverge'
    } catch {
      total = null
    }
  }
  return { texto: partes.join(' · '), total, conferencia }
}

/** "61x40" ou "0,61 x 0,40" digitado no campo de medida. */
export function lerMedida(texto: string): { altura: number; largura: number } | null {
  const m = texto.match(/^\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*$/)
  if (!m?.[1] || !m[2]) return null
  return { altura: normalizarDimensao(m[1]), largura: normalizarDimensao(m[2]) }
}

export function proximaUnidade(atual: UnidadeCobranca): UnidadeCobranca {
  return atual === 'unidade' ? 'm2' : atual === 'm2' ? 'metro_linear' : 'unidade'
}
```

> Este arquivo tem `\\s` dentro de `new RegExp(...)`: **escrever pela ferramenta de edição**, nunca por heredoc.

- [x] **Step 5: Rodar e ver passar**

Run: `npm test -- resolucao` → PASS — 22 passed

> Nota de execução (2026-08-28): duas linhas do legado vêm com a quantidade colada (`03PLACAS`, `06PLACAS`) e o parser da 1A exige espaço; `resolverLinha` passou a inserir o espaço (`RE_QTD_COLADA`) antes de chamar o parser.

- [x] **Step 6: Permissões e rótulos em `src/domain/ordem/estados.ts`**

Acrescentar ao fim do arquivo existente (mantendo `podeTransicionar`, `transicionar`, `calcularEstadoPagamento`):
```ts
export const ROTULO_ESTADO: Record<EstadoProducao, string> = {
  orcamento: 'Orçamento',
  aberta: 'Aberta',
  concluida: 'Serviço finalizado',
  cancelada: 'Cancelada',
}

export interface PermissoesOrdem {
  editarCabecalho: boolean
  editarItens: boolean
  editarPreco: boolean
  editarObservacoes: boolean
  aprovarOrcamento: boolean
  cancelar: boolean
}

/** O que a tela deixa mexer em cada estado. Concluir e receber e da Fase 4. */
export function permissoes(estado: EstadoProducao): PermissoesOrdem {
  const emEdicao = estado === 'orcamento' || estado === 'aberta'
  return {
    editarCabecalho: emEdicao,
    editarItens: emEdicao,
    editarPreco: emEdicao,
    editarObservacoes: estado !== 'cancelada',
    aprovarOrcamento: estado === 'orcamento',
    cancelar: emEdicao,
  }
}

export interface SituacaoAjuste {
  temAjuste: boolean
  precoCalculado: string
  precoCalculadoNoAjuste: string | null
}

/** O aviso "o calculado mudou e o preco final continua o ajustado" — derivado, nunca digitado. */
export function ajusteDesatualizado(s: SituacaoAjuste): boolean {
  return s.temAjuste && s.precoCalculadoNoAjuste !== null && s.precoCalculadoNoAjuste !== s.precoCalculado
}
```

Acrescentar a `src/domain/ordem/estados.test.ts`:
```ts
import { permissoes, ajusteDesatualizado, ROTULO_ESTADO } from './estados'

describe('permissoes por estado', () => {
  it('orcamento e aberta editam; concluida so observacoes; cancelada nada', () => {
    expect(permissoes('orcamento')).toMatchObject({ editarItens: true, aprovarOrcamento: true, cancelar: true })
    expect(permissoes('aberta')).toMatchObject({ editarItens: true, aprovarOrcamento: false, cancelar: true })
    expect(permissoes('concluida')).toMatchObject({ editarItens: false, editarObservacoes: true, cancelar: false })
    expect(permissoes('cancelada')).toMatchObject({ editarItens: false, editarObservacoes: false })
  })
  it('rotulos no vocabulario da loja', () => {
    expect(ROTULO_ESTADO.concluida).toBe('Serviço finalizado')
  })
})

describe('ajusteDesatualizado', () => {
  it('so avisa quando ha ajuste e o calculado mudou desde ele', () => {
    expect(ajusteDesatualizado({ temAjuste: false, precoCalculado: '10.00', precoCalculadoNoAjuste: null })).toBe(false)
    expect(ajusteDesatualizado({ temAjuste: true, precoCalculado: '10.00', precoCalculadoNoAjuste: '10.00' })).toBe(false)
    expect(ajusteDesatualizado({ temAjuste: true, precoCalculado: '12.00', precoCalculadoNoAjuste: '10.00' })).toBe(true)
  })
})
```
(as importações se juntam ao `import` existente do arquivo.)

Run: `npm test -- estados` → PASS — 22 passed

- [x] **Step 7: Datas e formatadores do impresso**

`src/domain/ordem/datas.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatarDataCalendario, formatarDataHora, formatarDataLonga } from './datas'

describe('datas', () => {
  it('data de calendario (@db.Date, meia-noite UTC) nao muda de dia no fuso da loja', () => {
    expect(formatarDataCalendario(new Date('2026-09-04T00:00:00.000Z'))).toBe('04/09/2026')
    expect(formatarDataLonga(new Date('2026-09-04T00:00:00.000Z'))).toBe('4 de setembro')
  })
  it('data e hora (timestamptz) no fuso da loja: 22h em Unai nao vira o dia seguinte', () => {
    expect(formatarDataHora(new Date('2026-08-28T01:30:00.000Z'))).toBe('27/08/2026 22:30')
  })
})
```

`src/domain/ordem/datas.ts`:
```ts
const FUSO_LOJA = 'America/Sao_Paulo'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const dois = (n: number) => String(n).padStart(2, '0')

/** Para colunas @db.Date: o Prisma entrega meia-noite UTC; ler com getUTC* para nao voltar um dia. */
export function formatarDataCalendario(d: Date): string {
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/** "4 de setembro", como o artboard mostra a entrega prometida. */
export function formatarDataLonga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

/** Para timestamptz: sempre no fuso da loja, mesmo com o servidor em UTC (Vercel). */
export function formatarDataHora(d: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_LOJA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`
}

/** "2026-09-04" -> Date de meia-noite UTC (para gravar em @db.Date). null se invalida. */
export function lerDataCalendario(texto: string): Date | null {
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null
}
```

`src/domain/ordem/impresso.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dinheiro } from '../precificacao/dinheiro'
import { descreverCobranca, formatarDimensao, tituloDocumento, type ItemImpresso } from './impresso'

function item(p: Partial<ItemImpresso>): ItemImpresso {
  return { quantidade: 1, descricao: 'x', unidade: 'unidade', altura: null, largura: null, valorUnitario: dinheiro(1), total: dinheiro(1), ...p }
}

describe('descreverCobranca', () => {
  it('area soma a quantidade: 6 x 0,60 x 0,80 = 2,88 m2', () => {
    expect(descreverCobranca(item({ unidade: 'm2', quantidade: 6, altura: 0.6, largura: 0.8 }))).toBe('área · 2,88 m²')
  })
  it('metro linear e perimetro', () => {
    expect(descreverCobranca(item({ unidade: 'metro_linear', altura: 0.61, largura: 0.6 }))).toBe('metro linear · perímetro 2,42 m')
  })
  it('unidade com medida registrada (OS 18449) continua por unidade', () => {
    expect(descreverCobranca(item({ unidade: 'unidade', quantidade: 12, altura: 0.61, largura: 0.4 }))).toBe('por unidade')
  })
})

describe('formatarDimensao e tituloDocumento', () => {
  it('0,61 × 0,40 m; sem medida e travessao', () => {
    expect(formatarDimensao(0.61, 0.4)).toBe('0,61 × 0,40 m')
    expect(formatarDimensao(null, null)).toBe('—')
  })
  it('orcamento tem titulo proprio', () => {
    expect(tituloDocumento('orcamento')).toBe('Orçamento')
    expect(tituloDocumento('aberta')).toBe('Ordem de Serviço')
  })
})
```

`src/domain/ordem/impresso.ts`:
```ts
import type { Decimal } from '../precificacao/dinheiro'
import type { UnidadeCobranca } from '../precificacao/tipos'
import type { EstadoProducao } from './estados'

/** Textos herdados do impresso do legado (OBS8 e rodape): o cliente da loja ja os reconhece. */
export const TEXTOS_IMPRESSO = {
  garantia: 'Sempre guarde esse comprovante como sua garantia de entrega!',
  agradecimento: 'Obrigado pela preferência',
  orcamentoValidade: 'Orçamento sem compromisso. Preços válidos por 15 dias.',
} as const

export interface DadosEmpresaImpresso {
  nomeFantasia: string
  razaoSocial: string
  /** Entram na Fase 5; o layout reserva o espaco e omite o que for null. */
  cnpj?: string | null
  endereco?: string | null
  cidadeUf?: string | null
  telefones?: string[]
}

export interface ItemImpresso {
  quantidade: number
  descricao: string
  unidade: UnidadeCobranca
  altura: number | null
  largura: number | null
  valorUnitario: Decimal
  total: Decimal
}

export interface AcrescimoImpresso {
  descricao: string
  valor: Decimal
}

export interface OrdemImpressa {
  numero: number
  estadoProducao: EstadoProducao
  abertaEm: Date
  prometidaPara: Date | null
  responsavel: string
  cliente: { nome: string; apelido: string | null; telefone: string | null; documento: string | null } | null
  itens: ItemImpresso[]
  acrescimos: AcrescimoImpresso[]
  subtotalItens: Decimal
  precoCalculado: Decimal
  precoFinal: Decimal
  ajuste: Decimal
  motivoAjuste: string | null
  observacoes: string | null
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

export function formatarDimensao(altura: number | null, largura: number | null): string {
  if (altura === null || largura === null) return '—'
  return `${fmt(altura)} × ${fmt(largura)} m`
}

/** 'área · 2,88 m²' | 'por unidade' | 'metro linear · perímetro 2,42 m' — igual ao artboard. */
export function descreverCobranca(item: ItemImpresso): string {
  if (item.unidade === 'unidade' || item.altura === null || item.largura === null) return 'por unidade'
  if (item.unidade === 'm2') return `área · ${fmt(item.altura * item.largura * item.quantidade)} m²`
  return `metro linear · perímetro ${fmt(2 * (item.altura + item.largura))} m`
}

export function tituloDocumento(estado: EstadoProducao): string {
  return estado === 'orcamento' ? 'Orçamento' : 'Ordem de Serviço'
}
```

Run: `npm test -- datas` → PASS — 2 passed. Run: `npm test -- impresso` → PASS — 5 passed. (Nos dois, rodar antes o vermelho: `Cannot find module`.)

- [x] **Step 8: Verificação e commit**

Run: `npm test` → PASS (pureza incluída: os módulos novos só importam o próprio domínio). Run: `npm run typecheck` → sem erros.

```bash
git add src/domain/
git commit -m "feat: resolucao da linha digitada, permissoes por estado e formatadores do impresso"
```

---

### Task 2: Schema — ordem, itens, acréscimos, contador e mutação

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `prisma/migrations/<carimbo>_ordens/` (gerada por `db:migrar`)

- [x] **Step 1: Acrescentar ao `prisma/schema.prisma`**

Relações inversas: em `Empresa` acrescentar `ordens OrdemServico[]` e `contador ContadorEmpresa?`; em `Usuario` acrescentar `ordensResponsavel OrdemServico[] @relation("ordem_responsavel")` e `ordensAjustadas OrdemServico[] @relation("ordem_ajustada_por")`; em `Cliente` acrescentar `ordens OrdemServico[]`; em `Material` acrescentar `itens ItemOrdem[]`.

No fim do arquivo:
```prisma
/// Eixo de producao (spec, secao 6). Pagamento e derivado, nao mora aqui.
enum EstadoProducao {
  orcamento
  aberta
  concluida
  cancelada

  @@map("estado_producao")
}

/// Calculado sobre o total, nao cadastrado como material (spec, secao 4).
enum TipoAcrescimo {
  instalacao
  deslocamento
  frete
  imposto

  @@map("tipo_acrescimo")
}

/// Numeracao por empresa, sem buraco: `update { increment }` dentro da transacao que cria a OS.
/// Nao e sequence: o TRUNCATE dos testes e o rollback nao mexem aqui. A DruSign continua em 18461 (seed).
model ContadorEmpresa {
  empresaId String  @id @map("empresa_id") @db.Uuid
  empresa   Empresa @relation(fields: [empresaId], references: [id])
  proximaOs Int     @map("proxima_os")

  @@map("contador_empresa")
}

/// Orcamento e estado, nao modulo. Cancelada preserva tudo.
model OrdemServico {
  id             String         @id @default(uuid(7)) @db.Uuid
  empresaId      String         @map("empresa_id") @db.Uuid
  empresa        Empresa        @relation(fields: [empresaId], references: [id])
  numero         Int
  estadoProducao EstadoProducao @map("estado_producao")

  clienteId       String?  @map("cliente_id") @db.Uuid
  cliente         Cliente? @relation(fields: [clienteId], references: [id])
  /// Snapshot na criacao/troca de cliente: impresso e historico nao mudam quando o cadastro muda.
  clienteNome     String?  @map("cliente_nome") @db.VarChar(120)
  clienteApelido  String?  @map("cliente_apelido") @db.VarChar(60)
  clienteTelefone String?  @map("cliente_telefone") @db.VarChar(20)

  responsavelId String  @map("responsavel_id") @db.Uuid
  responsavel   Usuario @relation("ordem_responsavel", fields: [responsavelId], references: [id])
  observacoes   String?

  /// Derivados, mas persistidos: preco congelado no historico (spec, secao 5).
  subtotalItens      Decimal @default(0) @map("subtotal_itens") @db.Decimal(12, 4)
  subtotalAcrescimos Decimal @default(0) @map("subtotal_acrescimos") @db.Decimal(12, 4)
  precoCalculado     Decimal @default(0) @map("preco_calculado") @db.Decimal(12, 4)
  precoFinal         Decimal @default(0) @map("preco_final") @db.Decimal(12, 4)

  /// Ajuste manual: os quatro andam juntos. Com ajustadoPorId, precoFinal nao e sobrescrito;
  /// o aviso de divergencia e precoCalculado != precoCalculadoNoAjuste.
  motivoAjuste           String?   @map("motivo_ajuste") @db.VarChar(160)
  ajustadoPorId          String?   @map("ajustado_por_id") @db.Uuid
  ajustadoPor            Usuario?  @relation("ordem_ajustada_por", fields: [ajustadoPorId], references: [id])
  ajustadoEm             DateTime? @map("ajustado_em") @db.Timestamptz(3)
  precoCalculadoNoAjuste Decimal?  @map("preco_calculado_no_ajuste") @db.Decimal(12, 4)

  /// Aprovar orcamento trava o preco: guarda o que foi aprovado, sem virar ajuste.
  aprovadoEm    DateTime? @map("aprovado_em") @db.Timestamptz(3)
  precoAprovado Decimal?  @map("preco_aprovado") @db.Decimal(12, 4)

  abertaEm           DateTime  @default(now()) @map("aberta_em") @db.Timestamptz(3)
  prometidaPara      DateTime? @map("prometida_para") @db.Date
  concluidaEm        DateTime? @map("concluida_em") @db.Timestamptz(3)
  canceladaEm        DateTime? @map("cancelada_em") @db.Timestamptz(3)
  motivoCancelamento String?   @map("motivo_cancelamento") @db.VarChar(160)

  /// Trava otimista (spec, secao 9): toda gravacao vai com a versao lida.
  versao       Int      @default(1)
  criadoEm     DateTime @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm DateTime @updatedAt @map("atualizado_em") @db.Timestamptz(3)

  itens      ItemOrdem[]
  acrescimos AcrescimoOrdem[]

  @@unique([empresaId, numero])
  @@index([empresaId, estadoProducao, abertaEm])
  @@index([empresaId, clienteId])
  @@map("ordem_servico")
}

/// Uma ordem mistura as tres formas de cobranca. altura/largura em metros, so descricao quando por unidade.
model ItemOrdem {
  id              String          @id @default(uuid(7)) @db.Uuid
  empresaId       String          @map("empresa_id") @db.Uuid
  ordemId         String          @map("ordem_id") @db.Uuid
  ordem           OrdemServico    @relation(fields: [ordemId], references: [id])
  descricao       String          @db.VarChar(160)
  materialId      String?         @map("material_id") @db.Uuid
  material        Material?       @relation(fields: [materialId], references: [id])
  quantidade      Int
  altura          Decimal?        @db.Decimal(8, 4)
  largura         Decimal?        @db.Decimal(8, 4)
  unidadeCobranca UnidadeCobranca @map("unidade_cobranca")
  valorUnitario   Decimal         @map("valor_unitario") @db.Decimal(12, 4)
  /// Resultado de calcularItem, gravado na mesma transacao: preco congelado.
  total           Decimal         @db.Decimal(12, 4)
  ordemExibicao   Int             @map("ordem_exibicao")
  /// Removido em edicao fica marcado, nunca apagado.
  removidoEm      DateTime?       @map("removido_em") @db.Timestamptz(3)
  removidoPorId   String?         @map("removido_por_id") @db.Uuid
  criadoEm        DateTime        @default(now()) @map("criado_em") @db.Timestamptz(3)

  @@index([ordemId, ordemExibicao])
  @@index([empresaId, materialId])
  @@map("item_ordem")
}

model AcrescimoOrdem {
  id            String        @id @default(uuid(7)) @db.Uuid
  empresaId     String        @map("empresa_id") @db.Uuid
  ordemId       String        @map("ordem_id") @db.Uuid
  ordem         OrdemServico  @relation(fields: [ordemId], references: [id])
  tipo          TipoAcrescimo
  /// "Deslocamento · 34 km": o detalhe fica aqui, o valor e digitado.
  descricao     String        @db.VarChar(120)
  valor         Decimal       @db.Decimal(12, 4)
  removidoEm    DateTime?     @map("removido_em") @db.Timestamptz(3)
  removidoPorId String?       @map("removido_por_id") @db.Uuid
  criadoEm      DateTime      @default(now()) @map("criado_em") @db.Timestamptz(3)

  @@index([ordemId])
  @@map("acrescimo_ordem")
}

/// Chave de idempotencia (spec, secao 9): o retry depois de um commit sem resposta recebe o
/// mesmo resultado e nao duplica. A chave nasce no cliente (crypto.randomUUID()), uma por tentativa.
model Mutacao {
  id        String   @id @default(uuid(7)) @db.Uuid
  empresaId String   @map("empresa_id") @db.Uuid
  chave     String   @db.VarChar(64)
  acao      String   @db.VarChar(60)
  usuarioId String   @map("usuario_id") @db.Uuid
  /// O que a action devolveu na primeira execucao (JSON puro). null enquanto executa.
  resposta  Json?
  criadaEm  DateTime @default(now()) @map("criada_em") @db.Timestamptz(3)

  @@unique([empresaId, chave])
  @@map("mutacao")
}
```

- [x] **Step 2: Migrar e gerar**

Nenhum `next dev` aberto. Run: `npm run db:migrar -- ordens`
Expected: `migracao escrita em prisma/migrations/<carimbo>_ordens`, aplicada no banco `drusign`, client regenerado. Conferir no SQL: `CREATE TYPE "estado_producao"`, `CREATE TYPE "tipo_acrescimo"`, tabelas `contador_empresa`, `ordem_servico`, `item_ordem`, `acrescimo_ordem`, `mutacao`, `"altura" DECIMAL(8,4)`, índice único `ordem_servico_empresa_id_numero_key` e `mutacao_empresa_id_chave_key`.

- [x] **Step 3: Seed do contador**

Em `prisma/seed.ts`, depois do upsert da empresa:
```ts
  // A numeracao continua de onde o legado parou: a proxima OS e a 18461.
  await prisma.contadorEmpresa.upsert({
    where: { empresaId: empresa.id },
    update: {},
    create: { empresaId: empresa.id, proximaOs: 18461 },
  })
  console.log('contador de OS pronto (proxima: 18461)')
```

Run: `npm run db:seed` → mostra `contador de OS pronto (proxima: 18461)`.

- [x] **Step 4: Verificação e commit**

Run: `npm run typecheck` → sem erros. Run: `npm run test:int` → PASS — 21 passed (o banco de teste recebe a migração no `globalSetup`).

```bash
git add prisma/
git commit -m "feat: modelos de ordem de servico, itens, acrescimos, contador e mutacao"
```

---
### Task 3: Infra — idempotência e repositório de ordens (reproduz a OS 18449)

**Files:**
- Create: `src/infra/mutacoes/idempotencia.ts`, `src/infra/ordens/repositorio.ts`, `src/infra/ordens/tela.ts`
- Test: `src/infra/mutacoes/idempotencia.int.test.ts`, `src/infra/ordens/repositorio.int.test.ts`

**Interfaces:**
- Produces:
  - `executarUmaVez(ctx: Contexto, acao, fn(tx) => Promise<R>): Promise<R>` — `Contexto = { empresaId; usuarioId; chave }`; `R` é JSON puro
  - `ConflitoVersao`, `OrdemNaoEditavel` (classes de erro)
  - `criarOrdem(ctx, { estado, clienteId?, prometidaPara?, responsavelId? })` → `{ id, numero, versao }`
  - `adicionarItem(ctx, ordemId, versao, DadosItem)`, `removerItem(ctx, ordemId, versao, itemId)`, `adicionarAcrescimo(ctx, ordemId, versao, DadosAcrescimo)`, `removerAcrescimo(ctx, ordemId, versao, acrescimoId)`, `ajustarPreco(ctx, ordemId, versao, precoFinal: string, motivo)`, `confirmarAjuste(ctx, ordemId, versao)`, `removerAjuste(ctx, ordemId, versao)`, `atualizarCabecalho(ctx, ordemId, versao, { clienteId?, prometidaPara?, responsavelId?, observacoes? })`, `aprovarOrcamento(ctx, ordemId, versao)`, `cancelarOrdem(ctx, ordemId, versao, motivo)` — todas devolvem `Totais = { versao, precoCalculado, precoFinal, subtotalItens, subtotalAcrescimos }` (strings)
  - `obterOrdemParaTela(empresaId, id): OrdemTela | null`, `listarOrdens(empresaId, { limite? })` — tudo serializável (dinheiro em string, datas em ISO)
  - `DadosItem = { descricao; materialId: string | null; quantidade: number; altura: string | null; largura: string | null; unidadeCobranca; valorUnitario: string }`, `DadosAcrescimo = { tipo; descricao; valor: string }`

- [x] **Step 1: Teste da idempotência**

`src/infra/mutacoes/idempotencia.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import { executarUmaVez, type Contexto } from './idempotencia'

let ctx: Contexto

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete', login: 'odete', senhaHash: 'x' } })
  ctx = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

describe('executarUmaVez', () => {
  it('executa uma vez e grava a resposta; a mesma chave devolve a resposta sem executar', async () => {
    let execucoes = 0
    const corpo = async () => { execucoes++; return { ok: true, n: 42 } }
    const a = await executarUmaVez(ctx, 'teste', corpo)
    const b = await executarUmaVez(ctx, 'teste', corpo)
    expect(a).toEqual({ ok: true, n: 42 })
    expect(b).toEqual(a)
    expect(execucoes).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: ctx.empresaId } })).toBe(1)
  })

  it('erro no corpo faz rollback da chave: a proxima tentativa executa de novo', async () => {
    await expect(executarUmaVez(ctx, 'teste', async () => { throw new Error('falhou') })).rejects.toThrow('falhou')
    expect(await prisma.mutacao.count({ where: { empresaId: ctx.empresaId } })).toBe(0)
    expect(await executarUmaVez(ctx, 'teste', async () => ({ ok: true }))).toEqual({ ok: true })
  })

  it('o que o corpo grava com tx e o registro da chave sao atomicos', async () => {
    await expect(executarUmaVez(ctx, 'teste', async (tx) => {
      await tx.empresa.create({ data: { razaoSocial: 'Nao deve existir' } })
      throw new Error('depois de gravar')
    })).rejects.toThrow()
    expect(await prisma.empresa.count({ where: { razaoSocial: 'Nao deve existir' } })).toBe(0)
  })

  it('chave invalida e recusada antes de tocar no banco', async () => {
    await expect(executarUmaVez({ ...ctx, chave: 'abc' }, 'teste', async () => ({}))).rejects.toThrow(/chave/)
  })
})
```

- [x] **Step 2: Rodar e ver falhar, criar, ver passar**

Run: `npm run test:int -- idempotencia` → FAIL — `Cannot find module './idempotencia'`

`src/infra/mutacoes/idempotencia.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/infra/db/prisma'

export type Tx = Prisma.TransactionClient

export interface Contexto {
  empresaId: string
  usuarioId: string
  /** crypto.randomUUID() gerado no cliente, um por tentativa. */
  chave: string
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function chaveValida(chave: string): boolean {
  return RE_UUID.test(chave)
}

function violacaoUnica(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * Registra a chave NO INICIO da transacao (o insert na unique toma o lock antes do trabalho),
 * executa o corpo com o mesmo tx e grava a resposta no fim. Se a chave ja existe, a primeira
 * execucao commitou: devolve a resposta gravada sem executar de novo. Erro no corpo desfaz tudo,
 * inclusive a chave — o retry legitimo funciona.
 */
export async function executarUmaVez<R extends Prisma.InputJsonValue>(
  ctx: Contexto,
  acao: string,
  corpo: (tx: Tx) => Promise<R>,
): Promise<R> {
  if (!chaveValida(ctx.chave)) throw new Error('chave de idempotencia invalida')

  const onde = { empresaId_chave: { empresaId: ctx.empresaId, chave: ctx.chave } }
  const anterior = await prisma.mutacao.findUnique({ where: onde, select: { resposta: true } })
  if (anterior?.resposta != null) return anterior.resposta as R

  try {
    return await prisma.$transaction(
      async (tx) => {
        const registro = await tx.mutacao.create({
          data: { empresaId: ctx.empresaId, chave: ctx.chave, acao, usuarioId: ctx.usuarioId },
          select: { id: true },
        })
        const resposta = await corpo(tx)
        await tx.mutacao.update({ where: { id: registro.id }, data: { resposta } })
        return resposta
      },
      { maxWait: 2_000, timeout: 8_000 },
    )
  } catch (e) {
    if (!violacaoUnica(e)) throw e
    const gravada = await prisma.mutacao.findUnique({ where: onde, select: { resposta: true } })
    if (gravada?.resposta == null) throw new Error('mutacao com a mesma chave ainda em andamento')
    return gravada.resposta as R
  }
}
```

Run: `npm run test:int -- idempotencia` → PASS — 4 passed

> Nota de execução (2026-08-29): `R extends Prisma.InputJsonValue` recusa interfaces (sem index signature); o genérico virou `R extends object` com cast na gravação.

- [x] **Step 3: Teste de integração do repositório de ordens — o gabarito da fase**

`src/infra/ordens/repositorio.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { resolverLinha } from '@/domain/precificacao/resolucao'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import {
  criarOrdem, adicionarItem, removerItem, adicionarAcrescimo, removerAcrescimo, ajustarPreco, confirmarAjuste,
  removerAjuste, atualizarCabecalho, aprovarOrcamento, cancelarOrdem, obterOrdemParaTela, listarOrdens,
  ConflitoVersao, OrdemNaoEditavel, type DadosItem,
} from './repositorio'

let base: Contexto
let clienteId = ''
const ctx = () => ({ ...base, chave: randomUUID() })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const cliente = await prisma.cliente.create({
    data: { empresaId: empresa.id, nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ',
      telefones: { create: [{ empresaId: empresa.id, original: '(38)9874-3013', normalizado: '38998743013', inferido: true, ordem: 0 }] } },
  })
  clienteId = cliente.id
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

/** As seis linhas da OS 18449 exatamente como estao no legado. */
const LINHAS_18449 = [
  ['06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00', '723.00'],
  ['01 PLACA ACM 50 X 50 E ADES/ IMP  62,00', '62.00'],
  ['03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00', '228.00'],
  ['12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00', '732.00'],
  ['06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00', '558.00'],
  ['03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00', '225.00'],
] as const

function dadosDaLinha(texto: string): DadosItem {
  const r = resolverLinha(texto, [])
  if (r.tipo !== 'item' || r.valorUnitario === undefined) throw new Error('linha invalida')
  return {
    descricao: r.descricao, materialId: null, quantidade: r.quantidade,
    altura: r.altura?.toFixed(4) ?? null, largura: r.largura?.toFixed(4) ?? null,
    unidadeCobranca: r.unidade, valorUnitario: r.valorUnitario.toFixed(2),
  }
}

const UNIDADE = (descricao: string, quantidade: number, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

describe('ordem de servico (banco real)', () => {
  it('reproduz a OS 18449: seis itens por unidade somando 2.528,00, como OS 18461', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta', clienteId })
    expect(ordem.numero).toBe(18461)

    let versao = ordem.versao
    for (const [linha] of LINHAS_18449) {
      versao = (await adicionarItem(ctx(), ordem.id, versao, dadosDaLinha(linha))).versao
    }

    const tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.itens.map((i) => i.total)).toEqual(LINHAS_18449.map(([, t]) => t))
    expect(tela?.itens[3]).toMatchObject({ quantidade: 12, descricao: 'PLACAS ACM E ADES/ IMP', altura: '0.6100', largura: '0.4000', unidadeCobranca: 'unidade' })
    expect(tela?.subtotalItens).toBe('2528.00')
    expect(tela?.precoCalculado).toBe('2528.00')
    expect(tela?.precoFinal).toBe('2528.00')
    expect(tela?.versao).toBe(7)
    expect(tela?.cliente).toEqual({ id: clienteId, nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ', telefone: '38998743013' })
  })

  it('numera em sequencia por empresa, sem pular, e o snapshot do cliente vem na criacao', async () => {
    const a = await criarOrdem(ctx(), { estado: 'orcamento' })
    const b = await criarOrdem(ctx(), { estado: 'aberta', clienteId })
    expect([a.numero, b.numero]).toEqual([18461, 18462])
    const gravada = await prisma.ordemServico.findUniqueOrThrow({ where: { id: b.id } })
    expect(gravada).toMatchObject({ clienteNome: 'Sandra Hofig de Barros', clienteApelido: 'Fazenda HJ', clienteTelefone: '(38)9874-3013', estadoProducao: 'aberta' })
    expect((await listarOrdens(base.empresaId)).map((o) => o.numero)).toEqual([18462, 18461])
  })

  it('a mesma chave nao duplica o item e devolve o mesmo resultado', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const c = ctx()
    const r1 = await adicionarItem(c, ordem.id, ordem.versao, UNIDADE('PLACA ACM', 1, '62.00'))
    const r2 = await adicionarItem(c, ordem.id, ordem.versao, UNIDADE('PLACA ACM', 1, '62.00'))
    expect(r2).toEqual(r1)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(1)
  })

  it('versao velha recebe conflito e nada e gravado', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '10.00'))
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('B', 1, '10.00'))).rejects.toBeInstanceOf(ConflitoVersao)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: base.empresaId, acao: 'item.adicionar' } })).toBe(1)
  })

  it('as tres formas de cobranca na mesma ordem, mais acrescimos: a OS do artboard', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = ordem.versao
    v = (await adicionarItem(ctx(), ordem.id, v, { descricao: 'Placa ACM 3 mm', materialId: null, quantidade: 6, altura: '0.6', largura: '0.8', unidadeCobranca: 'm2', valorUnitario: '120.50' })).versao
    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('Letra caixa PVC', 18, '34.00'))).versao
    v = (await adicionarItem(ctx(), ordem.id, v, { descricao: 'Perfil de aluminio', materialId: null, quantidade: 1, altura: '0.61', largura: '0.6', unidadeCobranca: 'metro_linear', valorUnitario: '28.00' })).versao
    v = (await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'instalacao', descricao: '', valor: '280.00' })).versao
    const r = await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'deslocamento', descricao: '34 km', valor: '102.00' })
    // 347,04 + 612,00 + 67,76 = 1.026,80; + 382,00 = 1.408,80
    expect(r).toMatchObject({ subtotalItens: '1026.80', subtotalAcrescimos: '382.00', precoCalculado: '1408.80', precoFinal: '1408.80' })
  })

  it('remover item e acrescimo e soft: a linha fica, sai do preco e da tela', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '10.00'))).versao
    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '5.00'))).versao
    v = (await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'frete', descricao: '', valor: '3.00' })).versao
    const tela1 = await obterOrdemParaTela(base.empresaId, ordem.id)
    const itemA = tela1!.itens.find((i) => i.descricao === 'A')!
    const frete = tela1!.acrescimos[0]!

    v = (await removerItem(ctx(), ordem.id, v, itemA.id)).versao
    const r = await removerAcrescimo(ctx(), ordem.id, v, frete.id)
    expect(r.precoCalculado).toBe('5.00')
    const tela2 = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela2?.itens.map((i) => i.descricao)).toEqual(['B'])
    expect(tela2?.acrescimos).toEqual([])
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(2)
    expect((await prisma.itemOrdem.findUniqueOrThrow({ where: { id: itemA.id } })).removidoPorId).toBe(base.usuarioId)
  })

  it('ajuste manual: preco final fica, o calculado segue os itens e a divergencia e persistida', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 2, '1000.00'))).versao
    const r1 = await ajustarPreco(ctx(), ordem.id, v, '1950.00', 'arredondamento comercial')
    expect(r1).toMatchObject({ precoCalculado: '2000.00', precoFinal: '1950.00' })
    v = r1.versao

    const r2 = await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '100.00'))
    expect(r2).toMatchObject({ precoCalculado: '2100.00', precoFinal: '1950.00' })
    let tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.ajuste).toMatchObject({ motivo: 'arredondamento comercial', por: 'Odete Silva', precoCalculadoNoAjuste: '2000.00', desatualizado: true })

    v = (await confirmarAjuste(ctx(), ordem.id, r2.versao)).versao
    tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.ajuste?.desatualizado).toBe(false)
    expect(tela?.precoFinal).toBe('1950.00')

    const r3 = await removerAjuste(ctx(), ordem.id, v)
    expect(r3.precoFinal).toBe('2100.00')
    expect((await obterOrdemParaTela(base.empresaId, ordem.id))?.ajuste).toBeNull()
  })

  it('ajuste negativo e motivo vazio sao recusados', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(ajustarPreco(ctx(), ordem.id, ordem.versao, '-1', 'x')).rejects.toThrow(/negativo/)
    await expect(ajustarPreco(ctx(), ordem.id, ordem.versao, '10', '  ')).rejects.toThrow(/motivo/)
  })

  it('cabecalho: troca de cliente refaz o snapshot; balcao limpa', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const r = await atualizarCabecalho(ctx(), ordem.id, ordem.versao, { clienteId, prometidaPara: '2026-09-04', observacoes: 'entregar na fazenda' })
    let g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g).toMatchObject({ clienteNome: 'Sandra Hofig de Barros', observacoes: 'entregar na fazenda', versao: r.versao })
    expect(g.prometidaPara?.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    await atualizarCabecalho(ctx(), ordem.id, r.versao, { clienteId: null })
    g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g.clienteId).toBeNull()
    expect(g.clienteNome).toBeNull()
  })

  it('aprovar orcamento guarda o preco aprovado; itens continuam editaveis; cancelar preserva tudo', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'orcamento' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '90.00'))).versao
    v = (await aprovarOrcamento(ctx(), ordem.id, v)).versao
    let g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g.estadoProducao).toBe('aberta')
    expect(paraDominio(g.precoAprovado!).toFixed(2)).toBe('90.00')
    expect(g.aprovadoEm).not.toBeNull()
    await expect(aprovarOrcamento(ctx(), ordem.id, v)).rejects.toBeInstanceOf(OrdemNaoEditavel)

    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '10.00'))).versao
    v = (await cancelarOrdem(ctx(), ordem.id, v, 'cliente desistiu')).versao
    g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g).toMatchObject({ estadoProducao: 'cancelada', motivoCancelamento: 'cliente desistiu' })
    expect(paraDominio(g.precoFinal).toFixed(2)).toBe('100.00')
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id, removidoEm: null } })).toBe(2)
    await expect(adicionarItem(ctx(), ordem.id, v, UNIDADE('C', 1, '1.00'))).rejects.toBeInstanceOf(OrdemNaoEditavel)
  })

  it('item invalido e recusado pelo dominio antes de gravar', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, { ...UNIDADE('A', 0, '1.00') })).rejects.toThrow(/quantidade/)
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, { ...UNIDADE('A', 1, '1.00'), unidadeCobranca: 'm2' })).rejects.toThrow(/altura e largura/)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(0)
  })

  it('nao enxerga ordem de outra empresa', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    await expect(adicionarItem({ ...ctx(), empresaId: outra.id }, ordem.id, ordem.versao, UNIDADE('X', 1, '1.00'))).rejects.toThrow('ordem nao encontrada')
    expect(await obterOrdemParaTela(outra.id, ordem.id)).toBeNull()
  })
})
```

- [x] **Step 4: Rodar e ver falhar**

Run: `npm run test:int -- ordens` → FAIL — `Cannot find module './repositorio'`

- [x] **Step 5: Criar `src/infra/ordens/repositorio.ts`**

```ts
import { prisma } from '@/infra/db/prisma'
import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { calcularItem } from '@/domain/precificacao/formulas'
import { comporOrdem } from '@/domain/precificacao/ordem'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { ItemCobranca, UnidadeCobranca } from '@/domain/precificacao/tipos'
import type { TipoAcrescimo } from '@/domain/precificacao/resolucao'
import type { EstadoProducao } from '@/domain/ordem/estados'
import { transicionar } from '@/domain/ordem/estados'
import { lerDataCalendario } from '@/domain/ordem/datas'
import { executarUmaVez, type Contexto, type Tx } from '@/infra/mutacoes/idempotencia'

export class ConflitoVersao extends Error {
  constructor() { super('a ordem mudou desde a ultima leitura') }
}
export class OrdemNaoEditavel extends Error {
  constructor(estado: string) { super(`ordem ${estado}: nao aceita esta alteracao`) }
}

export interface DadosItem {
  descricao: string
  materialId: string | null
  quantidade: number
  /** Em metros, como string decimal; null quando nao informada. */
  altura: string | null
  largura: string | null
  unidadeCobranca: UnidadeCobranca
  /** String decimal ('61.00'). */
  valorUnitario: string
}

export interface DadosAcrescimo {
  tipo: TipoAcrescimo
  descricao: string
  valor: string
}

export interface DadosCabecalho {
  clienteId?: string | null
  /** 'AAAA-MM-DD' ou null. */
  prometidaPara?: string | null
  responsavelId?: string
  observacoes?: string | null
}

/** JSON puro: e o que a action devolve e o que a tabela mutacao guarda. */
export interface Totais {
  versao: number
  subtotalItens: string
  subtotalAcrescimos: string
  precoCalculado: string
  precoFinal: string
}

/** Itens e acrescimos vivos: o unico lugar onde o filtro de removido e escrito. */
const VIVOS = { removidoEm: null } as const

function editavel(estado: EstadoProducao): boolean {
  return estado === 'orcamento' || estado === 'aberta'
}

async function carregar(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await tx.ordemServico.findFirst({
    where: { id: ordemId, empresaId: ctx.empresaId },
    select: { id: true, estadoProducao: true, versao: true, ajustadoPorId: true, precoFinal: true, precoCalculadoNoAjuste: true },
  })
  if (!ordem) throw new Error('ordem nao encontrada')
  if (ordem.versao !== versao) throw new ConflitoVersao()
  return ordem
}

async function carregarEditavel(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await carregar(tx, ctx, ordemId, versao)
  if (!editavel(ordem.estadoProducao)) throw new OrdemNaoEditavel(ordem.estadoProducao)
  return ordem
}

/**
 * Rele itens e acrescimos vivos, recompoe pelo dominio (strings exatas, nunca Number) e grava
 * com a trava: updateMany pela versao lida; 0 linhas = alguem gravou antes -> rollback.
 * Com ajuste manual, preco_final fica como esta (spec, secao 5).
 */
async function recalcular(tx: Tx, ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  const [itens, acrescimos, ordem] = await Promise.all([
    tx.itemOrdem.findMany({ where: { ordemId, empresaId: ctx.empresaId, ...VIVOS } }),
    tx.acrescimoOrdem.findMany({ where: { ordemId, empresaId: ctx.empresaId, ...VIVOS } }),
    tx.ordemServico.findFirstOrThrow({ where: { id: ordemId, empresaId: ctx.empresaId }, select: { ajustadoPorId: true, precoFinal: true } }),
  ])
  const cobrancas: ItemCobranca[] = itens.map((i) => ({
    unidade: i.unidadeCobranca, quantidade: i.quantidade,
    valorUnitario: paraDominio(i.valorUnitario).toFixed(),
    altura: i.altura ? paraDominio(i.altura).toFixed() : undefined,
    largura: i.largura ? paraDominio(i.largura).toFixed() : undefined,
  }))
  const temAjuste = ordem.ajustadoPorId !== null
  const c = comporOrdem(
    cobrancas,
    acrescimos.map((a) => ({ tipo: a.tipo, descricao: a.descricao, valor: paraDominio(a.valor).toFixed() })),
    temAjuste ? paraDominio(ordem.precoFinal).toFixed() : undefined,
  )
  const { count } = await tx.ordemServico.updateMany({
    where: { id: ordemId, empresaId: ctx.empresaId, versao },
    data: {
      subtotalItens: paraBanco(c.subtotalItens),
      subtotalAcrescimos: paraBanco(c.subtotalAcrescimos),
      precoCalculado: paraBanco(c.precoCalculado),
      precoFinal: paraBanco(c.precoFinal),
      versao: { increment: 1 },
    },
  })
  if (count === 0) throw new ConflitoVersao()
  return {
    versao: versao + 1,
    subtotalItens: c.subtotalItens.toFixed(2),
    subtotalAcrescimos: c.subtotalAcrescimos.toFixed(2),
    precoCalculado: c.precoCalculado.toFixed(2),
    precoFinal: c.precoFinal.toFixed(2),
  }
}

async function snapshotCliente(tx: Tx, empresaId: string, clienteId: string | null | undefined) {
  if (!clienteId) return { clienteId: null, clienteNome: null, clienteApelido: null, clienteTelefone: null }
  const c = await tx.cliente.findFirst({
    where: { id: clienteId, empresaId },
    select: { id: true, nome: true, apelido: true, telefones: { orderBy: { ordem: 'asc' }, take: 1, select: { original: true } } },
  })
  if (!c) throw new ErroDeValidacao('cliente nao encontrado')
  return { clienteId: c.id, clienteNome: c.nome, clienteApelido: c.apelido, clienteTelefone: c.telefones[0]?.original ?? null }
}

export async function criarOrdem(
  ctx: Contexto,
  dados: { estado: 'orcamento' | 'aberta'; clienteId?: string | null; prometidaPara?: string | null; responsavelId?: string },
): Promise<{ id: string; numero: number; versao: number }> {
  return executarUmaVez(ctx, 'ordem.criar', async (tx) => {
    // Row lock ate o commit: sem buraco e sem duplicata, por empresa.
    const contador = await tx.contadorEmpresa.update({
      where: { empresaId: ctx.empresaId },
      data: { proximaOs: { increment: 1 } },
      select: { proximaOs: true },
    })
    const snapshot = await snapshotCliente(tx, ctx.empresaId, dados.clienteId)
    const prometida = dados.prometidaPara ? lerDataCalendario(dados.prometidaPara) : null
    return tx.ordemServico.create({
      data: {
        empresaId: ctx.empresaId,
        numero: contador.proximaOs - 1,
        estadoProducao: dados.estado,
        responsavelId: dados.responsavelId ?? ctx.usuarioId,
        prometidaPara: prometida,
        ...snapshot,
      },
      select: { id: true, numero: true, versao: true },
    })
  })
}

function colunasItem(ctx: Contexto, dados: DadosItem) {
  const cobranca: ItemCobranca = {
    unidade: dados.unidadeCobranca, quantidade: dados.quantidade, valorUnitario: dados.valorUnitario,
    altura: dados.altura ?? undefined, largura: dados.largura ?? undefined,
  }
  const r = calcularItem(cobranca) // valida (quantidade, medida) e da o total congelado
  const dim = (v: string | null) => (v === null ? null : paraBanco(dinheiro(v).toDecimalPlaces(4)))
  return {
    empresaId: ctx.empresaId,
    descricao: dados.descricao.trim().slice(0, 160),
    materialId: dados.materialId,
    quantidade: dados.quantidade,
    altura: dim(dados.altura),
    largura: dim(dados.largura),
    unidadeCobranca: dados.unidadeCobranca,
    valorUnitario: paraBanco(dinheiro(dados.valorUnitario)),
    total: paraBanco(r.total),
  }
}

export async function adicionarItem(ctx: Contexto, ordemId: string, versao: number, dados: DadosItem): Promise<Totais> {
  if (dados.descricao.trim() === '') throw new ErroDeValidacao('descreva o item')
  const colunas = colunasItem(ctx, dados) // lanca ErroDeValidacao antes de abrir a transacao
  return executarUmaVez(ctx, 'item.adicionar', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const ultimo = await tx.itemOrdem.aggregate({ where: { ordemId }, _max: { ordemExibicao: true } })
    await tx.itemOrdem.create({ data: { ...colunas, ordemId, ordemExibicao: (ultimo._max.ordemExibicao ?? 0) + 1 } })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function removerItem(ctx: Contexto, ordemId: string, versao: number, itemId: string): Promise<Totais> {
  return executarUmaVez(ctx, 'item.remover', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const { count } = await tx.itemOrdem.updateMany({
      where: { id: itemId, ordemId, empresaId: ctx.empresaId, ...VIVOS },
      data: { removidoEm: new Date(), removidoPorId: ctx.usuarioId },
    })
    if (count === 0) throw new ErroDeValidacao('item nao encontrado')
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function adicionarAcrescimo(ctx: Contexto, ordemId: string, versao: number, dados: DadosAcrescimo): Promise<Totais> {
  const valor = dinheiro(dados.valor)
  if (valor.lte(0)) throw new ErroDeValidacao('valor do acrescimo precisa ser maior que zero')
  return executarUmaVez(ctx, 'acrescimo.adicionar', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.acrescimoOrdem.create({
      data: { empresaId: ctx.empresaId, ordemId, tipo: dados.tipo, descricao: dados.descricao.trim().slice(0, 120), valor: paraBanco(valor) },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function removerAcrescimo(ctx: Contexto, ordemId: string, versao: number, acrescimoId: string): Promise<Totais> {
  return executarUmaVez(ctx, 'acrescimo.remover', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const { count } = await tx.acrescimoOrdem.updateMany({
      where: { id: acrescimoId, ordemId, empresaId: ctx.empresaId, ...VIVOS },
      data: { removidoEm: new Date(), removidoPorId: ctx.usuarioId },
    })
    if (count === 0) throw new ErroDeValidacao('acrescimo nao encontrado')
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** Ajuste manual: os quatro campos juntos. O recalculo em seguida respeita o preco final. */
export async function ajustarPreco(ctx: Contexto, ordemId: string, versao: number, precoFinal: string, motivo: string): Promise<Totais> {
  const preco = dinheiro(precoFinal)
  if (preco.lt(0)) throw new ErroDeValidacao('preco final nao pode ser negativo')
  if (motivo.trim() === '') throw new ErroDeValidacao('o motivo do ajuste e obrigatorio')
  return executarUmaVez(ctx, 'ordem.ajustar', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    const atual = await tx.ordemServico.findUniqueOrThrow({ where: { id: ordem.id }, select: { precoCalculado: true } })
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: {
        precoFinal: paraBanco(preco), motivoAjuste: motivo.trim().slice(0, 160),
        ajustadoPorId: ctx.usuarioId, ajustadoEm: new Date(), precoCalculadoNoAjuste: atual.precoCalculado,
      },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** "Manter o preco final": o ajuste passa a valer para o calculado atual. */
export async function confirmarAjuste(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.confirmar_ajuste', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    if (ordem.ajustadoPorId === null) throw new ErroDeValidacao('a ordem nao tem ajuste')
    const atual = await tx.ordemServico.findUniqueOrThrow({ where: { id: ordem.id }, select: { precoCalculado: true } })
    await tx.ordemServico.update({ where: { id: ordem.id }, data: { precoCalculadoNoAjuste: atual.precoCalculado } })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** "Usar o calculado": zera o ajuste; o recalculo faz preco_final seguir o calculado. */
export async function removerAjuste(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.remover_ajuste', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: { motivoAjuste: null, ajustadoPorId: null, ajustadoEm: null, precoCalculadoNoAjuste: null },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function atualizarCabecalho(ctx: Contexto, ordemId: string, versao: number, dados: DadosCabecalho): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.cabecalho', async (tx) => {
    const ordem = await carregar(tx, ctx, ordemId, versao)
    const soObservacoes = dados.clienteId === undefined && dados.prometidaPara === undefined && dados.responsavelId === undefined
    if (!editavel(ordem.estadoProducao) && !(soObservacoes && ordem.estadoProducao === 'concluida')) {
      throw new OrdemNaoEditavel(ordem.estadoProducao)
    }
    const snapshot = dados.clienteId === undefined ? {} : await snapshotCliente(tx, ctx.empresaId, dados.clienteId)
    let prometida: Date | null | undefined
    if (dados.prometidaPara !== undefined) {
      prometida = dados.prometidaPara ? lerDataCalendario(dados.prometidaPara) : null
      if (dados.prometidaPara && !prometida) throw new ErroDeValidacao('data prometida invalida')
    }
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: {
        ...snapshot,
        ...(prometida !== undefined ? { prometidaPara: prometida } : {}),
        ...(dados.responsavelId ? { responsavelId: dados.responsavelId } : {}),
        ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes?.trim() || null } : {}),
      },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function aprovarOrcamento(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.aprovar', async (tx) => {
    const ordem = await carregar(tx, ctx, ordemId, versao)
    if (ordem.estadoProducao !== 'orcamento') throw new OrdemNaoEditavel(ordem.estadoProducao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: { estadoProducao: transicionar('orcamento', 'aberta'), aprovadoEm: new Date(), precoAprovado: ordem.precoFinal },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function cancelarOrdem(ctx: Contexto, ordemId: string, versao: number, motivo: string): Promise<Totais> {
  if (motivo.trim() === '') throw new ErroDeValidacao('o motivo do cancelamento e obrigatorio')
  return executarUmaVez(ctx, 'ordem.cancelar', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: { estadoProducao: transicionar(ordem.estadoProducao, 'cancelada'), canceladaEm: new Date(), motivoCancelamento: motivo.trim().slice(0, 160) },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export * from './tela'
```

`src/infra/ordens/tela.ts` — leitura serializável para a página e a lista:
```ts
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { ajusteDesatualizado, type EstadoProducao } from '@/domain/ordem/estados'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import type { TipoAcrescimo } from '@/domain/precificacao/resolucao'

/** Tudo serializavel: dinheiro em string, datas em ISO. Vai para Server e Client Components. */
export interface ItemTela {
  id: string
  descricao: string
  quantidade: number
  altura: string | null
  largura: string | null
  unidadeCobranca: UnidadeCobranca
  valorUnitario: string
  total: string
}

export interface AcrescimoTela {
  id: string
  tipo: TipoAcrescimo
  descricao: string
  valor: string
}

export interface OrdemTela {
  id: string
  numero: number
  estadoProducao: EstadoProducao
  versao: number
  cliente: { id: string | null; nome: string; apelido: string | null; telefone: string | null } | null
  responsavel: { id: string; nome: string }
  observacoes: string | null
  abertaEm: string
  prometidaPara: string | null
  aprovadoEm: string | null
  precoAprovado: string | null
  canceladaEm: string | null
  motivoCancelamento: string | null
  subtotalItens: string
  subtotalAcrescimos: string
  precoCalculado: string
  precoFinal: string
  ajuste: { motivo: string; por: string; precoCalculadoNoAjuste: string; desatualizado: boolean } | null
  itens: ItemTela[]
  acrescimos: AcrescimoTela[]
}

const d2 = (v: Parameters<typeof paraDominio>[0]) => paraDominio(v).toFixed(2)
const d4 = (v: Parameters<typeof paraDominio>[0] | null) => (v === null ? null : paraDominio(v).toFixed(4))

export async function obterOrdemParaTela(empresaId: string, id: string): Promise<OrdemTela | null> {
  const o = await prisma.ordemServico.findFirst({
    where: { id, empresaId },
    include: {
      responsavel: { select: { id: true, nome: true } },
      ajustadoPor: { select: { nome: true } },
      itens: { where: { removidoEm: null }, orderBy: { ordemExibicao: 'asc' } },
      acrescimos: { where: { removidoEm: null }, orderBy: { criadoEm: 'asc' } },
    },
  })
  if (!o) return null
  const precoCalculado = d2(o.precoCalculado)
  const precoCalculadoNoAjuste = o.precoCalculadoNoAjuste === null ? null : d2(o.precoCalculadoNoAjuste)
  return {
    id: o.id,
    numero: o.numero,
    estadoProducao: o.estadoProducao,
    versao: o.versao,
    cliente: o.clienteNome === null ? null : { id: o.clienteId, nome: o.clienteNome, apelido: o.clienteApelido, telefone: o.clienteTelefone },
    responsavel: o.responsavel,
    observacoes: o.observacoes,
    abertaEm: o.abertaEm.toISOString(),
    prometidaPara: o.prometidaPara?.toISOString() ?? null,
    aprovadoEm: o.aprovadoEm?.toISOString() ?? null,
    precoAprovado: o.precoAprovado === null ? null : d2(o.precoAprovado),
    canceladaEm: o.canceladaEm?.toISOString() ?? null,
    motivoCancelamento: o.motivoCancelamento,
    subtotalItens: d2(o.subtotalItens),
    subtotalAcrescimos: d2(o.subtotalAcrescimos),
    precoCalculado,
    precoFinal: d2(o.precoFinal),
    ajuste: o.ajustadoPorId === null || o.motivoAjuste === null ? null : {
      motivo: o.motivoAjuste,
      por: o.ajustadoPor?.nome ?? '',
      precoCalculadoNoAjuste: precoCalculadoNoAjuste ?? precoCalculado,
      desatualizado: ajusteDesatualizado({ temAjuste: true, precoCalculado, precoCalculadoNoAjuste }),
    },
    itens: o.itens.map((i) => ({
      id: i.id, descricao: i.descricao, quantidade: i.quantidade, altura: d4(i.altura), largura: d4(i.largura),
      unidadeCobranca: i.unidadeCobranca, valorUnitario: d2(i.valorUnitario), total: d2(i.total),
    })),
    acrescimos: o.acrescimos.map((a) => ({ id: a.id, tipo: a.tipo, descricao: a.descricao, valor: d2(a.valor) })),
  }
}

export interface OrdemResumo {
  id: string
  numero: number
  estadoProducao: EstadoProducao
  clienteNome: string | null
  clienteApelido: string | null
  abertaEm: string
  prometidaPara: string | null
  precoFinal: string
}

export async function listarOrdens(empresaId: string, opcoes: { limite?: number } = {}): Promise<OrdemResumo[]> {
  const linhas = await prisma.ordemServico.findMany({
    where: { empresaId },
    orderBy: { numero: 'desc' },
    take: opcoes.limite ?? 100,
    select: { id: true, numero: true, estadoProducao: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, precoFinal: true },
  })
  return linhas.map((o) => ({
    id: o.id, numero: o.numero, estadoProducao: o.estadoProducao, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
    abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null, precoFinal: d2(o.precoFinal),
  }))
}
```

- [x] **Step 6: Rodar e ver passar**

Run: `npm run test:int -- ordens` → PASS — 12 passed. Se `descricao` do item 4 não vier `PLACAS ACM E ADES/ IMP`, conferir o que `interpretarLinha` devolve para a linha (o parser remove a dimensão e junta o resto).

- [x] **Step 7: Verificação e commit**

Run: `npm run typecheck` → sem erros. Run: `npm run test:int` → PASS — 37 passed. Run: `npm test` → PASS.

```bash
git add src/infra/mutacoes/ src/infra/ordens/
git commit -m "feat: repositorio de ordens com recalculo transacional, trava otimista e idempotencia"
```

---
### Task 4: Telas — lista, nova ordem e a tela da ordem com entrada assistida

**Files:**
- Modify: `src/app/(app)/navegacao.ts`, `src/app/(app)/layout.tsx` (ícone)
- Create: `src/app/(app)/ordens/page.tsx`, `src/app/(app)/ordens/nova/page.tsx`, `src/app/(app)/ordens/nova/actions.ts`
- Create: `src/app/(app)/ordens/[id]/page.tsx`, `src/app/(app)/ordens/[id]/actions.ts`, `src/app/(app)/ordens/[id]/chave.ts`, `src/app/(app)/ordens/[id]/entrada-linha.tsx`, `src/app/(app)/ordens/[id]/botao-mutacao.tsx`, `src/app/(app)/ordens/[id]/form-ajuste.tsx`, `src/app/(app)/ordens/[id]/form-cabecalho.tsx`, `src/app/(app)/ordens/[id]/form-cancelar.tsx`
- Test: `src/app/(app)/ordens/[id]/chave.test.ts`

**Interfaces:**
- Produces: rotas `/ordens`, `/ordens/nova`, `/ordens/[id]`; `type Resposta = { ok: true; totais: Totais } | { ok: false; conflito: true } | { ok: false; conflito?: false; erro: string }`; actions `adicionarItemAction`, `adicionarAcrescimoAction`, `removerItemAction`, `removerAcrescimoAction`, `ajustarPrecoAction`, `confirmarAjusteAction`, `removerAjusteAction`, `atualizarCabecalhoAction`, `aprovarOrcamentoAction`, `cancelarOrdemAction`, `buscarClientesAction`; `gerarChave(): string`

- [ ] **Step 1: Navegação e gerador de chave**

Em `navegacao.ts`, inserir após "Fila de trabalho": `{ href: '/ordens', titulo: 'Ordens', icone: 'ordens' }` e acrescentar `'ordens'` ao tipo `icone`. No `layout.tsx`, `ICONES.ordens = <IconFileInvoice className="icon" />` (importar de `@tabler/icons-react`).

`src/app/(app)/ordens/[id]/chave.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { gerarChave } from './chave'

describe('gerarChave', () => {
  it('gera UUID v4 valido e diferente a cada chamada', () => {
    const a = gerarChave()
    const b = gerarChave()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})
```

`src/app/(app)/ordens/[id]/chave.ts`:
```ts
/**
 * Chave de idempotencia gerada no cliente. crypto.randomUUID so existe em contexto seguro
 * (https/localhost); se a loja acessar por http://ip-da-rede, o fallback monta o UUID v4 a mao.
 */
export function gerarChave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
```

Run: `npm test -- chave` → vermelho (`Cannot find module`), depois PASS — 1 passed.

- [ ] **Step 2: Lista e nova ordem**

`src/app/(app)/ordens/nova/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { criarOrdem } from '@/infra/ordens/repositorio'

export async function criarOrdemAction(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const estado = formData.get('estado') === 'orcamento' ? 'orcamento' : 'aberta'
  const chave = String(formData.get('chave') ?? '')
  const ordem = await criarOrdem({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave }, { estado })
  redirect(`/ordens/${ordem.id}`)
}
```

`src/app/(app)/ordens/nova/page.tsx` — a chave nasce no render do servidor: um reenvio do mesmo formulário reaproveita a mesma chave e não cria duas ordens.
```tsx
import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { criarOrdemAction } from './actions'

export const metadata: Metadata = { title: 'Nova ordem' }

export default async function PaginaNovaOrdem() {
  await exigirUsuario()
  const chave = randomUUID()
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Atendimento</div>
          <h2 className="page-title">Nova ordem</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <p className="text-secondary">O que o cliente quer: uma ordem de serviço para produzir agora, ou um orçamento para ele decidir depois. Aprovar o orçamento não recria nada — só muda o estado e trava o preço.</p>
              <form action={criarOrdemAction} className="d-flex gap-2">
                <input type="hidden" name="chave" value={chave} />
                <button type="submit" name="estado" value="aberta" className="btn btn-primary" autoFocus>Ordem de serviço</button>
                <button type="submit" name="estado" value="orcamento" className="btn">Orçamento</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

`src/app/(app)/ordens/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { listarOrdens } from '@/infra/ordens/repositorio'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { ROTULO_ESTADO } from '@/domain/ordem/estados'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Ordens' }

const COR_ESTADO = { orcamento: 'bg-secondary-lt', aberta: 'bg-primary-lt', concluida: 'bg-success-lt', cancelada: 'bg-danger-lt' } as const

export default async function PaginaOrdens() {
  const usuario = await exigirUsuario()
  const ordens = await listarOrdens(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Ordens</h2>
            </div>
            <div className="col-auto">
              <Link href="/ordens/nova" className="btn btn-primary"><IconPlus className="icon" /> Nova ordem</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          {ordens.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Nenhuma ordem ainda</p>
              <p className="empty-subtitle text-secondary">A primeira será a nº 18461, continuando a numeração do sistema antigo.</p>
              <div className="empty-action"><Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link></div>
            </div></div></div>
          ) : (
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead><tr><th>Nº</th><th>Cliente</th><th>Situação</th><th>Aberta em</th><th>Entrega</th><th className="text-end">Preço final</th></tr></thead>
                <tbody>
                  {ordens.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{String(o.numero).padStart(6, '0')}</Link></td>
                      <td>{o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}{o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}</td>
                      <td><span className={`badge ${COR_ESTADO[o.estadoProducao]}`}>{ROTULO_ESTADO[o.estadoProducao]}</span></td>
                      <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                      <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
                      <td className="numero">{formatarMoeda(dinheiro(o.precoFinal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Actions da ordem**

`src/app/(app)/ordens/[id]/actions.ts` — cada action: autenticação, chave válida, chamada ao repositório, `revalidatePath` e resposta JSON pura. Só `ConflitoVersao`, `OrdemNaoEditavel` e `ErroDeValidacao` viram `{ ok: false }`; o resto estoura para o `error.tsx`.
```tsx
'use server'

import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { chaveValida, type Contexto } from '@/infra/mutacoes/idempotencia'
import { buscarClientes, type ClienteResumo } from '@/infra/clientes/repositorio'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import * as ordens from '@/infra/ordens/repositorio'
import type { DadosItem, DadosAcrescimo, DadosCabecalho, Totais } from '@/infra/ordens/repositorio'

export type Resposta =
  | { ok: true; totais: Totais }
  | { ok: false; conflito: true }
  | { ok: false; conflito?: false; erro: string }

async function executar(ordemId: string, chave: string, corpo: (ctx: Contexto) => Promise<Totais>): Promise<Resposta> {
  const usuario = await exigirUsuario()
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    const totais = await corpo({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave })
    // Sem redirect: a resposta desta action ja traz a rota re-renderizada (tabela e painel).
    revalidatePath(`/ordens/${ordemId}`)
    return { ok: true, totais }
  } catch (e) {
    if (e instanceof ordens.ConflitoVersao) return { ok: false, conflito: true }
    if (e instanceof ordens.OrdemNaoEditavel) return { ok: false, erro: 'Esta ordem não aceita mais alterações.' }
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function adicionarItemAction(ordemId: string, versao: number, chave: string, dados: DadosItem): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.adicionarItem(ctx, ordemId, versao, dados))
}
export async function adicionarAcrescimoAction(ordemId: string, versao: number, chave: string, dados: DadosAcrescimo): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.adicionarAcrescimo(ctx, ordemId, versao, dados))
}
export async function removerItemAction(ordemId: string, versao: number, itemId: string, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerItem(ctx, ordemId, versao, itemId))
}
export async function removerAcrescimoAction(ordemId: string, versao: number, acrescimoId: string, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerAcrescimo(ctx, ordemId, versao, acrescimoId))
}
export async function ajustarPrecoAction(ordemId: string, versao: number, chave: string, precoFinal: string, motivo: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.ajustarPreco(ctx, ordemId, versao, precoFinal, motivo))
}
export async function confirmarAjusteAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.confirmarAjuste(ctx, ordemId, versao))
}
export async function removerAjusteAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerAjuste(ctx, ordemId, versao))
}
export async function atualizarCabecalhoAction(ordemId: string, versao: number, chave: string, dados: DadosCabecalho): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.atualizarCabecalho(ctx, ordemId, versao, dados))
}
export async function aprovarOrcamentoAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.aprovarOrcamento(ctx, ordemId, versao))
}
export async function cancelarOrdemAction(ordemId: string, versao: number, chave: string, motivo: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.cancelarOrdem(ctx, ordemId, versao, motivo))
}

export async function buscarClientesAction(termo: string): Promise<ClienteResumo[]> {
  const usuario = await exigirUsuario()
  if (termo.trim().length < 2) return []
  return buscarClientes(usuario.empresaId, termo, { limite: 8 })
}
```

- [ ] **Step 4: A entrada assistida (Client Component)**

`src/app/(app)/ordens/[id]/entrada-linha.tsx` — o campo é controlado (preview a cada tecla); Enter chama a action dentro de `startTransition` e só limpa depois do commit; Esc limpa; o campo nunca fica `disabled`; a chave sobrevive ao retry e é renovada só após resposta do servidor.
```tsx
'use client'

import { useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { resolverLinha, descreverLinha, proximaUnidade, type MaterialCatalogo } from '@/domain/precificacao/resolucao'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import { adicionarItemAction, adicionarAcrescimoAction, type Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  /** Do Server Component: chega incrementada a cada action, na mesma resposta. */
  versao: number
  catalogo: MaterialCatalogo[]
}

const ROTULO_PENDENCIA = {
  valor: 'Falta o valor unitário.',
  quantidade: 'Quantidade precisa ser maior que zero.',
  dimensao: 'Informe altura x largura para cobrar por m² ou metro linear — ou cobre por unidade.',
  tipo_acrescimo: 'Tipo do acréscimo: instalacao, deslocamento, frete ou imposto.',
} as const

const ROTULO_ORIGEM = { material: 'unidade do material', padrao: 'sem material no catálogo: por unidade', sufixo: 'unidade pelo sufixo', escolhida: 'unidade escolhida' } as const

export function EntradaLinha({ ordemId, versao, catalogo }: Props) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<UnidadeCobranca | undefined>()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [mostrarPendencia, setMostrarPendencia] = useState(false)
  const [pendente, iniciar] = useTransition()
  const campo = useRef<HTMLInputElement>(null)
  const chave = useRef(gerarChave())

  const resolvido = useMemo(
    () => (texto.trim() === '' ? null : resolverLinha(texto, catalogo, { unidadeEscolhida })),
    [texto, catalogo, unidadeEscolhida],
  )
  const preview = resolvido ? descreverLinha(resolvido) : null

  function limpar() {
    setTexto(''); setUnidadeEscolhida(undefined); setResposta(null); setMostrarPendencia(false)
    campo.current?.focus()
  }

  function confirmar() {
    if (!resolvido || pendente) return
    if (resolvido.pendencias.length > 0) { setMostrarPendencia(true); return }
    const base = [ordemId, versao, chave.current] as const
    iniciar(async () => {
      const r = resolvido.tipo === 'acrescimo'
        ? await adicionarAcrescimoAction(...base, { tipo: resolvido.tipoAcrescimo!, descricao: resolvido.descricao, valor: resolvido.valor!.toFixed(2) })
        : await adicionarItemAction(...base, {
            descricao: resolvido.material ? `${resolvido.material.nome}${resolvido.descricao ? ` — ${resolvido.descricao}` : ''}` : resolvido.descricao,
            materialId: resolvido.material?.id ?? null,
            quantidade: resolvido.quantidade,
            altura: resolvido.altura?.toFixed(4) ?? null,
            largura: resolvido.largura?.toFixed(4) ?? null,
            unidadeCobranca: resolvido.unidade,
            valorUnitario: resolvido.valorUnitario!.toFixed(2),
          })
      setResposta(r)
      // A chave so muda depois que o servidor respondeu; no conflito ela fica (a intencao e a mesma).
      if (r.ok) { chave.current = gerarChave(); setTexto(''); setUnidadeEscolhida(undefined); setMostrarPendencia(false) }
      else if (!r.conflito) chave.current = gerarChave()
      campo.current?.focus()
    })
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmar() }
    else if (e.key === 'Escape') { e.preventDefault(); limpar() }
    else if (e.altKey && e.key.toLowerCase() === 'u' && resolvido?.tipo === 'item') { e.preventDefault(); setUnidadeEscolhida(proximaUnidade(resolvido.unidade)) }
  }

  const conflito = resposta !== null && !resposta.ok && resposta.conflito === true
  const erro = resposta !== null && !resposta.ok && !resposta.conflito ? resposta.erro : null

  return (
    <div className="card-body" aria-busy={pendente}>
      {conflito ? (
        <div className="alert alert-warning d-flex align-items-center" role="alert">
          <div className="flex-fill">Esta ordem mudou enquanto você editava. O que você digitou está preservado.</div>
          <button type="button" className="btn btn-warning" onClick={() => { setResposta(null); router.refresh() }}>Recarregar e continuar</button>
        </div>
      ) : null}
      <label className="form-label" htmlFor="linha">Lançar item ou acréscimo</label>
      <input
        ref={campo} id="linha" className="form-control form-control-lg" autoComplete="off" autoFocus
        placeholder="12 placas ACM 61x40 61,00 — ou +instalacao 280"
        value={texto} onKeyDown={aoTeclar}
        onChange={(e) => { setTexto(e.target.value); setUnidadeEscolhida(undefined); setMostrarPendencia(false); if (erro) setResposta(null) }}
      />
      <div className="mt-2" aria-live="polite" id="preview">
        {resolvido && preview ? (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-secondary">Entendi: {preview.texto}</span>
            {preview.total ? <strong>→ {preview.total}</strong> : null}
            {preview.conferencia === 'diverge' ? <span className="badge bg-warning-lt">o total digitado não bate com qtd × unitário</span> : null}
            {resolvido.tipo === 'item' ? (
              <select className="form-select form-select-sm w-auto" aria-label="Cobrar por" value={resolvido.unidade}
                title={ROTULO_ORIGEM[resolvido.origemUnidade]}
                onChange={(e) => setUnidadeEscolhida(e.target.value as UnidadeCobranca)}>
                <option value="unidade">por unidade</option>
                <option value="m2">por m² (área)</option>
                <option value="metro_linear">por metro linear (perímetro)</option>
              </select>
            ) : null}
            <span className="small text-secondary">{pendente ? 'Gravando…' : 'Enter adiciona · Esc limpa · Alt+U troca a unidade'}</span>
          </div>
        ) : (
          <span className="small text-secondary">Digite como no papel: quantidade, o que é, medida e valor. Acréscimo começa com +.</span>
        )}
        {mostrarPendencia && resolvido && resolvido.pendencias[0] ? <div className="text-danger mt-1" role="alert">{ROTULO_PENDENCIA[resolvido.pendencias[0]]}</div> : null}
        {erro ? <div className="text-danger mt-1" role="alert">{erro} Enter para tentar de novo.</div> : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Botão de mutação, ajuste, cabeçalho e cancelamento (Client Components)**

`src/app/(app)/ordens/[id]/botao-mutacao.tsx` — recebe uma Server Action já vinculada aos argumentos (`.bind`), gera a chave por tentativa e mostra conflito.
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  acao: (chave: string) => Promise<Resposta>
  rotulo: string
  className?: string
  confirmar?: string
}

export function BotaoMutacao({ acao, rotulo, className = 'btn', confirmar }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className={className} disabled={pendente} aria-label={rotulo}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return
          iniciar(async () => {
            const r = await acao(chave.current)
            if (r.ok) { chave.current = gerarChave(); setErro(null) }
            else if (r.conflito) { setErro('A ordem mudou. Recarregando…'); router.refresh() }
            else { chave.current = gerarChave(); setErro(r.erro) }
          })
        }}>
        {rotulo}
      </button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
```

`src/app/(app)/ordens/[id]/form-ajuste.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ajustarPrecoAction, type Resposta } from './actions'
import { gerarChave } from './chave'

export function FormAjuste({ ordemId, versao, precoFinal, motivo }: { ordemId: string; versao: number; precoFinal: string; motivo: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const chave = useRef(gerarChave())
  const [preco, setPreco] = useState(precoFinal.replace('.', ','))
  const [texto, setTexto] = useState(motivo)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (pendente) return
        iniciar(async () => {
          const r = await ajustarPrecoAction(ordemId, versao, chave.current, preco.replace(/\./g, '').replace(',', '.'), texto)
          setResposta(r)
          if (r.ok) chave.current = gerarChave()
          else if (r.conflito) router.refresh()
          else chave.current = gerarChave()
        })
      }}
      className="d-flex flex-column gap-2"
    >
      <label className="form-label mb-0" htmlFor="precoFinal">Preço final</label>
      <div className="input-group">
        <span className="input-group-text">R$</span>
        <input id="precoFinal" className="form-control numero" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <label className="form-label mb-0" htmlFor="motivoAjuste">Motivo do ajuste</label>
      <input id="motivoAjuste" className="form-control" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="arredondamento comercial, cliente antigo…" required />
      <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? 'Gravando…' : 'Ajustar preço'}</button>
      {resposta && !resposta.ok && !resposta.conflito ? <div className="text-danger small" role="alert">{resposta.erro}</div> : null}
    </form>
  )
}
```

`src/app/(app)/ordens/[id]/form-cabecalho.tsx` — cliente por busca (listbox nativo), balcão, data prometida, responsável e observações; um Salvar (Ctrl+S).
```tsx
'use client'

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ClienteResumo } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { atualizarCabecalhoAction, buscarClientesAction, type Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  versao: number
  cliente: { id: string | null; nome: string; apelido: string | null } | null
  prometidaPara: string | null
  responsavelId: string
  usuarios: Array<{ id: string; nome: string }>
  observacoes: string | null
  somenteObservacoes: boolean
}

export function FormCabecalho(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const chave = useRef(gerarChave())
  const [clienteId, setClienteId] = useState<string | null>(p.cliente?.id ?? null)
  const [clienteNome, setClienteNome] = useState(p.cliente ? `${p.cliente.nome}${p.cliente.apelido ? ` (${p.cliente.apelido})` : ''}` : '')
  const [termo, setTermo] = useState('')
  const [sugestoes, setSugestoes] = useState<ClienteResumo[]>([])
  const [prometida, setPrometida] = useState(p.prometidaPara?.slice(0, 10) ?? '')
  const [responsavelId, setResponsavelId] = useState(p.responsavelId)
  const [observacoes, setObservacoes] = useState(p.observacoes ?? '')

  useEffect(() => {
    if (termo.trim().length < 2) { setSugestoes([]); return }
    const t = setTimeout(() => { buscarClientesAction(termo).then(setSugestoes) }, 150)
    return () => clearTimeout(t)
  }, [termo])

  function escolher(c: ClienteResumo | null) {
    setClienteId(c?.id ?? null)
    setClienteNome(c ? `${c.nome}${c.apelido ? ` (${c.apelido})` : ''}` : '')
    setTermo(''); setSugestoes([])
  }

  function salvar() {
    if (pendente) return
    iniciar(async () => {
      const r = await atualizarCabecalhoAction(p.ordemId, p.versao, chave.current, p.somenteObservacoes
        ? { observacoes }
        : { clienteId, prometidaPara: prometida || null, responsavelId, observacoes })
      setResposta(r)
      if (r.ok) chave.current = gerarChave()
      else if (r.conflito) router.refresh()
      else chave.current = gerarChave()
    })
  }

  function atalho(e: KeyboardEvent<HTMLFormElement>) {
    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); salvar() }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar() }} onKeyDown={atalho} className="row g-3">
      {!p.somenteObservacoes ? (
        <>
          <div className="col-md-6 position-relative">
            <label className="form-label" htmlFor="cliente">Cliente</label>
            <input id="cliente" className="form-control" autoComplete="off" placeholder="Nome, apelido ou telefone — vazio é venda de balcão"
              value={termo || clienteNome}
              onChange={(e) => { setTermo(e.target.value); if (e.target.value === '') escolher(null) }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setTermo(''); setSugestoes([]) } }} />
            {sugestoes.length > 0 ? (
              <ul className="list-group position-absolute w-100 shadow" role="listbox" style={{ zIndex: 10 }}>
                {sugestoes.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="list-group-item list-group-item-action" onClick={() => escolher(c)}>
                      {c.nome}{c.apelido ? <span className="badge bg-primary-lt ms-2">{c.apelido}</span> : null}
                      <span className="text-secondary ms-2">{c.telefones[0]?.normalizado ? formatarTelefone(c.telefones[0].normalizado) : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {clienteId === null && clienteNome === '' ? <div className="form-hint">Venda de balcão</div> : null}
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="prometida">Entrega prometida</label>
            <input id="prometida" type="date" className="form-control" value={prometida} onChange={(e) => setPrometida(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="responsavel">Responsável</label>
            <select id="responsavel" className="form-select" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              {p.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </>
      ) : null}
      <div className="col-12">
        <label className="form-label" htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" className="form-control" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <div className="col-12 d-flex align-items-center gap-2">
        <button type="submit" className="btn" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar cabeçalho'}</button>
        <span className="small text-secondary">Ctrl+S</span>
        {resposta?.ok ? <span className="text-success small">Salvo.</span> : null}
        {resposta && !resposta.ok && !resposta.conflito ? <span className="text-danger small" role="alert">{resposta.erro}</span> : null}
      </div>
    </form>
  )
}
```

`src/app/(app)/ordens/[id]/form-cancelar.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelarOrdemAction } from './actions'
import { gerarChave } from './chave'

export function FormCancelar({ ordemId, versao }: { ordemId: string; versao: number }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const chave = useRef(gerarChave())

  if (!aberto) return <button type="button" className="btn btn-link text-danger px-0" onClick={() => setAberto(true)}>Cancelar ordem</button>
  return (
    <form className="d-flex flex-column gap-2" onSubmit={(e) => {
      e.preventDefault()
      iniciar(async () => {
        const r = await cancelarOrdemAction(ordemId, versao, chave.current, motivo)
        if (r.ok) router.push('/ordens')
        else if (r.conflito) router.refresh()
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <label className="form-label mb-0" htmlFor="motivoCancelamento">Motivo do cancelamento</label>
      <input id="motivoCancelamento" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={pendente}>Confirmar cancelamento</button>
        <button type="button" className="btn btn-link" onClick={() => setAberto(false)}>Voltar</button>
      </div>
      {erro ? <div className="text-danger small" role="alert">{erro}</div> : null}
    </form>
  )
}
```

- [ ] **Step 6: A página da ordem (Server Component)**

`src/app/(app)/ordens/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconPrinter } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { prisma } from '@/infra/db/prisma'
import { obterOrdemParaTela } from '@/infra/ordens/repositorio'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { permissoes, ROTULO_ESTADO } from '@/domain/ordem/estados'
import { formatarDataCalendario, formatarDataHora, formatarDataLonga } from '@/domain/ordem/datas'
import { descreverCobranca, formatarDimensao } from '@/domain/ordem/impresso'
import type { MaterialCatalogo } from '@/domain/precificacao/resolucao'
import { EntradaLinha } from './entrada-linha'
import { BotaoMutacao } from './botao-mutacao'
import { FormAjuste } from './form-ajuste'
import { FormCabecalho } from './form-cabecalho'
import { FormCancelar } from './form-cancelar'
import { removerItemAction, removerAcrescimoAction, confirmarAjusteAction, removerAjusteAction, aprovarOrcamentoAction } from './actions'

export const metadata: Metadata = { title: 'Ordem de serviço' }

const ROTULO_ACRESCIMO = { instalacao: 'Instalação', deslocamento: 'Deslocamento', frete: 'Frete', imposto: 'Imposto' } as const
const R$ = (v: string) => formatarMoeda(dinheiro(v))

export default async function PaginaOrdem({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const [ordem, materiais, usuarios] = await Promise.all([
    obterOrdemParaTela(usuario.empresaId, id),
    prisma.material.findMany({ where: { empresaId: usuario.empresaId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, unidadeCobranca: true, preco: true } }),
    prisma.usuario.findMany({ where: { empresaId: usuario.empresaId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ])
  if (!ordem) notFound()

  const pode = permissoes(ordem.estadoProducao)
  const catalogo: MaterialCatalogo[] = materiais.map((m) => ({ id: m.id, nome: m.nome, unidadeCobranca: m.unidadeCobranca, preco: m.preco.toFixed() }))
  const numero = String(ordem.numero).padStart(6, '0')
  const acao = <A extends unknown[]>(fn: (ordemId: string, versao: number, ...rest: [...A, string]) => ReturnType<typeof removerItemAction>, ...args: A) =>
    fn.bind(null, ordem.id, ordem.versao, ...args) as (chave: string) => ReturnType<typeof removerItemAction>

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">{ROTULO_ESTADO[ordem.estadoProducao]}{ordem.canceladaEm ? ` · ${ordem.motivoCancelamento}` : ''}</div>
              <h2 className="page-title">{ordem.estadoProducao === 'orcamento' ? 'Orçamento' : 'Ordem de serviço'} nº {numero}</h2>
              <div className="text-secondary">
                {ordem.cliente ? <>{ordem.cliente.nome}{ordem.cliente.apelido ? ` · ${ordem.cliente.apelido}` : ''}{ordem.cliente.telefone ? ` · ${formatarTelefone(ordem.cliente.telefone.replace(/\D/g, ''))}` : ''}</> : 'Venda de balcão'}
                {' · aberta em '}{formatarDataHora(new Date(ordem.abertaEm))}
                {ordem.prometidaPara ? ` · entrega prometida ${formatarDataLonga(new Date(ordem.prometidaPara))}` : ''}
              </div>
            </div>
            <div className="col-auto">
              <Link href={`/ordens/${ordem.id}/impresso`} className="btn"><IconPrinter className="icon" /> Imprimir</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="container-xl">
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="card mb-3">
                <div className="card-body">
                  <FormCabecalho ordemId={ordem.id} versao={ordem.versao} cliente={ordem.cliente} prometidaPara={ordem.prometidaPara}
                    responsavelId={ordem.responsavel.id} usuarios={usuarios} observacoes={ordem.observacoes} somenteObservacoes={!pode.editarCabecalho} />
                </div>
              </div>

              <div className="card">
                {pode.editarItens ? <EntradaLinha ordemId={ordem.id} versao={ordem.versao} catalogo={catalogo} /> : (
                  <div className="card-body text-secondary">{ROTULO_ESTADO[ordem.estadoProducao]}: os itens não podem mais ser alterados.</div>
                )}
                <div className="table-responsive">
                  <table className="table table-vcenter card-table" aria-label="Itens da ordem">
                    <thead><tr><th className="text-end">Qtd</th><th>Descrição</th><th>Medida</th><th className="text-end">Unitário</th><th className="text-end">Total</th><th className="w-1"></th></tr></thead>
                    <tbody>
                      {ordem.itens.length === 0 ? <tr><td colSpan={6} className="text-secondary">Nenhum item ainda. Digite a primeira linha acima.</td></tr> : null}
                      {ordem.itens.map((i) => {
                        const altura = i.altura === null ? null : Number(i.altura)
                        const largura = i.largura === null ? null : Number(i.largura)
                        return (
                          <tr key={i.id}>
                            <td className="numero">{i.quantidade}</td>
                            <td>{i.descricao}<div className="small text-secondary">{descreverCobranca({ quantidade: i.quantidade, descricao: i.descricao, unidade: i.unidadeCobranca, altura, largura, valorUnitario: dinheiro(i.valorUnitario), total: dinheiro(i.total) })}</div></td>
                            <td className="text-secondary">{formatarDimensao(altura, largura)}</td>
                            <td className="numero">{R$(i.valorUnitario)}</td>
                            <td className="numero">{R$(i.total)}</td>
                            <td>{pode.editarItens ? <BotaoMutacao acao={acao(removerItemAction, i.id)} rotulo="Remover" className="btn btn-ghost-danger btn-sm" /> : null}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card">
                <div className="card-body">
                  <dl className="row mb-0">
                    <dt className="col-7">Materiais e serviços</dt><dd className="col-5 numero">{R$(ordem.subtotalItens)}</dd>
                    {ordem.acrescimos.map((a) => (
                      <div className="row g-0 col-12" key={a.id}>
                        <dt className="col-7 fw-normal">{ROTULO_ACRESCIMO[a.tipo]}{a.descricao ? ` · ${a.descricao}` : ''}</dt>
                        <dd className="col-5 numero d-flex justify-content-end gap-2">{R$(a.valor)}{pode.editarItens ? <BotaoMutacao acao={acao(removerAcrescimoAction, a.id)} rotulo="Remover" className="btn btn-ghost-danger btn-sm py-0" /> : null}</dd>
                      </div>
                    ))}
                    <dt className="col-7">Calculado</dt><dd className="col-5 numero">{R$(ordem.precoCalculado)}</dd>
                    <dt className="col-7">Preço final{ordem.ajuste ? <span className="badge bg-primary-lt ms-2">ajustado</span> : null}</dt>
                    <dd className="col-5 numero fs-2 fw-bold" data-testid="preco-final">{R$(ordem.precoFinal)}</dd>
                  </dl>
                  {ordem.ajuste ? (
                    <div className="small text-secondary">
                      {dinheiro(ordem.precoFinal).lt(ordem.precoCalculado) ? 'Desconto' : 'Acréscimo'} de {R$(dinheiro(ordem.precoFinal).minus(ordem.precoCalculado).abs().toFixed(2))} · {ordem.ajuste.motivo}, por {ordem.ajuste.por}
                    </div>
                  ) : null}
                  {ordem.ajuste?.desatualizado ? (
                    <div className="alert alert-warning mt-3" role="alert">
                      O calculado passou de {R$(ordem.ajuste.precoCalculadoNoAjuste)} para {R$(ordem.precoCalculado)}. O preço final continua {R$(ordem.precoFinal)}.
                      <div className="d-flex gap-2 mt-2">
                        <BotaoMutacao acao={acao(confirmarAjusteAction)} rotulo={`Manter ${R$(ordem.precoFinal)}`} className="btn btn-warning btn-sm" />
                        <BotaoMutacao acao={acao(removerAjusteAction)} rotulo="Usar o calculado" className="btn btn-sm" />
                      </div>
                    </div>
                  ) : null}
                  {ordem.aprovadoEm ? <div className="small text-secondary mt-2">Orçamento aprovado em {formatarDataHora(new Date(ordem.aprovadoEm))} por {R$(ordem.precoAprovado ?? '0')}</div> : null}
                </div>
                {pode.editarPreco ? (
                  <div className="card-body border-top">
                    <FormAjuste ordemId={ordem.id} versao={ordem.versao} precoFinal={ordem.precoFinal} motivo={ordem.ajuste?.motivo ?? ''} />
                    {ordem.ajuste && !ordem.ajuste.desatualizado ? <div className="mt-2"><BotaoMutacao acao={acao(removerAjusteAction)} rotulo="Remover ajuste" className="btn btn-link px-0" /></div> : null}
                  </div>
                ) : null}
                <div className="card-body border-top d-flex flex-column gap-2">
                  {pode.aprovarOrcamento ? <BotaoMutacao acao={acao(aprovarOrcamentoAction)} rotulo="Aprovar orçamento" className="btn btn-primary" /> : null}
                  {pode.cancelar ? <FormCancelar ordemId={ordem.id} versao={ordem.versao} /> : null}
                  {ordem.prometidaPara ? <div className="small text-secondary">Entrega prometida para {formatarDataCalendario(new Date(ordem.prometidaPara))}</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 7: Typecheck, testes, build e fumaça**

Run: `npm run typecheck` → sem erros (atenção ao helper `acao`: se o TypeScript 7 reclamar do `bind` genérico, trocar por chamadas explícitas `removerItemAction.bind(null, ordem.id, ordem.versao, i.id)` em cada uso — o `.bind` de Server Action é serializável). Run: `npm test` → PASS (`use-client` continua verde: nenhum arquivo novo importa react-bootstrap).
Run: `npm run build` → rotas `ƒ /ordens`, `ƒ /ordens/[id]`, `ƒ /ordens/nova`.
Fumaça: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/ordens` → `307 …/entrar?proximo=%2Fordens`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/navegacao.ts" "src/app/(app)/layout.tsx" "src/app/(app)/ordens/"
git commit -m "feat: tela da ordem de servico com entrada assistida, acrescimos, ajuste, aprovacao e cancelamento"
```

---
### Task 5: O impresso

**Files:**
- Create: `src/infra/ordens/impresso.ts`, `src/app/(impresso)/layout.tsx`, `src/app/(impresso)/impresso.css`, `src/app/(impresso)/ordens/[id]/impresso/page.tsx`, `src/app/(impresso)/ordens/[id]/impresso/botao-imprimir.tsx`

**Interfaces:**
- Produces: `obterImpresso(empresaId, ordemId): { empresa: DadosEmpresaImpresso; ordem: OrdemImpressa } | null`; rota `/ordens/[id]/impresso` (uma via; `?vias=2` = via do cliente + via da loja)

- [ ] **Step 1: Leitura para o impresso**

`src/infra/ordens/impresso.ts` — nada é recalculado: lê `preco_calculado`/`preco_final` persistidos.
```ts
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

export async function obterImpresso(empresaId: string, ordemId: string): Promise<ImpressoCompleto | null> {
  const o = await prisma.ordemServico.findFirst({
    where: { id: ordemId, empresaId },
    include: {
      empresa: { select: { razaoSocial: true } },
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
    empresa: { nomeFantasia: 'DruSign', razaoSocial: o.empresa.razaoSocial },
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
```

- [ ] **Step 2: Route group `(impresso)` sem sidebar, CSS A4 e a página**

`src/app/(impresso)/layout.tsx`:
```tsx
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import './impresso.css'

/** Sem sidebar: a tela ja e a folha. */
export default async function LayoutImpresso({ children }: { children: React.ReactNode }) {
  await exigirUsuario()
  return <div className="impresso-raiz">{children}</div>
}
```

`src/app/(impresso)/impresso.css`:
```css
@page { size: A4 portrait; margin: 12mm 12mm 14mm; }

.impresso-raiz {
  --papel: 210mm; --tinta: #111; --fraca: #555; --linha: #999; --faixa: #f0f0f0;
  font-family: var(--font-geist-sans), 'Segoe UI', Arial, sans-serif;
  font-variant-numeric: tabular-nums; color: var(--tinta); background: #e9ecef; min-height: 100vh; padding: 16px 0 48px;
}
.impresso-acoes { max-width: var(--papel); margin: 0 auto 12px; display: flex; gap: 8px; align-items: center; }
.via { box-sizing: border-box; width: var(--papel); min-height: 297mm; margin: 0 auto 16px; padding: 12mm 12mm 14mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); font-size: 11pt; line-height: 1.35; display: flex; flex-direction: column; }
.bloco { margin-bottom: 5mm; break-inside: avoid; }
.bloco + .bloco { border-top: 1px solid var(--linha); padding-top: 3mm; }
.cabecalho-empresa { display: grid; grid-template-columns: 1fr auto; gap: 4mm; align-items: center; }
.cabecalho-empresa .nome { font-size: 18pt; font-weight: 700; letter-spacing: -0.01em; }
.cabecalho-empresa .razao, .cabecalho-empresa .contato { font-size: 9.5pt; color: var(--fraca); }
.cabecalho-empresa .contato { text-align: right; white-space: nowrap; }
.identificacao { display: flex; justify-content: space-between; align-items: baseline; }
.identificacao .titulo { font-size: 14pt; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
.identificacao .numero-os { font-size: 20pt; font-weight: 700; }
.identificacao .datas { text-align: right; font-size: 10pt; }
.identificacao .datas dt { display: inline; color: var(--fraca); }
.identificacao .datas dd { display: inline; margin: 0 0 0 4px; font-weight: 600; }
.via-rotulo { font-size: 8.5pt; color: var(--fraca); text-transform: uppercase; letter-spacing: .06em; }
.cliente dl { display: grid; grid-template-columns: auto 1fr; gap: 1mm 4mm; margin: 0; }
.cliente dt { color: var(--fraca); font-weight: 400; }
.cliente dd { margin: 0; font-weight: 500; }
.itens { width: 100%; border-collapse: collapse; }
.itens th, .itens td { padding: 1.6mm 2mm; vertical-align: top; }
.itens thead th { border-bottom: 1px solid var(--tinta); font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; text-align: left; }
.itens tbody tr { break-inside: avoid; }
.itens tbody td { border-bottom: 1px solid #ddd; }
.itens .cobranca { display: block; font-size: 9pt; color: var(--fraca); }
.itens .numero, .valores .numero { text-align: right; white-space: nowrap; }
.observacoes { white-space: pre-line; font-size: 10pt; margin-top: 2mm; }
.rodape { display: grid; grid-template-columns: 1fr 78mm; gap: 6mm; margin-top: auto; }
.valores { border-collapse: collapse; width: 100%; }
.valores td { padding: 1.2mm 2mm; }
.valores .motivo { font-size: 9pt; color: var(--fraca); }
.valores .total td { font-size: 13pt; font-weight: 700; border-top: 2px solid var(--tinta); background: var(--faixa); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.assinatura { display: flex; flex-direction: column; justify-content: flex-end; font-size: 10pt; }
.assinatura .linha { border-top: 1px solid var(--tinta); margin-top: 14mm; padding-top: 1mm; }
.garantia { font-size: 9.5pt; font-weight: 600; margin-top: 3mm; }
.agradecimento { font-size: 9pt; color: var(--fraca); text-align: center; margin-top: 3mm; }

@media print {
  .impresso-raiz { background: #fff; padding: 0; min-height: auto; }
  .impresso-acoes { display: none !important; }
  .via { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; break-after: page; }
  .via:last-child { break-after: auto; }
  .itens thead { display: table-header-group; }
  a { color: inherit; text-decoration: none; }
}
```

`src/app/(impresso)/ordens/[id]/impresso/botao-imprimir.tsx`:
```tsx
'use client'

import { IconPrinter } from '@tabler/icons-react'

export function BotaoImprimir() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()} autoFocus>
      <IconPrinter className="icon" /> Imprimir
    </button>
  )
}
```

`src/app/(impresso)/ordens/[id]/impresso/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterImpresso } from '@/infra/ordens/impresso'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'
import { TEXTOS_IMPRESSO, descreverCobranca, formatarDimensao, tituloDocumento, type DadosEmpresaImpresso, type OrdemImpressa } from '@/domain/ordem/impresso'
import { BotaoImprimir } from './botao-imprimir'

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ vias?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const usuario = await exigirUsuario()
  const { id } = await params
  const dados = await obterImpresso(usuario.empresaId, id)
  return { title: dados ? `OS ${String(dados.ordem.numero).padStart(6, '0')}` : 'Impresso' }
}

export default async function PaginaImpresso({ params, searchParams }: Props) {
  const usuario = await exigirUsuario()
  const [{ id }, { vias }] = await Promise.all([params, searchParams])
  const dados = await obterImpresso(usuario.empresaId, id)
  if (!dados) notFound()
  const rotulos = vias === '2' ? ['Via do cliente', 'Via da loja'] : ['Via do cliente']
  return (
    <>
      <div className="impresso-acoes">
        <Link href={`/ordens/${id}`} className="btn">Voltar à ordem</Link>
        <BotaoImprimir />
        <Link href={`/ordens/${id}/impresso?vias=2`} className="btn btn-ghost-secondary">2 vias</Link>
      </div>
      {rotulos.map((rotulo) => <Via key={rotulo} rotulo={rotulo} empresa={dados.empresa} ordem={dados.ordem} />)}
    </>
  )
}

function Via({ rotulo, empresa, ordem }: { rotulo: string; empresa: DadosEmpresaImpresso; ordem: OrdemImpressa }) {
  const numero = String(ordem.numero).padStart(6, '0')
  const eOrcamento = ordem.estadoProducao === 'orcamento'
  const temAjuste = !ordem.ajuste.isZero()
  return (
    <article className="via" aria-label={`${tituloDocumento(ordem.estadoProducao)} ${numero} — ${rotulo}`}>
      <header className="bloco cabecalho-empresa">
        <div><div className="nome">{empresa.nomeFantasia}</div><div className="razao">{empresa.razaoSocial}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ''}</div></div>
        <div className="contato">{empresa.endereco ? <div>{empresa.endereco}</div> : null}{empresa.cidadeUf ? <div>{empresa.cidadeUf}</div> : null}{(empresa.telefones ?? []).map((t) => <div key={t}>{t}</div>)}</div>
      </header>
      <section className="bloco identificacao">
        <div><div className="via-rotulo">{rotulo}</div><div className="titulo">{tituloDocumento(ordem.estadoProducao)}</div><div className="numero-os">Nº {numero}</div></div>
        <dl className="datas">
          <div><dt>Aberta em</dt><dd>{formatarDataHora(ordem.abertaEm)}</dd></div>
          <div><dt>Entrega prometida</dt><dd>{ordem.prometidaPara ? formatarDataCalendario(ordem.prometidaPara) : 'a combinar'}</dd></div>
          <div><dt>Responsável</dt><dd>{ordem.responsavel}</dd></div>
        </dl>
      </section>
      <section className="bloco cliente">
        <dl>
          <dt>Cliente</dt><dd>{ordem.cliente ? ordem.cliente.nome : 'Venda de balcão'}{ordem.cliente?.apelido ? ` (${ordem.cliente.apelido})` : ''}</dd>
          {ordem.cliente?.telefone ? <><dt>Telefone</dt><dd>{ordem.cliente.telefone}</dd></> : null}
          {ordem.cliente?.documento ? <><dt>CPF/CNPJ</dt><dd>{formatarDocumento(ordem.cliente.documento)}</dd></> : null}
        </dl>
      </section>
      <section className="bloco">
        <table className="itens">
          <thead><tr><th className="numero">Qtd</th><th>Descrição</th><th>Medida</th><th className="numero">Unitário</th><th className="numero">Total</th></tr></thead>
          <tbody>
            {ordem.itens.map((item, i) => (
              <tr key={i}>
                <td className="numero">{item.quantidade}</td>
                <td>{item.descricao}<span className="cobranca">{descreverCobranca(item)}</span></td>
                <td>{formatarDimensao(item.altura, item.largura)}</td>
                <td className="numero">{formatarMoeda(item.valorUnitario)}</td>
                <td className="numero">{formatarMoeda(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordem.observacoes ? <p className="observacoes">{ordem.observacoes}</p> : null}
      </section>
      <section className="bloco rodape">
        <div className="assinatura">
          <p className="garantia">{eOrcamento ? TEXTOS_IMPRESSO.orcamentoValidade : TEXTOS_IMPRESSO.garantia}</p>
          <div className="linha">Visto do cliente</div>
        </div>
        <table className="valores"><tbody>
          <tr><td>Materiais e serviços</td><td className="numero">{formatarMoeda(ordem.subtotalItens)}</td></tr>
          {ordem.acrescimos.map((a, i) => <tr key={i}><td>{a.descricao}</td><td className="numero">{formatarMoeda(a.valor)}</td></tr>)}
          {temAjuste ? (
            <>
              <tr><td>Calculado</td><td className="numero">{formatarMoeda(ordem.precoCalculado)}</td></tr>
              <tr><td>{ordem.ajuste.isNegative() ? 'Desconto' : 'Acréscimo'}{ordem.motivoAjuste ? <span className="motivo"> · {ordem.motivoAjuste}</span> : null}</td><td className="numero">{formatarMoeda(ordem.ajuste.abs())}</td></tr>
            </>
          ) : null}
          <tr className="total"><td>Total</td><td className="numero">{formatarMoeda(ordem.precoFinal)}</td></tr>
        </tbody></table>
      </section>
      <p className="agradecimento">*** {TEXTOS_IMPRESSO.agradecimento} ***</p>
    </article>
  )
}
```

- [ ] **Step 3: Verificação e commit**

Run: `npm run typecheck` → sem erros. Run: `npm run build` → rota `ƒ /ordens/[id]/impresso`.

```bash
git add src/infra/ordens/impresso.ts "src/app/(impresso)/"
git commit -m "feat: impresso da ordem em A4 com uma ou duas vias"
```

---

### Task 6: Ponta a ponta — a OS 18449 pela interface, e o impresso

**Files:**
- Create: `e2e/ordens.spec.ts`, `e2e/impresso.spec.ts`

- [ ] **Step 1: O teste da tela**

`e2e/ordens.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test'
import { entrar } from './apoio'

/** As seis linhas da OS 18449 exatamente como a Odete digitava no legado. */
const LINHAS_18449 = [
  '06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00',
  '01 PLACA ACM 50 X 50 E ADES/ IMP  62,00',
  '03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00',
  '12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00',
  '06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00',
  '03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00',
]

async function novaOrdem(page: Page, estado: 'Ordem de serviço' | 'Orçamento' = 'Ordem de serviço'): Promise<string> {
  await page.goto('/ordens/nova')
  await page.getByRole('button', { name: estado, exact: true }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  return page.url()
}

async function lancar(page: Page, linha: string) {
  const campo = page.getByLabel('Lançar item ou acréscimo')
  await campo.fill(linha)
  await campo.press('Enter')
  await expect(campo).toHaveValue('', { timeout: 30_000 })
}

test.describe('Ordem de serviço', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('reproduz a OS 18449 digitando as seis linhas do legado: R$ 2.528,00', async ({ page }) => {
    await novaOrdem(page)
    await expect(page.getByRole('heading', { name: /Ordem de serviço nº 0184\d\d/ })).toBeVisible({ timeout: 60_000 })

    const campo = page.getByLabel('Lançar item ou acréscimo')
    await campo.fill(LINHAS_18449[3]!)
    await expect(page.getByText('Entendi: qtd 12 · PLACAS ACM E ADES/ IMP · 0,61 × 0,40 m · R$ 61,00/un')).toBeVisible()
    await expect(page.getByText('→ R$ 732,00')).toBeVisible()
    await campo.fill('')

    for (const linha of LINHAS_18449) await lancar(page, linha)

    const tabela = page.getByRole('table', { name: 'Itens da ordem' })
    await expect(tabela.locator('tbody tr')).toHaveCount(6)
    await expect(tabela.locator('tbody tr').nth(3)).toContainText('por unidade')
    await expect(tabela.locator('tbody tr').nth(3)).toContainText('0,61 × 0,40 m')
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.528,00')
  })

  test('acrescimo com +, ajuste de preco com motivo, aviso de divergencia e remocao de item', async ({ page }) => {
    await novaOrdem(page)
    await lancar(page, '2 placa 1000,00')
    await lancar(page, '+deslocamento 34 km 102,00')
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.102,00')
    await expect(page.getByText('Deslocamento · 34 km')).toBeVisible()

    await page.getByLabel('Preço final').fill('2050,00')
    await page.getByLabel('Motivo do ajuste').fill('arredondamento comercial')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,00', { timeout: 30_000 })
    await expect(page.getByText('Desconto de R$ 52,00 · arredondamento comercial')).toBeVisible()

    await lancar(page, '1 placa 100,00')
    await expect(page.getByRole('alert').filter({ hasText: 'O calculado passou de R$ 2.102,00 para R$ 2.202,00' })).toBeVisible()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,00')
    await page.getByRole('button', { name: 'Usar o calculado' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.202,00', { timeout: 30_000 })

    const linhas = page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')
    await linhas.nth(1).getByRole('button', { name: 'Remover' }).click()
    await expect(linhas).toHaveCount(1, { timeout: 30_000 })
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.102,00')
  })

  test('pendencia nao grava; Esc limpa; segundo Enter nao conflita', async ({ page }) => {
    await novaOrdem(page)
    const campo = page.getByLabel('Lançar item ou acréscimo')
    await campo.fill('3 banner 200x100')
    await campo.press('Enter')
    await expect(page.getByRole('alert').filter({ hasText: 'Falta o valor unitário' })).toBeVisible()
    await expect(campo).toHaveValue('3 banner 200x100')
    await campo.press('Escape')
    await expect(campo).toHaveValue('')

    await lancar(page, '1 placa 62,00')
    await lancar(page, '3 placas 75,00')
    await expect(page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')).toHaveCount(2)
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 287,00')
  })

  test('orcamento: aprovar vira ordem aberta; cancelar com motivo preserva os itens', async ({ page }) => {
    await novaOrdem(page, 'Orçamento')
    await expect(page.getByRole('heading', { name: /Orçamento nº/ })).toBeVisible({ timeout: 60_000 })
    await lancar(page, '1 placa 90,00')
    await page.getByRole('button', { name: 'Aprovar orçamento' }).click()
    await expect(page.getByRole('heading', { name: /Ordem de serviço nº/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Orçamento aprovado em/)).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar ordem' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('cliente desistiu')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page).toHaveURL(/\/ordens$/, { timeout: 30_000 })
    await page.goBack()
    await expect(page.getByText('Cancelada · cliente desistiu')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')).toHaveCount(1)
    await expect(page.getByLabel('Lançar item ou acréscimo')).toHaveCount(0)
  })

  test('cabecalho: escolhe o cliente pela busca e a ordem passa a mostrar o apelido', async ({ page }) => {
    await novaOrdem(page)
    await page.getByLabel('Cliente').fill('factu')
    await page.getByRole('option').filter({ hasText: 'ASSOCIAÇÃO DE ENSINO' }).getByRole('button').click()
    await page.getByLabel('Entrega prometida').fill('2026-09-04')
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ · FACTU/)).toBeVisible()
    await expect(page.getByText('entrega prometida 4 de setembro')).toBeVisible()
  })
})
```

- [ ] **Step 2: O teste do impresso**

`e2e/impresso.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { entrar } from './apoio'

test.describe('Impresso da ordem', () => {
  test('mostra numero, itens e total; some a barra em print; gera PDF A4', async ({ page, browserName, headless }) => {
    await entrar(page)
    await page.goto('/ordens/nova')
    await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
    const campo = page.getByLabel('Lançar item ou acréscimo')
    for (const linha of ['12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00', '+instalacao 280']) {
      await campo.fill(linha); await campo.press('Enter'); await expect(campo).toHaveValue('', { timeout: 30_000 })
    }
    const numero = (await page.getByRole('heading', { name: /nº (\d{6})/ }).textContent())?.match(/(\d{6})/)?.[1]

    await page.getByRole('link', { name: 'Imprimir' }).click()
    await expect(page).toHaveURL(/\/impresso$/, { timeout: 60_000 })
    const via = page.getByRole('article', { name: /Via do cliente/ })
    await expect(via).toBeVisible()
    await expect(via).toContainText(`Nº ${numero}`)
    await expect(via).toContainText('Venda de balcão')
    await expect(via.locator('.itens tbody tr')).toHaveCount(1)
    await expect(via.locator('.itens tbody tr').first()).toContainText('por unidade')
    await expect(via.locator('.itens tbody tr').first()).toContainText('0,61 × 0,40 m')
    await expect(via).toContainText('Instalação')
    await expect(via.locator('.valores .total')).toContainText('R$ 1.012,00')
    await expect(via.getByText('Sempre guarde esse comprovante como sua garantia de entrega!')).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
    await page.emulateMedia({ media: null })

    await page.goto(`${page.url()}?vias=2`)
    await expect(page.getByRole('article', { name: /Via da loja/ })).toBeVisible()

    test.skip(browserName !== 'chromium' || !headless, 'page.pdf exige Chromium headless')
    await page.evaluate(() => document.fonts.ready)
    await mkdir('test-results', { recursive: true })
    const pdf = await page.pdf({ path: `test-results/impresso-os-${numero}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(10_000)
  })
})
```

- [ ] **Step 3: Rodar**

Antes: `npm run typecheck` (o `next typegen` precisa conhecer as rotas novas), `npm run db:local:ls` com `drusign` de pé, seed com o contador aplicado, clientes importados.

Run: `npm run e2e`
Expected: `16 passed` (10 anteriores + 5 de ordens + 1 do impresso). Se o segundo Enter cair em conflito, a ressalva documentada é real: trocar o `revalidatePath` por `router.refresh()` depois do `await` na `EntradaLinha` e anotar no plano.

- [ ] **Step 4: Verificação final e commit**

Run: `npm run check` → typecheck, unitários e integração verdes. Run: `npm run build` → verde.

```bash
git add e2e/
git commit -m "test: ordem de servico e impresso ponta a ponta com a OS 18449"
```

---

## Critério de conclusão da Fase 3

Verificação da spec (seção 13): *"reproduzir a OS 18449 do legado — seis itens de ACM somando R$ 2.528,00."*

- [ ] `repositorio.int.test.ts` de ordens verde: a OS 18461 recebe as seis linhas do legado como estão e fecha em 2.528,00; idempotência, trava, ajuste, soft delete, aprovação e cancelamento provados no banco
- [ ] `resolucao.test.ts` verde: as seis linhas, com o sufixo `CD`, resolvem por unidade e conferem
- [ ] `npm run check` e `npm run build` verdes
- [ ] `npm run e2e` verde: a OS 18449 digitada pela interface dá R$ 2.528,00; acréscimo, ajuste, aviso de divergência, remoção, pendência, Esc, dois Enters seguidos, orçamento→aprovação→cancelamento, cliente por busca, impresso com PDF em `test-results/`

Feito isso, a Fase 4 (recebimento, livro-caixa, plano de contas, a transação única e a fila de trabalho — o marco em que o legado pode ser desligado) ganha seu próprio plano.

## Backlog de refinamento (depois que a Odete usar)

Edição inline de item, reordenação, desfazer remoção, cadastro de cliente sem sair da ordem, parser de data (`4/9`, `+7`), acréscimo em percentual, `LogAuditoria`, atalhos Alt+letra (colisão com menus do navegador não confirmada), stopwords do casamento de material calibradas com o catálogo real, impressora do balcão confirmada.
