# Fase 5 — Produção e administração: fila de produção, indicadores, carteira de clientes, usuários e dados da empresa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As duas pontas que faltam para o sistema sair do balcão: o funcionário da produção abre uma tela lida de longe, vê o que está atrasado e marca "Serviço finalizado" sem tocar em dinheiro; e a administração passa a ter os números que a spec definiu como termômetro (ordens não finalizadas, valor parado, prazo de entrega), a carteira de clientes por documento, o cadastro de usuários e os dados da empresa que saem no impresso.

**Architecture:** Tudo que classifica, agrupa ou mede é função pura sobre uma lista serializável (`classificarUrgencia`, `resumirOperacao`, `porAno`, `agruparPorDocumento`) — o mesmo padrão de `classificarFila` da Fase 4: a infra faz uma query, converte para string decimal e ISO, e entrega pronto. Nenhum indicador é gravado. A tela inicial passa a decidir por papel: `administracao` vê a fila de trabalho (atendimento), `operacao` vê a fila de produção. Os dados da empresa deixam de ser literal no código e passam a vir do banco, alimentando o cabeçalho do impresso que a Fase 3 já deixou reservado.

**Tech Stack:** o mesmo da Fase 4. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 3 — dois papéis —, 4 — Empresa e Usuario —, 7 — telas 8, 9, 12, 14 e 15 —, 11 — critérios de sucesso — e 13)

## Global Constraints

- Dinheiro em `Decimal` no domínio, `numeric(12,4)` no banco, **string decimal** na fronteira cliente→action; nunca `Number(prismaDecimal)`; conversão só por `paraDominio`/`paraBanco`.
- Nada em `src/domain/` importa framework, banco ou infra (trava de pureza `src/domain/pureza.test.ts`).
- **Nada de `DELETE`** em dado de negócio: usuário desativa (`ativo = false`), nunca some — ele é `responsavel_id` de ordens antigas.
- Toda tabela carrega `empresa_id`; toda leitura e escrita filtra por `empresa_id` do usuário logado.
- **Nenhum indicador é coluna.** Tudo derivado na leitura, como o eixo de pagamento da Fase 4. O legado tinha `SALDO` gravado no CAIXA e ele está em −1.946,45.
- Produção não vê dinheiro: a fila de produção não mostra preço, saldo nem forma de pagamento, e a única ação é "Serviço finalizado".
- **Nenhum campo com valor pré-selecionado que ninguém troca** (spec, seção 7): o `<select>` de papel do usuário novo começa em "Escolha o papel".
- Vocabulário da loja: *Serviço finalizado*, *Situação*, *Responsável*, *Observações*. Nada de "dashboard", "KPI", "churn".
- TypeScript 7 (sem `baseUrl`; `it.each` declara todos os elementos); Postgres local sem shadow: migrar com `npm run db:migrar -- <nome>`; comandos de shell curtos; arquivo com barra dupla nunca sai de heredoc; `rtk` intercepta `ls`, `grep` e `npx prisma` — use `find`, o Grep tool e `node node_modules/prisma/build/index.js`. Para rodar o Vitest sem o rtk engolir a saída: `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=<arquivo>`.
- O `prisma dev` local aceita poucas conexões simultâneas: `DATABASE_POOL_MAX=2` no `.env.local`; o `playwright.config.ts` já desliga o `next dev` com `gracefulShutdown` para não sangrar o teto a cada rodada.

## O que este plano decide (29/08/2026)

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde a produção entra | `/` decide por papel: `administracao` → fila de trabalho (tela 1), `operacao` → fila de produção (tela 8). `/producao` existe como rota própria, visível para os dois | spec, seção 3: produção "vê a fila e marca serviço finalizado"; obrigar o funcionário a navegar até a tela dele é a primeira coisa que ele deixa de fazer |
| Ordem de urgência | `classificarUrgencia`: **atrasadas** (prometida < hoje), **para hoje**, **esta semana** (até 7 dias), **sem data combinada** — nessa ordem, e dentro de cada grupo a prometida mais próxima primeiro; sem data cai no fim, ordenada pela mais antiga aberta | "em ordem de urgência" (spec, tela 8). Data prometida é o único compromisso que existe com o cliente; ordem sem data não é urgente, é esquecida — por isso aparece, mas por último |
| O que a fila de produção mostra | número, cliente, o que produzir (descrição dos itens), data prometida e há quantos dias está aberta. **Nenhum valor** | spec, seção 3: produção não mexe em dinheiro; mostrar preço numa tela lida de longe é vazar o preço para quem estiver na loja |
| Densidade da produção | uma linha por ordem em `card` próprio, tipo grande (`fs-2` no número, `fs-3` no cliente), botão de 44px mínimo, sem tabela | spec, tela 8: "densidade baixa, tipo grande, alvos de toque de no mínimo 44px" |
| Indicadores da tela de operação | exatamente os critérios de sucesso da spec (seção 11): % de ordens não finalizadas, valor parado em ordens não cobradas, prazo mediano de entrega (e o p90), % de ordens com item estruturado, e quantas pessoas usaram o sistema no período | a spec já escolheu o termômetro; inventar outro indicador é trocar a régua depois da prova |
| Histórico ano a ano | uma linha por ano: ordens abertas, concluídas, faturado, recebido, ticket médio. Enquanto a Fase 6 não importar as 18.443 legadas, só existe 2026 — e a tela diz isso | spec, tela 9: "indicadores do momento e histórico ano a ano" |
| Carteira de clientes | agrupada por **documento** quando houver (CPF/CNPJ), senão o cliente é seu próprio grupo | a Prefeitura de Unaí são 18 cadastros sob o mesmo CNPJ (738 ordens, R$ 304.083, 5,4% do faturamento) porque cada secretaria tem empenho separado; agrupar é o que revela o maior cliente da empresa, que o legado esconde |
| Recência | **ativo** ≤ 6 meses da última ordem, **adormecido** de 6 a 24 meses (é a lista de reativação), **perdido** > 24 meses | medido no `ORDEM.DBF`: dos 3.153 clientes com ordem, 131 compraram nos últimos 6 meses, 66 entre 6 e 12, 188 entre 1 e 2 anos, 2.768 há mais de dois. A faixa de 6 a 24 meses dá **254 nomes** — uma lista que cabe num dia de telefonemas; "mais de dois anos" é cauda morta, não campanha |
| Usuários | criar, editar nome/papel, desativar e reativar, trocar a própria senha e a dos outros. **Nunca apagar** | o usuário é `responsavel_id` de ordens antigas; o legado tem 10 cadastrados e 7 marcados como apagados |
| Senha | quem cria define a senha inicial e o usuário troca depois; sem e-mail, sem token de recuperação | a loja não tem e-mail corporativo confiável (o SMTP do legado ainda é o e-mail pessoal do autor do software) e são 3 pessoas na mesma sala |
| Dados da empresa | nome fantasia, razão social, CNPJ, endereço, bairro, cidade, UF, CEP e até dois telefones — todos opcionais menos a razão social | é o que o cabeçalho do impresso reserva desde a Fase 3 (`DadosEmpresaImpresso`), hoje preenchido com `'DruSign'` literal no código |
| Logo | **fora desta fase**: entra na Fase 6, junto com o R2 do anexo de arte | é o único item da tela 15 que precisa de armazenamento de arquivo; puxar o R2 para cá só para o logo trava a fase inteira se a credencial faltar |
| Escopo | `/producao`, `/operacao`, `/clientes/carteira`, `/usuarios`, `/empresa`, e o impresso passando a ler a empresa do banco | relatório do contador, importação do histórico e anexo de arte são Fase 6 |

**Fatos do legado usados aqui:** `ORDEM.DBF` = 18.443 ordens vivas, a mais antiga de 07/05/2012 e a mais recente de 27/08/2026; 3.153 clientes distintos com ordem; a distribuição de recência acima. Da spec (seções 1 e 11): 29,4% das ordens de 2025 nunca foram finalizadas, R$ 207.795 parados em 513 ordens abertas, prazo mediano de 13 dias com p90 de 78, 0% de ordens com item estruturado, uma pessoa faz 84,6% das ordens.

---

### Task 1: Domínio — urgência da produção, indicadores de operação e carteira de clientes

**Files:**
- Create: `src/domain/producao/urgencia.ts`, `src/domain/operacao/indicadores.ts`, `src/domain/clientes/carteira.ts`
- Test: `src/domain/producao/urgencia.test.ts`, `src/domain/operacao/indicadores.test.ts`, `src/domain/clientes/carteira.test.ts`

**Interfaces:**
- Consumes: `dinheiro`, `arredondarCentavos`, `Decimal` (`src/domain/precificacao/dinheiro.ts`); `EstadoProducao`; `resumirPagamento` (`src/domain/caixa/pagamento.ts`); `hojeCalendario` (`src/domain/ordem/datas.ts`).
- Produces:
  - `type GrupoUrgencia = 'atrasada' | 'hoje' | 'semana' | 'sem_data'`, `ROTULO_URGENCIA`, `interface OrdemDaProducao`, `classificarUrgencia(ordens: OrdemDaProducao[], agora: Date): FilaProducao`
  - `interface Indicadores`, `interface AnoOperacao`, `resumirOperacao(ordens: OrdemMedida[]): Indicadores`, `porAno(ordens: OrdemMedida[]): AnoOperacao[]`
  - `type Recencia = 'ativo' | 'adormecido' | 'perdido'`, `ROTULO_RECENCIA`, `interface LinhaCarteira`, `agruparPorDocumento(linhas: LinhaCarteira[], agora: Date): Carteira`

- [x] **Step 1: Urgência da fila de produção (teste)**

`src/domain/producao/urgencia.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classificarUrgencia, ROTULO_URGENCIA, type OrdemDaProducao } from './urgencia'

const agora = new Date('2026-08-29T15:00:00.000Z') // 12:00 em Sao Paulo
const dia = (s: string) => `${s}T00:00:00.000Z`

function ordem(p: Partial<OrdemDaProducao> & { numero: number }): OrdemDaProducao {
  return {
    id: `id-${p.numero}`, clienteNome: null, clienteApelido: null,
    abertaEm: '2026-08-20T12:00:00.000Z', prometidaPara: null, versao: 1, itens: ['PLACA ACM'], ...p,
  }
}

describe('classificarUrgencia', () => {
  it('separa atrasada, hoje, esta semana e sem data, nessa ordem', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-09-10') }),
      ordem({ numero: 2, prometidaPara: dia('2026-08-28') }),
      ordem({ numero: 3, prometidaPara: dia('2026-08-29') }),
      ordem({ numero: 4, prometidaPara: null, abertaEm: '2026-08-10T12:00:00.000Z' }), // aberta antes da 1
      ordem({ numero: 5, prometidaPara: dia('2026-09-02') }),
    ], agora)
    expect(f.grupos.map((g) => [g.grupo, g.ordens.map((o) => o.numero)])).toEqual([
      ['atrasada', [2]],
      ['hoje', [3]],
      ['semana', [5]],
      ['sem_data', [4, 1]],
    ])
  })

  it('dentro de atrasada, a mais atrasada primeiro; dentro de semana, a mais proxima primeiro', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-08-27') }),
      ordem({ numero: 2, prometidaPara: dia('2026-07-01') }),
      ordem({ numero: 3, prometidaPara: dia('2026-09-04') }),
      ordem({ numero: 4, prometidaPara: dia('2026-08-31') }),
    ], agora)
    expect(f.grupos[0]).toMatchObject({ grupo: 'atrasada' })
    expect(f.grupos[0]?.ordens.map((o) => o.numero)).toEqual([2, 1])
    expect(f.grupos.find((g) => g.grupo === 'semana')?.ordens.map((o) => o.numero)).toEqual([4, 3])
  })

  it('sem data combinada vem por ultimo, a aberta ha mais tempo primeiro; prometida longe cai aqui', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, abertaEm: '2026-08-25T12:00:00.000Z' }),
      ordem({ numero: 2, abertaEm: '2026-06-01T12:00:00.000Z' }),
      ordem({ numero: 3, prometidaPara: dia('2026-12-25'), abertaEm: '2026-08-01T12:00:00.000Z' }),
    ], agora)
    const semData = f.grupos.find((g) => g.grupo === 'sem_data')
    expect(semData?.ordens.map((o) => o.numero)).toEqual([2, 3, 1])
  })

  it('grupo vazio nao aparece, e a fila vazia nao tem grupo nenhum', () => {
    expect(classificarUrgencia([ordem({ numero: 1, prometidaPara: dia('2026-08-28') })], agora).grupos.map((g) => g.grupo)).toEqual(['atrasada'])
    expect(classificarUrgencia([], agora)).toEqual({ grupos: [], total: 0, atrasadas: 0 })
  })

  it('conta o total e quantas estao atrasadas', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-08-01') }),
      ordem({ numero: 2, prometidaPara: dia('2026-08-28') }),
      ordem({ numero: 3, prometidaPara: dia('2026-08-29') }),
    ], agora)
    expect(f).toMatchObject({ total: 3, atrasadas: 2 })
  })

  it('cada grupo tem rotulo no vocabulario da loja', () => {
    expect(ROTULO_URGENCIA).toEqual({ atrasada: 'Atrasadas', hoje: 'Para hoje', semana: 'Esta semana', sem_data: 'Sem data combinada' })
  })

  it('a virada do dia segue Sao Paulo, nao UTC', () => {
    // 02:30 UTC do dia 30 ainda e 23:30 do dia 29 em Sao Paulo: prometida para 29 nao esta atrasada.
    const f = classificarUrgencia([ordem({ numero: 1, prometidaPara: dia('2026-08-29') })], new Date('2026-08-30T02:30:00.000Z'))
    expect(f.grupos[0]?.grupo).toBe('hoje')
  })
})
```

Run: `npm test -- src/domain/producao` → vermelho (`Cannot find module './urgencia'`).

- [x] **Step 2: Urgência (implementação)**

`src/domain/producao/urgencia.ts`:
```ts
import { hojeCalendario } from '../ordem/datas'

export type GrupoUrgencia = 'atrasada' | 'hoje' | 'semana' | 'sem_data'

export const ROTULO_URGENCIA: Record<GrupoUrgencia, string> = {
  atrasada: 'Atrasadas',
  hoje: 'Para hoje',
  semana: 'Esta semana',
  sem_data: 'Sem data combinada',
}

/** Serializavel, e sem dinheiro: a producao nao ve preco (spec, secao 3). */
export interface OrdemDaProducao {
  id: string
  numero: number
  clienteNome: string | null
  clienteApelido: string | null
  abertaEm: string
  /** ISO da @db.Date; null quando nao foi combinada. */
  prometidaPara: string | null
  /** Para o botao "Servico finalizado" ir com a trava otimista. */
  versao: number
  /** Descricao dos itens, na ordem de exibicao: e o que a producao precisa ler. */
  itens: string[]
}

export interface GrupoDaFila {
  grupo: GrupoUrgencia
  ordens: OrdemDaProducao[]
}

export interface FilaProducao {
  /** So os grupos com ordem, na ordem de urgencia. */
  grupos: GrupoDaFila[]
  total: number
  atrasadas: number
}

const ORDEM_DOS_GRUPOS: GrupoUrgencia[] = ['atrasada', 'hoje', 'semana', 'sem_data']

/** 'AAAA-MM-DD' da coluna @db.Date, que o Prisma entrega a meia-noite UTC. */
function diaPrometido(iso: string): string {
  return iso.slice(0, 10)
}

/** Prometida longe demais nao e urgencia: cai junto com quem nao tem data. */
function grupoDe(o: OrdemDaProducao, hoje: string, fimDaSemana: string): GrupoUrgencia {
  if (o.prometidaPara === null) return 'sem_data'
  const dia = diaPrometido(o.prometidaPara)
  if (dia < hoje) return 'atrasada'
  if (dia === hoje) return 'hoje'
  return dia <= fimDaSemana ? 'semana' : 'sem_data'
}

/** A fila da producao (spec, tela 8): em ordem de urgencia, e a data prometida e o unico compromisso que existe. */
export function classificarUrgencia(ordens: OrdemDaProducao[], agora: Date): FilaProducao {
  const hoje = hojeCalendario(agora)
  const fimDaSemana = hojeCalendario(new Date(agora.getTime() + 7 * 86_400_000))

  const porGrupo = new Map<GrupoUrgencia, OrdemDaProducao[]>()
  for (const o of ordens) {
    const g = grupoDe(o, hoje, fimDaSemana)
    const lista = porGrupo.get(g)
    if (lista) lista.push(o)
    else porGrupo.set(g, [o])
  }

  const grupos: GrupoDaFila[] = []
  for (const grupo of ORDEM_DOS_GRUPOS) {
    const lista = porGrupo.get(grupo)
    if (!lista || lista.length === 0) continue
    // Com data: a mais proxima do vencimento primeiro (a mais atrasada e a menor data).
    // Sem data: a aberta ha mais tempo primeiro, que e quem esta esperando ha mais tempo.
    lista.sort((a, b) =>
      grupo === 'sem_data'
        ? a.abertaEm.localeCompare(b.abertaEm)
        : (a.prometidaPara ?? '').localeCompare(b.prometidaPara ?? ''),
    )
    grupos.push({ grupo, ordens: lista })
  }

  return { grupos, total: ordens.length, atrasadas: porGrupo.get('atrasada')?.length ?? 0 }
}
```

Run: `npm test -- src/domain/producao` → PASS.

- [x] **Step 3: Indicadores de operação (teste)**

`src/domain/operacao/indicadores.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resumirOperacao, porAno, type OrdemMedida } from './indicadores'

function ordem(p: Partial<OrdemMedida> & { id: string }): OrdemMedida {
  return {
    estadoProducao: 'aberta', abertaEm: '2026-08-01T12:00:00.000Z', concluidaEm: null,
    precoFinal: '100.00', totalRecebido: '0.00', temItem: true, responsavelId: 'u1', ...p,
  }
}

describe('resumirOperacao', () => {
  it('conta abertas, concluidas e canceladas do periodo', () => {
    const r = resumirOperacao([
      ordem({ id: 'a' }),
      ordem({ id: 'b', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z' }),
      ordem({ id: 'c', estadoProducao: 'cancelada' }),
      ordem({ id: 'd', estadoProducao: 'orcamento' }),
    ])
    expect(r).toMatchObject({ total: 4, abertas: 1, concluidas: 1, canceladas: 1, orcamentos: 1 })
  })

  it('nao finalizadas e a fatia de abertas sobre abertas mais concluidas — o alvo da spec e abaixo de 5%', () => {
    const abertas = Array.from({ length: 3 }, (_, i) => ordem({ id: `a${i}` }))
    const concluidas = Array.from({ length: 7 }, (_, i) => ordem({ id: `c${i}`, estadoProducao: 'concluida' as const, concluidaEm: '2026-08-10T12:00:00.000Z' }))
    expect(resumirOperacao([...abertas, ...concluidas]).naoFinalizadasPct).toBe('30.0')
    expect(resumirOperacao([]).naoFinalizadasPct).toBe('0.0')
    // Orcamento e cancelada ficam fora da conta: nunca foram para producao.
    expect(resumirOperacao([ordem({ id: 'x', estadoProducao: 'orcamento' }), ordem({ id: 'y', estadoProducao: 'cancelada' })]).naoFinalizadasPct).toBe('0.0')
  })

  it('valor parado soma o saldo das ordens vivas nao pagas, e nao conta orcamento nem cancelada', () => {
    const r = resumirOperacao([
      ordem({ id: 'a', precoFinal: '2528.00', totalRecebido: '0.00' }),
      ordem({ id: 'b', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z', precoFinal: '300.00', totalRecebido: '100.00' }),
      ordem({ id: 'c', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z', precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ id: 'd', estadoProducao: 'cancelada', precoFinal: '900.00' }),
      ordem({ id: 'e', estadoProducao: 'orcamento', precoFinal: '900.00' }),
    ])
    expect(r.valorParado).toBe('2728.00')
  })

  it('prazo de entrega: mediana e p90 em dias, so das concluidas', () => {
    const dias = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
    const ordens = dias.map((d, i) => ordem({
      id: `c${i}`, estadoProducao: 'concluida' as const,
      abertaEm: '2026-01-01T12:00:00.000Z',
      concluidaEm: new Date(Date.UTC(2026, 0, 1 + d, 12)).toISOString(),
    }))
    // Nearest-rank: de 10 prazos, a mediana e o 5o e o p90 e o 9o. O 100 fica de fora dos dois —
    // e exatamente por isso a mediana e o p90 andam juntos na tela, nunca a media.
    const r = resumirOperacao([...ordens, ordem({ id: 'aberta' })])
    expect(r).toMatchObject({ prazoMedianoDias: 5, prazoP90Dias: 9 })
  })

  it('sem concluida, o prazo e null em vez de zero', () => {
    expect(resumirOperacao([ordem({ id: 'a' })])).toMatchObject({ prazoMedianoDias: null, prazoP90Dias: null })
  })

  it('item estruturado e quem tem pelo menos um item; o legado tinha 0%', () => {
    expect(resumirOperacao([ordem({ id: 'a' }), ordem({ id: 'b', temItem: false })]).comItemPct).toBe('50.0')
    expect(resumirOperacao([]).comItemPct).toBe('0.0')
  })

  it('conta quantas pessoas abriram ordem — o alvo da spec e mais de uma', () => {
    expect(resumirOperacao([ordem({ id: 'a' }), ordem({ id: 'b', responsavelId: 'u2' }), ordem({ id: 'c' })]).pessoas).toBe(2)
  })

  it('faturado e recebido do periodo', () => {
    const r = resumirOperacao([
      ordem({ id: 'a', precoFinal: '100.00', totalRecebido: '40.00' }),
      ordem({ id: 'b', precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ id: 'c', estadoProducao: 'cancelada', precoFinal: '900.00', totalRecebido: '0.00' }),
    ])
    expect(r).toMatchObject({ faturado: '150.00', recebido: '90.00' })
  })
})

describe('porAno', () => {
  it('uma linha por ano, do mais recente para o mais antigo, com ticket medio', () => {
    const linhas = porAno([
      ordem({ id: 'a', abertaEm: '2025-03-01T12:00:00.000Z', precoFinal: '100.00', totalRecebido: '100.00', estadoProducao: 'concluida', concluidaEm: '2025-03-05T12:00:00.000Z' }),
      ordem({ id: 'b', abertaEm: '2025-07-01T12:00:00.000Z', precoFinal: '300.00', totalRecebido: '50.00' }),
      ordem({ id: 'c', abertaEm: '2026-01-01T12:00:00.000Z', precoFinal: '250.00', totalRecebido: '250.00', estadoProducao: 'concluida', concluidaEm: '2026-01-02T12:00:00.000Z' }),
      ordem({ id: 'd', abertaEm: '2026-02-01T12:00:00.000Z', estadoProducao: 'cancelada', precoFinal: '900.00' }),
    ])
    // 2026 tem duas linhas, mas a cancelada nao e ordem que faturou: `ordens` conta so as vivas.
    expect(linhas).toEqual([
      { ano: 2026, ordens: 1, concluidas: 1, faturado: '250.00', recebido: '250.00', ticketMedio: '250.00' },
      { ano: 2025, ordens: 2, concluidas: 1, faturado: '400.00', recebido: '150.00', ticketMedio: '200.00' },
    ])
  })

  it('ano sem ordem faturada tem ticket medio zero, nao divisao por zero', () => {
    expect(porAno([ordem({ id: 'a', abertaEm: '2026-01-01T12:00:00.000Z', estadoProducao: 'cancelada' })])).toEqual([
      { ano: 2026, ordens: 0, concluidas: 0, faturado: '0.00', recebido: '0.00', ticketMedio: '0.00' },
    ])
  })

  it('lista vazia da array vazio', () => {
    expect(porAno([])).toEqual([])
  })
})
```

Run: `npm test -- src/domain/operacao` → vermelho.

- [x] **Step 4: Indicadores (implementação)**

`src/domain/operacao/indicadores.ts`:
```ts
import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'
import type { EstadoProducao } from '../ordem/estados'
import { resumirPagamento } from '../caixa/pagamento'

/** Serializavel: uma linha por ordem, com o total recebido ja somado pela infra. */
export interface OrdemMedida {
  id: string
  estadoProducao: EstadoProducao
  abertaEm: string
  concluidaEm: string | null
  precoFinal: string
  totalRecebido: string
  /** Ordem com pelo menos um item vivo. O legado tinha 0% (spec, secao 11). */
  temItem: boolean
  responsavelId: string
}

export interface Indicadores {
  total: number
  orcamentos: number
  abertas: number
  concluidas: number
  canceladas: number
  /** Fatia de abertas sobre abertas + concluidas, uma casa decimal. Alvo da spec: < 5%. */
  naoFinalizadasPct: string
  /** Soma do saldo das ordens vivas nao pagas. Alvo da spec: ~0. Hoje o legado tem R$ 207.795. */
  valorParado: string
  faturado: string
  recebido: string
  prazoMedianoDias: number | null
  prazoP90Dias: number | null
  /** Fatia de ordens com item estruturado. Alvo da spec: > 90%. */
  comItemPct: string
  /** Quantas pessoas distintas abriram ordem. Alvo da spec: 2 ou mais. */
  pessoas: number
}

const DIA_MS = 86_400_000
/** Orcamento nunca foi para producao e cancelada nao conta contra ninguem. */
const VIVAS: EstadoProducao[] = ['aberta', 'concluida']

function pct(parte: number, todo: number): string {
  return todo === 0 ? '0.0' : ((parte / todo) * 100).toFixed(1)
}

/** Percentil por posicao (nearest-rank), que e o que se explica em voz alta: "9 de 10 saem em ate N dias". */
function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1))
  return ordenados[i] ?? null
}

export function resumirOperacao(ordens: OrdemMedida[]): Indicadores {
  const conta = (e: EstadoProducao) => ordens.filter((o) => o.estadoProducao === e).length
  const vivas = ordens.filter((o) => VIVAS.includes(o.estadoProducao))

  let valorParado = dinheiro(0)
  let faturado = dinheiro(0)
  let recebido = dinheiro(0)
  for (const o of vivas) {
    const r = resumirPagamento(o.precoFinal, [o.totalRecebido])
    valorParado = valorParado.plus(r.saldo)
    faturado = faturado.plus(dinheiro(o.precoFinal))
    recebido = recebido.plus(r.totalRecebido)
  }

  const prazos = ordens
    .filter((o) => o.estadoProducao === 'concluida' && o.concluidaEm !== null)
    .map((o) => Math.round((new Date(o.concluidaEm as string).getTime() - new Date(o.abertaEm).getTime()) / DIA_MS))
    .sort((a, b) => a - b)

  const abertas = conta('aberta')
  const concluidas = conta('concluida')

  return {
    total: ordens.length,
    orcamentos: conta('orcamento'),
    abertas,
    concluidas,
    canceladas: conta('cancelada'),
    naoFinalizadasPct: pct(abertas, abertas + concluidas),
    valorParado: arredondarCentavos(valorParado).toFixed(2),
    faturado: arredondarCentavos(faturado).toFixed(2),
    recebido: arredondarCentavos(recebido).toFixed(2),
    prazoMedianoDias: percentil(prazos, 50),
    prazoP90Dias: percentil(prazos, 90),
    comItemPct: pct(ordens.filter((o) => o.temItem).length, ordens.length),
    pessoas: new Set(ordens.map((o) => o.responsavelId)).size,
  }
}

export interface AnoOperacao {
  ano: number
  /** Ordens vivas do ano: cancelada nao faturou e orcamento ainda nao e venda. */
  ordens: number
  concluidas: number
  faturado: string
  recebido: string
  ticketMedio: string
}

/** Historico ano a ano (spec, tela 9). Ate a Fase 6 importar as 18.443 legadas, so existe o ano corrente. */
export function porAno(ordens: OrdemMedida[]): AnoOperacao[] {
  const anos = new Map<number, OrdemMedida[]>()
  for (const o of ordens) {
    const ano = new Date(o.abertaEm).getUTCFullYear()
    const lista = anos.get(ano)
    if (lista) lista.push(o)
    else anos.set(ano, [o])
  }
  return [...anos.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ano, lista]) => {
      const vivas = lista.filter((o) => VIVAS.includes(o.estadoProducao))
      let faturado = dinheiro(0)
      let recebido = dinheiro(0)
      for (const o of vivas) {
        faturado = faturado.plus(dinheiro(o.precoFinal))
        recebido = recebido.plus(resumirPagamento(o.precoFinal, [o.totalRecebido]).totalRecebido)
      }
      const ticket = vivas.length === 0 ? dinheiro(0) : faturado.dividedBy(vivas.length)
      return {
        ano,
        ordens: vivas.length,
        concluidas: lista.filter((o) => o.estadoProducao === 'concluida').length,
        faturado: arredondarCentavos(faturado).toFixed(2),
        recebido: arredondarCentavos(recebido).toFixed(2),
        ticketMedio: arredondarCentavos(ticket).toFixed(2),
      }
    })
}
```

Run: `npm test -- src/domain/operacao` → PASS.

- [x] **Step 5: Carteira de clientes (teste)**

`src/domain/clientes/carteira.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { agruparPorDocumento, ROTULO_RECENCIA, type LinhaCarteira } from './carteira'

const agora = new Date('2026-08-29T15:00:00.000Z')
const mesesAtras = (n: number) => new Date(agora.getTime() - n * 30 * 86_400_000).toISOString()

function linha(p: Partial<LinhaCarteira> & { id: string; nome: string }): LinhaCarteira {
  return {
    apelido: null, documento: null,
    ordens: 1, faturado: '100.00', ultimaOrdemEm: mesesAtras(1), ...p,
  }
}

describe('agruparPorDocumento', () => {
  it('cadastros com o mesmo CNPJ viram um grupo so, somando ordens e faturamento', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'PREFEITURA DE UNAI - SAUDE', apelido: 'PMU SAUDE', documento: '18008342000122', ordens: 400, faturado: '200000.00', ultimaOrdemEm: mesesAtras(1) }),
      linha({ id: '2', nome: 'PREFEITURA DE UNAI - CULTURA', apelido: 'PMU CULTURA', documento: '18008342000122', ordens: 338, faturado: '104083.00', ultimaOrdemEm: mesesAtras(3) }),
      linha({ id: '3', nome: 'HELIO DA SILVA MOTA', documento: null, ordens: 2, faturado: '500.00' }),
    ], agora)
    expect(c.grupos[0]).toMatchObject({
      documento: '18008342000122', nome: 'PREFEITURA DE UNAI - SAUDE', cadastros: 2,
      ordens: 738, faturado: '304083.00', recencia: 'ativo',
    })
    expect(c.grupos[0]?.fatiaPct).toBe('99.8')
    expect(c.grupos[1]).toMatchObject({ documento: null, nome: 'HELIO DA SILVA MOTA', cadastros: 1, ordens: 2 })
  })

  it('cliente sem documento e seu proprio grupo, nunca agrupado com outro sem documento', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'A' }),
      linha({ id: '2', nome: 'B' }),
    ], agora)
    expect(c.grupos).toHaveLength(2)
  })

  it('ordena pelo faturado, do maior para o menor', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'PEQUENO', faturado: '10.00' }),
      linha({ id: '2', nome: 'GRANDE', faturado: '9000.00' }),
      linha({ id: '3', nome: 'MEDIO', faturado: '500.00' }),
    ], agora)
    expect(c.grupos.map((g) => g.nome)).toEqual(['GRANDE', 'MEDIO', 'PEQUENO'])
  })

  it.each([
    [1, 'ativo'],
    [6, 'ativo'],
    [7, 'adormecido'],
    [23, 'adormecido'],
    [25, 'perdido'],
  ] as const)('ultima ordem ha %s meses -> %s', (meses: number, esperado: string) => {
    const c = agruparPorDocumento([linha({ id: '1', nome: 'X', ultimaOrdemEm: mesesAtras(meses) })], agora)
    expect(c.grupos[0]?.recencia).toBe(esperado)
  })

  it('cliente que nunca comprou nao entra na carteira', () => {
    const c = agruparPorDocumento([linha({ id: '1', nome: 'NUNCA', ordens: 0, faturado: '0.00', ultimaOrdemEm: null })], agora)
    expect(c.grupos).toHaveLength(0)
    expect(c).toMatchObject({ faturadoTotal: '0.00', paraReativar: [] })
  })

  it('a lista de reativacao e so a faixa adormecida, do maior faturamento para o menor', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'ATIVO', faturado: '9000.00', ultimaOrdemEm: mesesAtras(2) }),
      linha({ id: '2', nome: 'ADORMECIDO PEQUENO', faturado: '300.00', ultimaOrdemEm: mesesAtras(10) }),
      linha({ id: '3', nome: 'ADORMECIDO GRANDE', faturado: '5000.00', ultimaOrdemEm: mesesAtras(18) }),
      linha({ id: '4', nome: 'PERDIDO', faturado: '8000.00', ultimaOrdemEm: mesesAtras(40) }),
    ], agora)
    expect(c.paraReativar.map((g) => g.nome)).toEqual(['ADORMECIDO GRANDE', 'ADORMECIDO PEQUENO'])
    expect(c.contagem).toEqual({ ativo: 1, adormecido: 2, perdido: 1 })
  })

  it('faturado total e a soma dos grupos, e a fatia de cada um fecha em 100', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'A', faturado: '750.00' }),
      linha({ id: '2', nome: 'B', faturado: '250.00' }),
    ], agora)
    expect(c.faturadoTotal).toBe('1000.00')
    expect(c.grupos.map((g) => g.fatiaPct)).toEqual(['75.0', '25.0'])
  })

  it('rotulos de recencia', () => {
    expect(ROTULO_RECENCIA).toEqual({ ativo: 'Ativo', adormecido: 'Adormecido', perdido: 'Perdido' })
  })
})
```

Run: `npm test -- src/domain/clientes/carteira` → vermelho.

- [x] **Step 6: Carteira (implementação)**

`src/domain/clientes/carteira.ts`:
```ts
import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'

/**
 * Ativo, adormecido e perdido, medidos no ORDEM.DBF do legado: dos 3.153 clientes com ordem,
 * 131 compraram nos ultimos 6 meses, 66 entre 6 e 12, 188 entre 1 e 2 anos e 2.768 ha mais de
 * dois. A faixa adormecida da 254 nomes — uma lista que cabe num dia de telefonemas.
 */
export type Recencia = 'ativo' | 'adormecido' | 'perdido'

export const ROTULO_RECENCIA: Record<Recencia, string> = { ativo: 'Ativo', adormecido: 'Adormecido', perdido: 'Perdido' }

const MES_MS = 30 * 86_400_000
const MESES_ATIVO = 6
const MESES_PERDIDO = 24

/** Uma linha por cadastro, com ordens e faturamento ja somados pela infra. */
export interface LinhaCarteira {
  id: string
  nome: string
  apelido: string | null
  /** So digitos: 11 (CPF) ou 14 (CNPJ); null quando nao informado. */
  documento: string | null
  ordens: number
  faturado: string
  /** ISO da ordem mais recente; null quando o cliente nunca comprou. */
  ultimaOrdemEm: string | null
}

export interface GrupoCarteira {
  /** null quando o cadastro nao tem documento: cada um e seu proprio grupo. */
  documento: string | null
  /** O nome do cadastro que mais faturou no grupo. */
  nome: string
  apelido: string | null
  /** Quantos cadastros o grupo reune. A Prefeitura de Unai sao 18, um por secretaria. */
  cadastros: number
  clienteIds: string[]
  ordens: number
  faturado: string
  /** Fatia do faturamento total, uma casa decimal. */
  fatiaPct: string
  ultimaOrdemEm: string
  recencia: Recencia
}

export interface Carteira {
  /** Do maior faturamento para o menor. Cliente que nunca comprou fica de fora. */
  grupos: GrupoCarteira[]
  faturadoTotal: string
  contagem: Record<Recencia, number>
  /** So a faixa adormecida: quem some ha mais de dois anos nao e campanha, e cauda morta. */
  paraReativar: GrupoCarteira[]
}

function recenciaDe(ultima: string, agora: Date): Recencia {
  const meses = (agora.getTime() - new Date(ultima).getTime()) / MES_MS
  if (meses <= MESES_ATIVO) return 'ativo'
  return meses <= MESES_PERDIDO ? 'adormecido' : 'perdido'
}

/**
 * Agrupar por documento e o que revela o maior cliente da empresa (spec, secao 4): a Prefeitura
 * de Unai existe em 18 cadastros sob o mesmo CNPJ porque cada secretaria tem empenho separado.
 */
export function agruparPorDocumento(linhas: LinhaCarteira[], agora: Date): Carteira {
  const comOrdem = linhas.filter((l) => l.ordens > 0 && l.ultimaOrdemEm !== null)

  // Chave por documento; sem documento, o proprio id — nunca juntar dois anonimos.
  const porChave = new Map<string, LinhaCarteira[]>()
  for (const l of comOrdem) {
    const chave = l.documento ?? `id:${l.id}`
    const lista = porChave.get(chave)
    if (lista) lista.push(l)
    else porChave.set(chave, [l])
  }

  let faturadoTotal = dinheiro(0)
  const grupos: GrupoCarteira[] = []
  for (const lista of porChave.values()) {
    const porFaturado = [...lista].sort((a, b) => dinheiro(b.faturado).comparedTo(dinheiro(a.faturado)))
    const principal = porFaturado[0] as LinhaCarteira
    const faturado = lista.reduce((s, l) => s.plus(dinheiro(l.faturado)), dinheiro(0))
    const ultimaOrdemEm = lista.reduce((maior, l) => ((l.ultimaOrdemEm as string) > maior ? (l.ultimaOrdemEm as string) : maior), lista[0]?.ultimaOrdemEm as string)
    faturadoTotal = faturadoTotal.plus(faturado)
    grupos.push({
      documento: principal.documento,
      nome: principal.nome,
      apelido: principal.apelido,
      cadastros: lista.length,
      clienteIds: lista.map((l) => l.id),
      ordens: lista.reduce((s, l) => s + l.ordens, 0),
      faturado: arredondarCentavos(faturado).toFixed(2),
      fatiaPct: '0.0', // preenchido abaixo, quando o total existe
      ultimaOrdemEm,
      recencia: recenciaDe(ultimaOrdemEm, agora),
    })
  }

  grupos.sort((a, b) => dinheiro(b.faturado).comparedTo(dinheiro(a.faturado)))
  const total = arredondarCentavos(faturadoTotal)
  for (const g of grupos) {
    g.fatiaPct = total.isZero() ? '0.0' : dinheiro(g.faturado).dividedBy(total).times(100).toFixed(1)
  }

  const contagem: Record<Recencia, number> = { ativo: 0, adormecido: 0, perdido: 0 }
  for (const g of grupos) contagem[g.recencia] += 1

  return {
    grupos,
    faturadoTotal: total.toFixed(2),
    contagem,
    paraReativar: grupos.filter((g) => g.recencia === 'adormecido'),
  }
}
```

Run: `npm test -- src/domain/clientes/carteira` → PASS. Run: `npm test` → PASS, `pureza` incluso (nada em `src/domain/producao`, `src/domain/operacao` ou `carteira.ts` importa infra). Run: `npm run typecheck` → sem erros.

- [x] **Step 7: Commit**

```bash
git add src/domain/producao src/domain/operacao src/domain/clientes/carteira.ts src/domain/clientes/carteira.test.ts
git commit -m "feat: dominio da producao e da administracao - urgencia da fila, indicadores de operacao e carteira de clientes por documento"
```

**Executado (29/08/2026).** 295 unitarios verdes (eram 265), typecheck limpo, `pureza` passando.
Dois ajustes que os testes exigiram, ja aplicados acima:

1. O TS 7 recusa `{ id: p.id, ..., ...p }` com **TS2783** ("specified more than once"): a chave
   repetida antes do spread sai das tres fabricas de teste — o `...p` ja a fornece.
2. No primeiro teste de `classificarUrgencia`, as ordens 1 e 4 caiam as duas em `sem_data` com o
   mesmo `abertaEm`, e a expectativa `[4, 1]` dependia da ordem de insercao. A ordem 4 passou a
   ser aberta antes, para a asserção medir o criterio de verdade em vez do acaso do sort.

---
### Task 2: Schema — dados da empresa que saem no impresso

**Files:**
- Modify: `prisma/schema.prisma` (campos novos em `Empresa`), `prisma/seed.ts` (preencher os dados da DruSign)
- Create: `prisma/migrations/<timestamp>_dados_da_empresa/migration.sql` (gerada)

**Interfaces:**
- Consumes: nada novo.
- Produces: colunas `empresa.nome_fantasia`, `cnpj`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `telefone1`, `telefone2`.

- [x] **Step 1: Campos novos em Empresa**

Em `prisma/schema.prisma`, no model `Empresa`, logo depois de `razaoSocial`:
```prisma
  /// O nome grande do cabecalho do impresso; a razao social vai embaixo, menor.
  nomeFantasia String? @map("nome_fantasia") @db.VarChar(80)
  /// So digitos: 14. Sai no impresso quando existe.
  cnpj         String? @db.VarChar(14)
  endereco     String? @db.VarChar(160)
  bairro       String? @db.VarChar(60)
  cidade       String? @db.VarChar(60)
  uf           String? @db.VarChar(2)
  cep          String? @db.VarChar(9)
  /// Normalizados (so digitos), como os do cliente. Ate dois: fixo e celular.
  telefone1    String? @map("telefone_1") @db.VarChar(11)
  telefone2    String? @map("telefone_2") @db.VarChar(11)
```
(O logo **não** entra aqui: precisa de armazenamento de arquivo e vai junto com o R2 do anexo de arte, na Fase 6.)

- [x] **Step 2: Migração**

Run: `npm run db:migrar -- dados_da_empresa`
Expected: `prisma/migrations/<timestamp>_dados_da_empresa/migration.sql` com um único `ALTER TABLE "empresa"` acrescentando as nove colunas, todas nullable e sem default; `migrate deploy` aplicado no `drusign`; `prisma generate` rodado. Conferir o SQL com o Read tool antes de seguir — se aparecer qualquer `DROP`, parar.

Run: `npm run typecheck` → sem erros.

- [x] **Step 3: Seed preenche a DruSign**

Em `prisma/seed.ts`, onde a empresa é criada/atualizada, acrescentar aos dados (mantendo o `upsert`/`create` que já existe):
```ts
    nomeFantasia: 'DruSign',
    cidade: 'Unaí',
    uf: 'MG',
```
(Só o que se sabe com certeza. CNPJ, endereço e telefone o Otavio preenche na tela `/empresa` — deixar em branco é honesto; inventar dado que sai no impresso do cliente, não.)

Run: `npm run db:seed` → sem erro. Conferir:
```bash
node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();console.log((await c.query('select razao_social, nome_fantasia, cidade, uf from empresa')).rows);await c.end()})()"
```
Expected: uma linha com `nome_fantasia: 'DruSign'`, `cidade: 'Unaí'`, `uf: 'MG'`.

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: dados da empresa no banco - nome fantasia, CNPJ, endereco e telefones do cabecalho do impresso"
```

**Executado (29/08/2026).** A migracao `20260829182801_dados_da_empresa` traz um `ALTER TABLE
"empresa"` com as nove colunas nullable e nenhum `DROP`, como previsto.

Um desvio no Step 3: o `upsert` do seed tem `update: {}`, entao num banco que ja tinha a empresa
o `create` nao roda e os campos ficavam em branco — a verificacao do plano nao fechava. O seed
passa a preencher **so o que ainda esta null**, depois do upsert. Assim ele continua util num
banco ja usado sem sobrescrever o que o Otavio digitar em `/empresa`, que era o motivo do
`update: {}` vazio existir.

---

### Task 3: Repositório — fila de produção, indicadores, carteira, usuários e empresa

**Files:**
- Create: `src/infra/producao/fila.ts`, `src/infra/operacao/indicadores.ts`, `src/infra/clientes/carteira.ts`, `src/infra/usuarios/repositorio.ts`, `src/infra/empresa/repositorio.ts`
- Modify: `src/infra/ordens/impresso.ts` (empresa vem do banco)
- Test: `src/infra/producao/producao.int.test.ts`, `src/infra/usuarios/repositorio.int.test.ts`

**Interfaces:**
- Consumes: `prisma`, `paraDominio`, `totalRecebidoPorOrdem` (`src/infra/caixa/resumo.ts`), `concluirOrdem` (`src/infra/caixa/recebimentos.ts`), `hashSenha` (`src/infra/auth/senha.ts`), `limitesDoDia`; `classificarUrgencia`, `resumirOperacao`, `porAno`, `agruparPorDocumento`; `ErroDeValidacao`.
- Produces:
  - `carregarFilaProducao(empresaId, agora?): Promise<FilaProducao>`
  - `carregarOperacao(empresaId, periodo?: { de: string; ate: string }): Promise<{ indicadores: Indicadores; anos: AnoOperacao[]; de: string | null; ate: string | null }>`
  - `carregarCarteira(empresaId, agora?): Promise<Carteira>`
  - `listarUsuarios(empresaId): Promise<UsuarioTela[]>`, `criarUsuario(empresaId, dados): Promise<{ id }>`, `alterarUsuario(empresaId, id, dados)`, `alterarAtivoUsuario(empresaId, id, ativo, usuarioAtualId)`, `trocarSenha(empresaId, id, senha)`
  - `obterEmpresa(empresaId): Promise<EmpresaTela>`, `salvarEmpresa(empresaId, dados): Promise<void>`

- [ ] **Step 1: Fila de produção, indicadores e carteira (teste de integração)**

`src/infra/producao/producao.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import { criarOrdem, adicionarItem, atualizarCabecalho, type DadosItem } from '@/infra/ordens/repositorio'
import { registrarRecebimento, concluirOrdem } from '@/infra/caixa/recebimentos'
import { carregarFilaProducao } from './fila'
import { carregarOperacao } from '@/infra/operacao/indicadores'
import { carregarCarteira } from '@/infra/clientes/carteira'

let base: Contexto
const ctx = () => ({ ...base, chave: randomUUID() })
const ITEM = (descricao: string, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade: 1, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const vendas = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' } })
  await prisma.empresa.update({ where: { id: empresa.id }, data: { contaRecebimentoId: vendas.id } })
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

async function ordemCom(valor: string, descricao = 'PLACA ACM') {
  const o = await criarOrdem(ctx(), { estado: 'aberta' })
  const t = await adicionarItem(ctx(), o.id, o.versao, ITEM(descricao, valor))
  return { id: o.id, numero: o.numero, versao: t.versao }
}

describe('fila de producao (banco real)', () => {
  it('agrupa por urgencia, traz os itens e nao devolve orcamento, concluida nem cancelada', async () => {
    const atrasada = await ordemCom('100.00', 'PLACA ATRASADA')
    await atualizarCabecalho(ctx(), atrasada.id, atrasada.versao, { prometidaPara: '2020-01-01' })
    const semData = await ordemCom('50.00', 'BANNER SEM DATA')
    const concluida = await ordemCom('80.00', 'JA PRONTA')
    await concluirOrdem(ctx(), concluida.id, concluida.versao)
    const orcamento = await criarOrdem(ctx(), { estado: 'orcamento' })

    const fila = await carregarFilaProducao(base.empresaId)
    expect(fila.grupos.map((g) => g.grupo)).toEqual(['atrasada', 'sem_data'])
    expect(fila.grupos[0]?.ordens[0]).toMatchObject({ id: atrasada.id, itens: ['PLACA ATRASADA'] })
    expect(fila.grupos[1]?.ordens.map((o) => o.id)).toEqual([semData.id])
    expect(fila.total).toBe(2)
    expect(fila.atrasadas).toBe(1)
    const ids = fila.grupos.flatMap((g) => g.ordens.map((o) => o.id))
    expect(ids).not.toContain(concluida.id)
    expect(ids).not.toContain(orcamento.id)
  })

  it('a versao que vem na fila serve para concluir; item removido nao aparece na descricao', async () => {
    const o = await ordemCom('100.00', 'PLACA A')
    const t = await adicionarItem(ctx(), o.id, o.versao, ITEM('PLACA B', '20.00'))
    const fila = await carregarFilaProducao(base.empresaId)
    const daFila = fila.grupos[0]?.ordens[0]
    expect(daFila?.itens).toEqual(['PLACA A', 'PLACA B'])
    expect(daFila?.versao).toBe(t.versao)
    const r = await concluirOrdem(ctx(), o.id, daFila?.versao ?? 0)
    expect(r.estadoProducao).toBe('concluida')
    expect((await carregarFilaProducao(base.empresaId)).total).toBe(0)
  })

  it('nao enxerga ordem de outra empresa', async () => {
    await ordemCom('100.00')
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    expect((await carregarFilaProducao(outra.id)).total).toBe(0)
  })
})

describe('indicadores de operacao (banco real)', () => {
  it('conta, mede o valor parado e o prazo, e separa por ano', async () => {
    const paga = await ordemCom('150.00')
    await registrarRecebimento(ctx(), paga.id, paga.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })
    const parada = await ordemCom('2528.00')
    const parcial = await ordemCom('300.00')
    const c = await concluirOrdem(ctx(), parcial.id, parcial.versao)
    await registrarRecebimento(ctx(), parcial.id, c.versao, { valor: '100', forma: 'dinheiro', data: '2026-08-29', concluir: false })

    const { indicadores, anos } = await carregarOperacao(base.empresaId)
    expect(indicadores).toMatchObject({ total: 3, abertas: 1, concluidas: 2, valorParado: '2728.00', faturado: '2978.00', recebido: '250.00', comItemPct: '100.0', pessoas: 1 })
    expect(indicadores.naoFinalizadasPct).toBe('33.3')
    expect(indicadores.prazoMedianoDias).toBe(0)
    expect(anos).toHaveLength(1)
    expect(anos[0]).toMatchObject({ ano: 2026, ordens: 3, concluidas: 2, faturado: '2978.00' })
    void parada
  })

  it('o periodo filtra por aberta_em no calendario de Sao Paulo; periodo invertido e recusado', async () => {
    const o = await ordemCom('100.00')
    await prisma.ordemServico.update({ where: { id: o.id }, data: { abertaEm: new Date('2026-07-15T15:00:00.000Z') } })
    expect((await carregarOperacao(base.empresaId, { de: '2026-07-01', ate: '2026-07-31' })).indicadores.total).toBe(1)
    expect((await carregarOperacao(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })).indicadores.total).toBe(0)
    await expect(carregarOperacao(base.empresaId, { de: '2026-08-31', ate: '2026-08-01' })).rejects.toThrow(/período/)
  })
})

describe('carteira de clientes (banco real)', () => {
  it('agrupa os cadastros do mesmo CNPJ, soma o faturado e classifica a recencia', async () => {
    const cnpj = '18008342000122'
    const saude = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'PREFEITURA - SAUDE', apelido: 'PMU SAUDE', documento: cnpj } })
    const cultura = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'PREFEITURA - CULTURA', apelido: 'PMU CULTURA', documento: cnpj } })
    const helio = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'HELIO DA SILVA MOTA' } })
    await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'NUNCA COMPROU' } })

    for (const [cliente, valor] of [[saude.id, '900.00'], [cultura.id, '100.00'], [helio.id, '500.00']] as const) {
      const o = await ordemCom(valor)
      await atualizarCabecalho(ctx(), o.id, o.versao, { clienteId: cliente })
    }

    const carteira = await carregarCarteira(base.empresaId)
    expect(carteira.grupos).toHaveLength(2)
    expect(carteira.grupos[0]).toMatchObject({ documento: cnpj, nome: 'PREFEITURA - SAUDE', cadastros: 2, ordens: 2, faturado: '1000.00', fatiaPct: '66.7', recencia: 'ativo' })
    expect(carteira.grupos[1]).toMatchObject({ nome: 'HELIO DA SILVA MOTA', cadastros: 1, faturado: '500.00' })
    expect(carteira.faturadoTotal).toBe('1500.00')
    expect(carteira.contagem).toEqual({ ativo: 2, adormecido: 0, perdido: 0 })
  })

  it('venda de balcao nao vira cliente, e cancelada nao conta faturamento', async () => {
    const cliente = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'ALGUEM' } })
    const boa = await ordemCom('100.00')
    await atualizarCabecalho(ctx(), boa.id, boa.versao, { clienteId: cliente.id })
    await ordemCom('999.00') // balcao, sem cliente
    const carteira = await carregarCarteira(base.empresaId)
    expect(carteira.grupos).toHaveLength(1)
    expect(carteira.faturadoTotal).toBe('100.00')
  })
})
```

Run: `npm run test:int -- producao` → vermelho (`Cannot find module './fila'`).

- [ ] **Step 2: Fila de produção (implementação)**

`src/infra/producao/fila.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { classificarUrgencia, type FilaProducao, type OrdemDaProducao } from '@/domain/producao/urgencia'

/**
 * So o que esta em producao: orcamento ainda nao foi aprovado, concluida ja saiu e
 * cancelada nao existe mais. Nenhum valor sai daqui — a producao nao ve dinheiro.
 */
export async function carregarFilaProducao(empresaId: string, agora: Date = new Date()): Promise<FilaProducao> {
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, estadoProducao: 'aberta' },
    select: {
      id: true, numero: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, versao: true,
      itens: { where: { removidoEm: null }, orderBy: { ordemExibicao: 'asc' }, select: { descricao: true } },
    },
  })
  const lista: OrdemDaProducao[] = ordens.map((o) => ({
    id: o.id, numero: o.numero, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
    abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null,
    versao: o.versao, itens: o.itens.map((i) => i.descricao),
  }))
  return classificarUrgencia(lista, agora)
}
```

- [ ] **Step 3: Indicadores e carteira (implementação)**

`src/infra/operacao/indicadores.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { limitesDoDia } from '@/domain/ordem/datas'
import { resumirOperacao, porAno, type AnoOperacao, type Indicadores, type OrdemMedida } from '@/domain/operacao/indicadores'
import { totalRecebidoPorOrdem } from '@/infra/caixa/resumo'

export interface Operacao {
  indicadores: Indicadores
  anos: AnoOperacao[]
  de: string | null
  ate: string | null
}

/** Nenhum numero daqui e coluna: tudo derivado na leitura, como o eixo de pagamento (spec, secao 9). */
export async function carregarOperacao(empresaId: string, periodo?: { de: string; ate: string }): Promise<Operacao> {
  let filtro = {}
  if (periodo) {
    const limites = limitesDoDia(periodo.de, periodo.ate)
    if (!limites) throw new ErroDeValidacao('período inválido')
    filtro = { abertaEm: { gte: limites.inicio, lt: limites.fim } }
  }
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, ...filtro },
    select: {
      id: true, estadoProducao: true, abertaEm: true, concluidaEm: true, precoFinal: true, responsavelId: true,
      _count: { select: { itens: { where: { removidoEm: null } } } },
    },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, ordens.map((o) => o.id))
  const medidas: OrdemMedida[] = ordens.map((o) => ({
    id: o.id, estadoProducao: o.estadoProducao, abertaEm: o.abertaEm.toISOString(),
    concluidaEm: o.concluidaEm?.toISOString() ?? null, precoFinal: paraDominio(o.precoFinal).toFixed(2),
    totalRecebido: totais.get(o.id) ?? '0.00', temItem: o._count.itens > 0, responsavelId: o.responsavelId,
  }))
  return {
    indicadores: resumirOperacao(medidas),
    anos: porAno(medidas),
    de: periodo?.de ?? null,
    ate: periodo?.ate ?? null,
  }
}
```

`src/infra/clientes/carteira.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { agruparPorDocumento, type Carteira, type LinhaCarteira } from '@/domain/clientes/carteira'

/** Cancelada nao faturou; orcamento ainda nao e venda. */
const FATURAM = ['aberta', 'concluida'] as const

/**
 * Uma linha por cadastro; o dominio e quem junta os cadastros do mesmo documento.
 * Venda de balcao (ordem sem cliente) fica de fora: nao ha carteira sem nome.
 */
export async function carregarCarteira(empresaId: string, agora: Date = new Date()): Promise<Carteira> {
  const [clientes, grupos] = await Promise.all([
    prisma.cliente.findMany({
      where: { empresaId, arquivadoEm: null },
      select: { id: true, nome: true, apelido: true, documento: true },
    }),
    prisma.ordemServico.groupBy({
      by: ['clienteId'],
      where: { empresaId, clienteId: { not: null }, estadoProducao: { in: [...FATURAM] } },
      _count: { _all: true },
      _sum: { precoFinal: true },
      _max: { abertaEm: true },
    }),
  ])
  const porCliente = new Map(grupos.map((g) => [g.clienteId as string, g]))
  const linhas: LinhaCarteira[] = clientes.map((c) => {
    const g = porCliente.get(c.id)
    return {
      id: c.id, nome: c.nome, apelido: c.apelido, documento: c.documento,
      ordens: g?._count._all ?? 0,
      faturado: g?._sum.precoFinal ? paraDominio(g._sum.precoFinal).toFixed(2) : '0.00',
      ultimaOrdemEm: g?._max.abertaEm?.toISOString() ?? null,
    }
  })
  return agruparPorDocumento(linhas, agora)
}
```

Run: `npm run test:int -- producao` → PASS (7).

- [ ] **Step 4: Usuários (teste de integração)**

`src/infra/usuarios/repositorio.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { verificarSenha } from '@/infra/auth/senha'
import { listarUsuarios, criarUsuario, alterarUsuario, alterarAtivoUsuario, trocarSenha } from './repositorio'

let empresaId = ''
let odeteId = ''

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const odete = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  empresaId = empresa.id
  odeteId = odete.id
})

describe('usuarios (banco real)', () => {
  it('cria com senha em Argon2, lista sem o hash e nunca repete login', async () => {
    const novo = await criarUsuario(empresaId, { nome: '  Pedro Souza ', login: '  Pedro ', papel: 'operacao', senha: 'senha-boa-123' })
    const gravado = await prisma.usuario.findUniqueOrThrow({ where: { id: novo.id } })
    expect(gravado).toMatchObject({ nome: 'Pedro Souza', login: 'pedro', papel: 'operacao', ativo: true })
    expect(gravado.senhaHash.startsWith('$argon2id$')).toBe(true)
    expect(await verificarSenha(gravado.senhaHash, 'senha-boa-123')).toBe(true)

    const lista = await listarUsuarios(empresaId)
    expect(lista.map((u) => [u.login, u.papel, u.ativo])).toEqual([['odete', 'administracao', true], ['pedro', 'operacao', true]])
    expect(JSON.stringify(lista)).not.toContain('argon2')

    await expect(criarUsuario(empresaId, { nome: 'Outro', login: 'PEDRO', papel: 'operacao', senha: 'senha-boa-123' })).rejects.toThrow(/já existe/)
  })

  it.each([
    [{ nome: '', login: 'x', papel: 'operacao', senha: 'senha-boa-123' }, /nome/],
    [{ nome: 'X', login: '', papel: 'operacao', senha: 'senha-boa-123' }, /login/],
    [{ nome: 'X', login: 'com espaco', papel: 'operacao', senha: 'senha-boa-123' }, /login/],
    [{ nome: 'X', login: 'xx', papel: 'chefe', senha: 'senha-boa-123' }, /papel/],
    [{ nome: 'X', login: 'xx', papel: '', senha: 'senha-boa-123' }, /papel/],
    [{ nome: 'X', login: 'xx', papel: 'operacao', senha: 'curta' }, /senha/],
  ])('recusa %j', async (dados: { nome: string; login: string; papel: string; senha: string }, erro: RegExp) => {
    await expect(criarUsuario(empresaId, dados)).rejects.toThrow(erro)
  })

  it('altera nome e papel; troca de senha grava hash novo e nao mexe no resto', async () => {
    const p = await criarUsuario(empresaId, { nome: 'Pedro', login: 'pedro', papel: 'operacao', senha: 'senha-boa-123' })
    await alterarUsuario(empresaId, p.id, { nome: 'Pedro Souza', papel: 'administracao' })
    expect(await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ nome: 'Pedro Souza', papel: 'administracao', login: 'pedro' })

    const antes = (await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).senhaHash
    await trocarSenha(empresaId, p.id, 'outra-senha-boa')
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })
    expect(depois.senhaHash).not.toBe(antes)
    expect(await verificarSenha(depois.senhaHash, 'outra-senha-boa')).toBe(true)
    await expect(trocarSenha(empresaId, p.id, 'curta')).rejects.toThrow(/senha/)
  })

  it('desativa e reativa, mas ninguem se desativa e a ultima administracao ativa nao sai', async () => {
    const p = await criarUsuario(empresaId, { nome: 'Pedro', login: 'pedro', papel: 'operacao', senha: 'senha-boa-123' })
    await alterarAtivoUsuario(empresaId, p.id, false, odeteId)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).ativo).toBe(false)
    expect((await listarUsuarios(empresaId)).find((u) => u.id === p.id)?.ativo).toBe(false) // desativado continua na lista

    await alterarAtivoUsuario(empresaId, p.id, true, odeteId)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).ativo).toBe(true)

    await expect(alterarAtivoUsuario(empresaId, odeteId, false, odeteId)).rejects.toThrow(/você mesma/)
    const outraAdmin = await criarUsuario(empresaId, { nome: 'Otavio', login: 'otavio', papel: 'administracao', senha: 'senha-boa-123' })
    await alterarAtivoUsuario(empresaId, outraAdmin.id, false, odeteId)
    await expect(alterarAtivoUsuario(empresaId, odeteId, false, outraAdmin.id)).rejects.toThrow(/única administração/)
  })

  it('usuario de outra empresa nao e visto nem alterado', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const alheio = await prisma.usuario.create({ data: { empresaId: outra.id, nome: 'Estranho', login: 'estranho', senhaHash: 'x' } })
    expect((await listarUsuarios(empresaId)).map((u) => u.id)).toEqual([odeteId])
    await expect(alterarUsuario(empresaId, alheio.id, { nome: 'X', papel: 'operacao' })).rejects.toThrow(/não encontrado/)
    await expect(trocarSenha(empresaId, alheio.id, 'senha-boa-123')).rejects.toThrow(/não encontrado/)
    await expect(alterarAtivoUsuario(empresaId, alheio.id, false, odeteId)).rejects.toThrow(/não encontrado/)
  })
})
```

Run: `npm run test:int -- usuarios` → vermelho.

- [ ] **Step 5: Usuários e empresa (implementação)**

`src/infra/usuarios/repositorio.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { hashSenha } from '@/infra/auth/senha'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface UsuarioTela {
  id: string
  nome: string
  login: string
  papel: PapelUsuario
  ativo: boolean
  criadoEm: string
}

/** Minimo do OWASP para senha sem segundo fator; a loja tem tres pessoas na mesma sala. */
const MINIMO_SENHA = 8

function nomeLimpo(nome: string): string {
  const n = nome.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (n === '') throw new ErroDeValidacao('informe o nome')
  return n
}

/** Login e minusculo e sem espaco: quem digita no balcao nao pensa em maiuscula. */
function loginLimpo(login: string): string {
  const l = login.trim().toLowerCase()
  if (!/^[a-z0-9._-]{2,64}$/.test(l)) throw new ErroDeValidacao('login: 2 a 64 letras, números, ponto, hífen ou sublinhado, sem espaço')
  return l
}

function papelValido(papel: string): PapelUsuario {
  if (papel !== 'administracao' && papel !== 'operacao') throw new ErroDeValidacao('escolha o papel')
  return papel
}

function senhaValida(senha: string): string {
  if (senha.length < MINIMO_SENHA) throw new ErroDeValidacao(`a senha precisa de pelo menos ${MINIMO_SENHA} caracteres`)
  return senha
}

async function exigirUsuarioDaEmpresa(empresaId: string, id: string) {
  const u = await prisma.usuario.findFirst({ where: { id, empresaId }, select: { id: true, papel: true, ativo: true } })
  if (!u) throw new ErroDeValidacao('usuário não encontrado')
  return u
}

export async function listarUsuarios(empresaId: string): Promise<UsuarioTela[]> {
  const linhas = await prisma.usuario.findMany({
    where: { empresaId },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, login: true, papel: true, ativo: true, criadoEm: true },
  })
  return linhas.map((u) => ({ ...u, criadoEm: u.criadoEm.toISOString() }))
}

export async function criarUsuario(empresaId: string, dados: { nome: string; login: string; papel: string; senha: string }): Promise<{ id: string }> {
  const nome = nomeLimpo(dados.nome)
  const login = loginLimpo(dados.login)
  const papel = papelValido(dados.papel)
  const senhaHash = await hashSenha(senhaValida(dados.senha))
  // O login e unico no banco inteiro (@unique no schema), nao por empresa: conferir antes
  // da a mensagem certa em vez do P2002.
  const repetido = await prisma.usuario.findUnique({ where: { login }, select: { id: true } })
  if (repetido) throw new ErroDeValidacao('já existe usuário com esse login')
  return prisma.usuario.create({ data: { empresaId, nome, login, papel, senhaHash }, select: { id: true } })
}

export async function alterarUsuario(empresaId: string, id: string, dados: { nome: string; papel: string }): Promise<void> {
  await exigirUsuarioDaEmpresa(empresaId, id)
  await prisma.usuario.update({ where: { id }, data: { nome: nomeLimpo(dados.nome), papel: papelValido(dados.papel) } })
}

export async function trocarSenha(empresaId: string, id: string, senha: string): Promise<void> {
  await exigirUsuarioDaEmpresa(empresaId, id)
  await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashSenha(senhaValida(senha)) } })
}

/** Nunca apaga: o usuario e responsavel_id de ordens antigas (spec, secao 4). */
export async function alterarAtivoUsuario(empresaId: string, id: string, ativo: boolean, usuarioAtualId: string): Promise<void> {
  const alvo = await exigirUsuarioDaEmpresa(empresaId, id)
  if (!ativo) {
    if (id === usuarioAtualId) throw new ErroDeValidacao('você mesma não pode se desativar')
    if (alvo.papel === 'administracao') {
      const outras = await prisma.usuario.count({ where: { empresaId, papel: 'administracao', ativo: true, id: { not: id } } })
      if (outras === 0) throw new ErroDeValidacao('esta é a única administração ativa; promova outra pessoa antes')
    }
  }
  await prisma.usuario.update({ where: { id }, data: { ativo } })
}
```

`src/infra/empresa/repositorio.ts`:
```ts
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
```

- [ ] **Step 6: O impresso passa a ler a empresa do banco**

Em `src/infra/ordens/impresso.ts`, trocar o `select` da empresa e o objeto devolvido:
```ts
      empresa: {
        select: {
          razaoSocial: true, nomeFantasia: true, cnpj: true, endereco: true,
          bairro: true, cidade: true, uf: true, telefone1: true, telefone2: true,
        },
      },
```
e, no retorno, no lugar de `empresa: { nomeFantasia: 'DruSign', razaoSocial: o.empresa.razaoSocial }`:
```ts
    empresa: {
      // Sem nome fantasia, o nome grande do cabecalho e a propria razao social.
      nomeFantasia: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
      razaoSocial: o.empresa.razaoSocial,
      cnpj: o.empresa.cnpj,
      endereco: [o.empresa.endereco, o.empresa.bairro].filter(Boolean).join(' · ') || null,
      cidadeUf: o.empresa.cidade ? `${o.empresa.cidade}${o.empresa.uf ? `/${o.empresa.uf}` : ''}` : null,
      telefones: [o.empresa.telefone1, o.empresa.telefone2].filter((t): t is string => t !== null),
    },
```

Run: `npm run typecheck` → sem erros. Run: `npm run test:int` → PASS (56 + 7 de produção + 5 de usuários = **68**). Run: `npm test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/infra/producao src/infra/operacao src/infra/clientes/carteira.ts src/infra/usuarios src/infra/empresa src/infra/ordens/impresso.ts
git commit -m "feat: fila de producao, indicadores de operacao, carteira de clientes, usuarios e dados da empresa no impresso"
```

---
### Task 4: Telas — fila de produção, operação, carteira, usuários e dados da empresa

**Files:**
- Modify: `src/app/(app)/navegacao.ts`, `src/app/(app)/layout.tsx` (ícones), `src/app/(app)/page.tsx` (decide por papel), `src/app/(app)/clientes/page.tsx` (link para a carteira)
- Create: `src/app/(app)/producao/page.tsx`, `src/app/(app)/producao/actions.ts`, `src/app/(app)/producao/botao-finalizado.tsx`, `src/app/(app)/producao/fila-producao.tsx`, `src/app/(app)/fila-trabalho.tsx`, `src/app/(app)/operacao/page.tsx`, `src/app/(app)/clientes/carteira/page.tsx`, `src/app/(app)/usuarios/page.tsx`, `src/app/(app)/usuarios/actions.ts`, `src/app/(app)/usuarios/form-usuario.tsx`, `src/app/(app)/usuarios/acoes-usuario.tsx`, `src/app/(app)/empresa/page.tsx`, `src/app/(app)/empresa/actions.ts`, `src/app/(app)/empresa/form-empresa.tsx`

**Interfaces:**
- Consumes: tudo da Task 3; `exigirUsuario`, `exigirPapel`; `gerarChave`, `chaveValida`; `formatarMoeda`, `dinheiro`, `formatarDataCalendario`, `formatarDataHora`, `formatarDataLonga`, `hojeCalendario`, `mesCalendario`; `formatarNumeroOs`; `formatarTelefone`, `formatarDocumento`; `ROTULO_URGENCIA`, `ROTULO_RECENCIA`; `RespostaSimples` (`src/app/(app)/financeiro/actions.ts`); `RespostaDinheiro` e `concluirOrdemAction` (`src/app/(app)/ordens/[id]/actions.ts`).
- Produces: rotas `/producao`, `/operacao?de=&ate=`, `/clientes/carteira`, `/usuarios`, `/empresa`; `finalizarServicoAction(ordemId, versao, chave): Promise<RespostaDinheiro>`; `criarUsuarioAction`, `alterarUsuarioAction`, `alterarAtivoUsuarioAction`, `trocarSenhaAction`, `salvarEmpresaAction` → `RespostaSimples`.

- [ ] **Step 1: Navegação**

Em `navegacao.ts`: o tipo `icone` ganha `'producao' | 'operacao' | 'usuarios' | 'empresa'` e a lista fica:
```ts
export const NAVEGACAO: ItemNavegacao[] = [
  // Para quem e da operacao, `/` ja e a fila de producao: um item "Fila de trabalho"
  // levando ao mesmo lugar com outro nome so confunde.
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila', papel: 'administracao' },
  { href: '/producao', titulo: 'Produção', icone: 'producao' },
  { href: '/ordens', titulo: 'Ordens', icone: 'ordens' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
  { href: '/operacao', titulo: 'Operação', icone: 'operacao', papel: 'administracao' },
  { href: '/financeiro', titulo: 'Financeiro', icone: 'financeiro', papel: 'administracao' },
  { href: '/plano-de-contas', titulo: 'Plano de contas', icone: 'plano', papel: 'administracao' },
  { href: '/usuarios', titulo: 'Usuários', icone: 'usuarios', papel: 'administracao' },
  { href: '/empresa', titulo: 'Dados da empresa', icone: 'empresa', papel: 'administracao' },
]
```
Em `layout.tsx`: acrescentar `IconTools, IconChartBar, IconUserCog, IconBuildingStore` ao import de `@tabler/icons-react` e a `ICONES`:
```tsx
  producao: <IconTools className="icon" />,
  operacao: <IconChartBar className="icon" />,
  usuarios: <IconUserCog className="icon" />,
  empresa: <IconBuildingStore className="icon" />,
```

- [ ] **Step 2: A tela inicial decide por papel**

Mover o corpo atual de `src/app/(app)/page.tsx` (a fila de trabalho da Fase 4) para `src/app/(app)/fila-trabalho.tsx`, trocando a assinatura para receber a `Fila` pronta e sem `exigirUsuario` (quem chama já autenticou):
```tsx
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'
import type { Fila, OrdemDaFila } from '@/domain/caixa/fila'

function Cliente({ o }: { o: OrdemDaFila }) {
  return <>{o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}{o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}</>
}

export function FilaDeTrabalho({ fila }: { fila: Fila }) {
  return (/* corpo movido: ver o passo abaixo */)
}
```

**Como mover, sem reescrever nada:** abrir `src/app/(app)/page.tsx` da Fase 4 e recortar o bloco que
começa em `return (` e termina no `)` antes do `}` final — é o JSX que vai de `<>` a `</>`, passando
pelo `page-header`, pela busca e pelos dois cards. Colar como corpo do `return` de `FilaDeTrabalho`,
**sem tocar em nenhuma linha**: o componente já recebe `fila` como prop com o mesmo nome que a variável
local tinha, e `Cliente` viaja junto para o arquivo novo. O que fica para trás em `page.tsx` é só a
bifurcação por papel, mostrada logo abaixo. Conferir com `npm run build`: `ƒ /` continua na lista.

E `src/app/(app)/page.tsx` passa a ser só a bifurcação:
```tsx
import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { carregarFila } from '@/infra/caixa/fila'
import { carregarFilaProducao } from '@/infra/producao/fila'
import { FilaDeTrabalho } from './fila-trabalho'
import { FilaDeProducao } from './producao/fila-producao'

export const metadata: Metadata = { title: 'Fila' }

/**
 * Quem e da producao trabalha de pe e olhando de longe (spec, secao 3): a tela dele e a
 * fila de producao, e ela e a primeira coisa que aparece — nao um item de menu que ele
 * precisa lembrar de clicar.
 */
export default async function PaginaInicial() {
  const usuario = await exigirUsuario()
  if (usuario.papel === 'operacao') {
    return <FilaDeProducao fila={await carregarFilaProducao(usuario.empresaId)} />
  }
  return <FilaDeTrabalho fila={await carregarFila(usuario.empresaId)} />
}
```

- [ ] **Step 3: A fila de produção**

`src/app/(app)/producao/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { chaveValida } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { concluirOrdem } from '@/infra/caixa/recebimentos'
import * as ordens from '@/infra/ordens/repositorio'
import type { RespostaDinheiro } from '@/app/(app)/ordens/[id]/actions'

/** "Servico finalizado" e a unica acao da producao, e nao toca em dinheiro (spec, secao 3). */
export async function finalizarServicoAction(ordemId: string, versao: number, chave: string): Promise<RespostaDinheiro> {
  const usuario = await exigirUsuario()
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    const resultado = await concluirOrdem({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave }, ordemId, versao)
    revalidatePath('/')
    revalidatePath('/producao')
    revalidatePath(`/ordens/${ordemId}`)
    return { ok: true, resultado }
  } catch (e) {
    if (e instanceof ordens.ConflitoVersao) return { ok: false, conflito: true }
    if (e instanceof ordens.OrdemNaoEditavel) return { ok: false, erro: 'Esta ordem não está mais em produção.' }
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}
```

`src/app/(app)/producao/botao-finalizado.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finalizarServicoAction } from './actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

/** Alvo de toque grande: a producao usa isto de pe, as vezes de luva (spec, tela 8). */
export function BotaoFinalizado({ ordemId, versao }: { ordemId: string; versao: number }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())

  return (
    <>
      <button type="button" className="btn btn-success w-100 py-3 fs-3" style={{ minHeight: 56 }} disabled={pendente}
        onClick={() => {
          if (pendente) return
          iniciar(async () => {
            const r = await finalizarServicoAction(ordemId, versao, chave.current)
            if (r.ok) { chave.current = gerarChave(); setErro(null); iniciar(() => router.refresh()) }
            else if (r.conflito) { setErro('A ordem mudou. Confira e tente de novo.'); router.refresh() }
            else { chave.current = gerarChave(); setErro(r.erro) }
          })
        }}>
        {pendente ? 'Gravando…' : 'Serviço finalizado'}
      </button>
      {erro ? <div className="text-danger mt-2" role="alert">{erro}</div> : null}
    </>
  )
}
```

`src/app/(app)/producao/fila-producao.tsx`:
```tsx
import Link from 'next/link'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { formatarDataCalendario, formatarDataLonga } from '@/domain/ordem/datas'
import { ROTULO_URGENCIA, type FilaProducao, type OrdemDaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'

const COR_GRUPO = { atrasada: 'text-danger', hoje: 'text-orange', semana: '', sem_data: 'text-secondary' } as const

/** Densidade baixa, tipo grande, botao de 56px: lida de longe, tocada de pe (spec, tela 8). */
export function FilaDeProducao({ fila }: { fila: FilaProducao }) {
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Produção</div>
              <h2 className="page-title fs-1">Fila de produção</h2>
            </div>
            <div className="col-auto fs-3">
              {fila.total === 0 ? null : <>{fila.total} em produção{fila.atrasadas > 0 ? <span className="text-danger ms-2">· {fila.atrasadas} atrasada{fila.atrasadas > 1 ? 's' : ''}</span> : null}</>}
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          {fila.total === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title fs-2">Nada na fila</p>
              <p className="empty-subtitle fs-3 text-secondary">Todo serviço aberto já foi finalizado. Quando o atendimento abrir uma ordem, ela aparece aqui.</p>
            </div></div></div>
          ) : fila.grupos.map((g) => (
            <section key={g.grupo} className="mb-4">
              <h3 className={`fs-2 mb-3 ${COR_GRUPO[g.grupo]}`}>{ROTULO_URGENCIA[g.grupo]} <span className="text-secondary">({g.ordens.length})</span></h3>
              <div className="row g-3">
                {g.ordens.map((o) => <Cartao key={o.id} ordem={o} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

function Cartao({ ordem }: { ordem: OrdemDaProducao }) {
  return (
    <div className="col-12 col-xl-6">
      <div className="card h-100">
        <div className="card-body">
          <div className="d-flex align-items-baseline justify-content-between mb-2">
            <Link href={`/ordens/${ordem.id}`} className="text-reset fs-1 fw-bold numero">{formatarNumeroOs(ordem.numero)}</Link>
            <div className="fs-3 text-end">
              {ordem.prometidaPara
                ? <>Entrega {formatarDataLonga(new Date(ordem.prometidaPara))}<div className="text-secondary fs-4">{formatarDataCalendario(new Date(ordem.prometidaPara))}</div></>
                : <span className="text-secondary">Sem data combinada</span>}
            </div>
          </div>
          <div className="fs-2 mb-2">{ordem.clienteApelido ?? ordem.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}</div>
          <ul className="fs-3 mb-3 ps-3">
            {ordem.itens.length === 0 ? <li className="text-secondary">Sem itens lançados</li> : ordem.itens.map((i, n) => <li key={`${ordem.id}-${n}`}>{i}</li>)}
          </ul>
          <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
        </div>
      </div>
    </div>
  )
}
```

`src/app/(app)/producao/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { carregarFilaProducao } from '@/infra/producao/fila'
import { FilaDeProducao } from './fila-producao'

export const metadata: Metadata = { title: 'Fila de produção' }

export default async function PaginaProducao() {
  const usuario = await exigirUsuario()
  return <FilaDeProducao fila={await carregarFilaProducao(usuario.empresaId)} />
}
```

- [ ] **Step 4: A tela de operação**

`src/app/(app)/operacao/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { carregarOperacao } from '@/infra/operacao/indicadores'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'

export const metadata: Metadata = { title: 'Operação' }

const R$ = (v: string) => formatarMoeda(dinheiro(v))

/** Cada cartao carrega o alvo da spec (secao 11): o numero sozinho nao diz se esta bom. */
function Cartao({ titulo, valor, alvo, testid, cor }: { titulo: string; valor: string; alvo: string; testid: string; cor?: string }) {
  return (
    <div className="col-md-4">
      <div className="card card-sm h-100"><div className="card-body">
        <div className="subheader">{titulo}</div>
        <div className={`h1 mb-0 numero ${cor ?? ''}`} data-testid={testid}>{valor}</div>
        <div className="text-secondary small">{alvo}</div>
      </div></div>
    </div>
  )
}

export default async function PaginaOperacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { de = '', ate = '' } = await searchParams
  let erro: string | null = null
  let dados
  try {
    dados = await carregarOperacao(usuario.empresaId, de && ate ? { de, ate } : undefined)
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    dados = await carregarOperacao(usuario.empresaId)
  }
  const { indicadores: i, anos } = dados

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h2 className="page-title">Operação</h2>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-3"><label className="form-label" htmlFor="de">Aberta de</label><input id="de" type="date" name="de" className="form-control" defaultValue={dados.de ?? ''} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="ate">até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={dados.ate ?? ''} /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            <div className="col-12 text-secondary small">{dados.de ? `Período de ${dados.de} a ${dados.ate}.` : 'Sem período: tudo o que existe no sistema.'}</div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando tudo.</div> : null}
          </div>
        </form>

        <div className="row g-3 mb-3">
          <Cartao titulo="Ordens que ainda não foram finalizadas" valor={`${i.naoFinalizadasPct}%`} alvo="Alvo: abaixo de 5%. No legado, 29,4% em 2025." testid="nao-finalizadas" cor={Number(i.naoFinalizadasPct) > 5 ? 'text-danger' : 'text-success'} />
          <Cartao titulo="Valor parado em ordens não cobradas" valor={R$(i.valorParado)} alvo="Alvo: perto de zero. No legado, R$ 207.795." testid="valor-parado" />
          <Cartao titulo="Ordens com item estruturado" valor={`${i.comItemPct}%`} alvo="Alvo: acima de 90%. No legado, 0%." testid="com-item" cor={Number(i.comItemPct) >= 90 ? 'text-success' : ''} />
          <Cartao titulo="Prazo de entrega" valor={i.prazoMedianoDias === null ? '—' : `${i.prazoMedianoDias} dias`} alvo={i.prazoP90Dias === null ? 'Sem ordem finalizada ainda.' : `9 de 10 saem em até ${i.prazoP90Dias} dias. No legado: 13 e 78.`} testid="prazo" />
          <Cartao titulo="Pessoas usando o sistema" valor={String(i.pessoas)} alvo="Alvo: 2 ou mais. No legado, uma pessoa fazia 84,6% das ordens." testid="pessoas" />
          <Cartao titulo="Recebido" valor={R$(i.recebido)} alvo={`De ${R$(i.faturado)} faturados.`} testid="recebido" />
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Ano a ano</h3></div>
          {anos.length === 0 ? (
            <div className="card-body text-secondary">Nenhuma ordem ainda.</div>
          ) : (
            <>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ano a ano">
                <thead><tr><th>Ano</th><th className="text-end">Ordens</th><th className="text-end">Finalizadas</th><th className="text-end">Faturado</th><th className="text-end">Recebido</th><th className="text-end">Ticket médio</th></tr></thead>
                <tbody>
                  {anos.map((a) => (
                    <tr key={a.ano}>
                      <td className="numero">{a.ano}</td>
                      <td className="numero">{a.ordens}</td>
                      <td className="numero">{a.concluidas}</td>
                      <td className="numero">{R$(a.faturado)}</td>
                      <td className="numero">{R$(a.recebido)}</td>
                      <td className="numero">{R$(a.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {anos.length === 1 ? <div className="card-body text-secondary small">Só existe um ano porque o histórico do sistema antigo ainda não foi importado — isso é a Fase 6.</div> : null}
            </>
          )}
        </div>
      </div></div>
    </>
  )
}
```

- [ ] **Step 5: A carteira de clientes**

`src/app/(app)/clientes/carteira/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { carregarCarteira } from '@/infra/clientes/carteira'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { ROTULO_RECENCIA, type GrupoCarteira } from '@/domain/clientes/carteira'

export const metadata: Metadata = { title: 'Carteira de clientes' }

const R$ = (v: string) => formatarMoeda(dinheiro(v))
const COR_RECENCIA = { ativo: 'bg-success-lt', adormecido: 'bg-warning-lt', perdido: 'bg-secondary-lt' } as const

function Nome({ g }: { g: GrupoCarteira }) {
  return (
    <>
      {g.clienteIds.length === 1 && g.clienteIds[0]
        ? <Link href={`/clientes/${g.clienteIds[0]}`} className="text-reset fw-medium">{g.nome}</Link>
        : <span className="fw-medium">{g.nome}</span>}
      {g.apelido ? <span className="badge bg-primary-lt ms-2">{g.apelido}</span> : null}
      {g.cadastros > 1 ? <div className="small text-secondary">{g.cadastros} cadastros com o mesmo documento</div> : null}
      {g.documento ? <div className="small text-secondary">{formatarDocumento(g.documento)}</div> : null}
    </>
  )
}

export default async function PaginaCarteira() {
  const usuario = await exigirPapel('administracao')
  const carteira = await carregarCarteira(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col"><div className="page-pretitle">Administração</div><h2 className="page-title">Carteira de clientes</h2></div>
          <div className="col-auto"><Link href="/clientes" className="btn">Todos os cadastros</Link></div>
        </div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        {carteira.grupos.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty">
            <p className="empty-title">Nenhum cliente comprou ainda</p>
            <p className="empty-subtitle text-secondary">A carteira nasce das ordens. Venda de balcão não entra: ela não tem nome.</p>
          </div></div></div>
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Faturado</div><div className="h2 mb-0 numero" data-testid="faturado-total">{R$(carteira.faturadoTotal)}</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Ativos</div><div className="h2 mb-0 numero">{carteira.contagem.ativo}</div><div className="text-secondary small">compraram nos últimos 6 meses</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Adormecidos</div><div className="h2 mb-0 numero" data-testid="adormecidos">{carteira.contagem.adormecido}</div><div className="text-secondary small">de 6 a 24 meses — é a lista de reativação</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Perdidos</div><div className="h2 mb-0 numero">{carteira.contagem.perdido}</div><div className="text-secondary small">mais de 2 anos sem comprar</div></div></div></div>
            </div>

            {carteira.paraReativar.length > 0 ? (
              <div className="card mb-3">
                <div className="card-header"><h3 className="card-title">Para reativar</h3><span className="ms-auto text-secondary">{carteira.paraReativar.length} nomes, do maior faturamento para o menor</span></div>
                <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Para reativar">
                  <thead><tr><th>Cliente</th><th>Última ordem</th><th className="text-end">Já faturou</th></tr></thead>
                  <tbody>
                    {carteira.paraReativar.map((g) => (
                      <tr key={g.documento ?? g.clienteIds[0]}>
                        <td><Nome g={g} /></td>
                        <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                        <td className="numero">{R$(g.faturado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            ) : null}

            <div className="card">
              <div className="card-header"><h3 className="card-title">Concentração de receita</h3></div>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Concentração de receita">
                <thead><tr><th>Cliente</th><th>Situação</th><th className="text-end">Ordens</th><th className="text-end">Faturado</th><th className="text-end">Fatia</th></tr></thead>
                <tbody>
                  {carteira.grupos.map((g) => (
                    <tr key={g.documento ?? g.clienteIds[0]}>
                      <td><Nome g={g} /></td>
                      <td><span className={`badge ${COR_RECENCIA[g.recencia]}`}>{ROTULO_RECENCIA[g.recencia]}</span></td>
                      <td className="numero">{g.ordens}</td>
                      <td className="numero">{R$(g.faturado)}</td>
                      <td className="numero">{g.fatiaPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </>
        )}
      </div></div>
    </>
  )
}
```

Em `src/app/(app)/clientes/page.tsx`, no `col-auto` do cabeçalho, antes do botão "Novo cliente":
```tsx
              <Link href="/clientes/carteira" className="btn me-2">Carteira</Link>
```

- [ ] **Step 6: Usuários**

`src/app/(app)/usuarios/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { criarUsuario, alterarUsuario, alterarAtivoUsuario, trocarSenha } from '@/infra/usuarios/repositorio'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

async function executar(corpo: (empresaId: string, usuarioId: string) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await corpo(usuario.empresaId, usuario.id)
    revalidatePath('/usuarios')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function criarUsuarioAction(dados: { nome: string; login: string; papel: string; senha: string }): Promise<RespostaSimples> {
  return executar((empresaId) => criarUsuario(empresaId, dados))
}
export async function alterarUsuarioAction(id: string, dados: { nome: string; papel: string }): Promise<RespostaSimples> {
  return executar((empresaId) => alterarUsuario(empresaId, id, dados))
}
export async function alterarAtivoUsuarioAction(id: string, ativo: boolean): Promise<RespostaSimples> {
  return executar((empresaId, usuarioId) => alterarAtivoUsuario(empresaId, id, ativo, usuarioId))
}
export async function trocarSenhaAction(id: string, senha: string): Promise<RespostaSimples> {
  return executar((empresaId) => trocarSenha(empresaId, id, senha))
}
```

`src/app/(app)/usuarios/form-usuario.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarUsuarioAction } from './actions'

const PAPEIS = [
  ['administracao', 'Administração — vê financeiro, indicadores e configurações'],
  ['operacao', 'Operação — vê a fila de produção e marca serviço finalizado'],
] as const

export function FormUsuario() {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [papel, setPapel] = useState('')
  const [senha, setSenha] = useState('')

  return (
    <form className="row g-2 align-items-end" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await criarUsuarioAction({ nome, login, papel, senha })
        if (r.ok) { setNome(''); setLogin(''); setPapel(''); setSenha(''); setErro(null); iniciar(() => router.refresh()) }
        else setErro(r.erro)
      })
    }}>
      <div className="col-md-3"><label className="form-label" htmlFor="nomeUsuario">Nome</label><input id="nomeUsuario" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pedro Souza" /></div>
      <div className="col-md-2"><label className="form-label" htmlFor="loginUsuario">Login</label><input id="loginUsuario" className="form-control" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="pedro" autoComplete="off" /></div>
      <div className="col-md-3">
        <label className="form-label" htmlFor="papelUsuario">Papel</label>
        <select id="papelUsuario" className="form-select" value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="">Escolha o papel</option>
          {PAPEIS.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
        </select>
      </div>
      <div className="col-md-2"><label className="form-label" htmlFor="senhaUsuario">Senha inicial</label><input id="senhaUsuario" type="password" className="form-control" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></div>
      <div className="col-md-2"><button type="submit" className="btn btn-primary w-100" disabled={pendente}>{pendente ? 'Criando…' : 'Criar usuário'}</button></div>
      <div className="col-12 form-hint">A pessoa entra com essa senha e troca depois. Mínimo de 8 caracteres.</div>
      {erro ? <div className="col-12 text-danger small" role="alert">{erro}</div> : null}
    </form>
  )
}
```

`src/app/(app)/usuarios/acoes-usuario.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alterarAtivoUsuarioAction, trocarSenhaAction, alterarUsuarioAction } from './actions'

interface Props {
  id: string
  nome: string
  papel: string
  ativo: boolean
  euMesmo: boolean
}

export function AcoesUsuario(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<'nenhum' | 'senha' | 'editar'>('nenhum')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState(p.nome)
  const [papel, setPapel] = useState(p.papel)

  function rodar(fn: () => ReturnType<typeof trocarSenhaAction>) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) { setErro(null); setAberto('nenhum'); setSenha(''); iniciar(() => router.refresh()) }
      else setErro(r.erro)
    })
  }

  if (aberto === 'senha') {
    return (
      <form className="d-flex gap-2 align-items-center" onSubmit={(e) => { e.preventDefault(); rodar(() => trocarSenhaAction(p.id, senha)) }}>
        <input type="password" className="form-control form-control-sm" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label={`Nova senha de ${p.nome}`} autoComplete="new-password" autoFocus />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pendente}>Gravar senha</button>
        <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto('nenhum')}>Voltar</button>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </form>
    )
  }

  if (aberto === 'editar') {
    return (
      <form className="d-flex gap-2 align-items-center" onSubmit={(e) => { e.preventDefault(); rodar(() => alterarUsuarioAction(p.id, { nome, papel })) }}>
        <input className="form-control form-control-sm" value={nome} onChange={(e) => setNome(e.target.value)} aria-label={`Nome de ${p.nome}`} autoFocus />
        <select className="form-select form-select-sm" value={papel} onChange={(e) => setPapel(e.target.value)} aria-label={`Papel de ${p.nome}`}>
          <option value="administracao">Administração</option>
          <option value="operacao">Operação</option>
        </select>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pendente}>Gravar</button>
        <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto('nenhum')}>Voltar</button>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </form>
    )
  }

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className="btn btn-sm" onClick={() => setAberto('editar')}>Editar</button>
      <button type="button" className="btn btn-sm" onClick={() => setAberto('senha')}>Trocar senha</button>
      {p.euMesmo ? null : (
        <button type="button" className="btn btn-sm btn-ghost-secondary" disabled={pendente}
          onClick={() => rodar(() => alterarAtivoUsuarioAction(p.id, !p.ativo))}>
          {p.ativo ? 'Desativar' : 'Reativar'}
        </button>
      )}
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
```

`src/app/(app)/usuarios/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarUsuarios } from '@/infra/usuarios/repositorio'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { FormUsuario } from './form-usuario'
import { AcoesUsuario } from './acoes-usuario'

export const metadata: Metadata = { title: 'Usuários' }

const ROTULO_PAPEL = { administracao: 'Administração', operacao: 'Operação' } as const

export default async function PaginaUsuarios() {
  const usuario = await exigirPapel('administracao')
  const usuarios = await listarUsuarios(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h2 className="page-title">Usuários</h2>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <div className="card mb-3"><div className="card-body"><FormUsuario /></div></div>
        <div className="card"><div className="table-responsive">
          <table className="table table-vcenter card-table" aria-label="Usuários">
            <thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Desde</th><th className="w-1"></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'text-secondary'}>
                  <td>{u.nome}{u.ativo ? null : <span className="badge bg-secondary-lt ms-2">desativado</span>}{u.id === usuario.id ? <span className="badge bg-primary-lt ms-2">você</span> : null}</td>
                  <td>{u.login}</td>
                  <td>{ROTULO_PAPEL[u.papel]}</td>
                  <td className="text-secondary">{formatarDataCalendario(new Date(u.criadoEm))}</td>
                  <td><AcoesUsuario id={u.id} nome={u.nome} papel={u.papel} ativo={u.ativo} euMesmo={u.id === usuario.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
        <p className="text-secondary small mt-2">Usuário nunca é apagado: ele é o responsável de ordens antigas. Desativar tira o acesso e preserva a história.</p>
      </div></div>
    </>
  )
}
```

- [ ] **Step 7: Dados da empresa**

`src/app/(app)/empresa/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { salvarEmpresa } from '@/infra/empresa/repositorio'
import type { EmpresaTela } from '@/infra/empresa/repositorio'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

export async function salvarEmpresaAction(dados: Record<keyof EmpresaTela, string>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await salvarEmpresa(usuario.empresaId, dados)
    revalidatePath('/empresa')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}
```

`src/app/(app)/empresa/form-empresa.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import type { EmpresaTela } from '@/infra/empresa/repositorio'
import { salvarEmpresaAction } from './actions'

type Campos = Record<keyof EmpresaTela, string>

function paraFormulario(e: EmpresaTela): Campos {
  return {
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia ?? '',
    cnpj: e.cnpj ? formatarDocumento(e.cnpj) : '',
    endereco: e.endereco ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    uf: e.uf ?? '',
    cep: e.cep ?? '',
    telefone1: e.telefone1 ? formatarTelefone(e.telefone1) : '',
    telefone2: e.telefone2 ? formatarTelefone(e.telefone2) : '',
  }
}

export function FormEmpresa({ empresa }: { empresa: EmpresaTela }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<'nenhuma' | 'salvo' | string>('nenhuma')
  const [campos, setCampos] = useState<Campos>(paraFormulario(empresa))
  const em = (k: keyof Campos) => ({ value: campos[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [k]: e.target.value })) })

  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await salvarEmpresaAction(campos)
        setResposta(r.ok ? 'salvo' : r.erro)
        if (r.ok) iniciar(() => router.refresh())
      })
    }}>
      <div className="card-body row g-3">
        <div className="col-md-6"><label className="form-label" htmlFor="razaoSocial">Razão social</label><input id="razaoSocial" className="form-control" {...em('razaoSocial')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="nomeFantasia">Nome fantasia</label><input id="nomeFantasia" className="form-control" {...em('nomeFantasia')} placeholder="DruSign" /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="cnpj">CNPJ</label><input id="cnpj" className="form-control numero" inputMode="numeric" {...em('cnpj')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="telefone1">Telefone</label><input id="telefone1" className="form-control numero" inputMode="tel" {...em('telefone1')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="telefone2">Outro telefone</label><input id="telefone2" className="form-control numero" inputMode="tel" {...em('telefone2')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="endereco">Endereço</label><input id="endereco" className="form-control" {...em('endereco')} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="bairro">Bairro</label><input id="bairro" className="form-control" {...em('bairro')} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="cep">CEP</label><input id="cep" className="form-control numero" inputMode="numeric" {...em('cep')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="cidade">Cidade</label><input id="cidade" className="form-control" {...em('cidade')} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="uf">UF</label><input id="uf" className="form-control" maxLength={2} {...em('uf')} /></div>
        <div className="col-12 form-hint">É o que sai no cabeçalho do impresso da ordem. O que ficar em branco simplesmente não aparece lá.</div>
      </div>
      <div className="card-footer d-flex align-items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar'}</button>
        {resposta === 'salvo' ? <span className="text-success small" role="status">Salvo.</span> : null}
        {resposta !== 'salvo' && resposta !== 'nenhuma' ? <span className="text-danger small" role="alert">{resposta}</span> : null}
      </div>
    </form>
  )
}
```

`src/app/(app)/empresa/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterEmpresa } from '@/infra/empresa/repositorio'
import { FormEmpresa } from './form-empresa'

export const metadata: Metadata = { title: 'Dados da empresa' }

export default async function PaginaEmpresa() {
  const usuario = await exigirPapel('administracao')
  const empresa = await obterEmpresa(usuario.empresaId)
  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h2 className="page-title">Dados da empresa</h2>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <FormEmpresa empresa={empresa} />
        <p className="text-secondary small mt-2">
          O logo entra junto com o anexo de arte, na próxima fase. Para conferir como ficou o cabeçalho,
          abra qualquer ordem e clique em <Link href="/ordens">Imprimir</Link>.
        </p>
      </div></div>
    </>
  )
}
```

- [ ] **Step 8: Typecheck, testes, build e fumaça**

Run: `npm run typecheck` → sem erros. Run: `npm test` → PASS (`use-client` continua verde). Run: `npm run build` → rotas `ƒ /producao`, `ƒ /operacao`, `ƒ /clientes/carteira`, `ƒ /usuarios`, `ƒ /empresa`. Fumaça com `next start`: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/usuarios` → `307 …/entrar?proximo=%2Fusuarios`.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/"
git commit -m "feat: fila de producao lida de longe, tela de operacao, carteira de clientes, usuarios e dados da empresa"
```

---

### Task 5: Ponta a ponta — a produção finaliza, a administração mede

**Files:**
- Create: `e2e/producao.spec.ts`, `e2e/administracao.spec.ts`
- Modify: `e2e/materiais.spec.ts` e `e2e/dinheiro.spec.ts` (o que a operação vê ao ser redirecionada para `/`)

- [ ] **Step 1: Ajustar os dois testes que assumem a fila de trabalho para a operação**

Em `e2e/materiais.spec.ts`, no teste "operacao nao ve nem abre Materiais e preços", e em `e2e/dinheiro.spec.ts`, no teste "operacao nao ve nem abre o Financeiro`, a última linha muda:
```ts
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
```
(A partir desta fase, `/` mostra a fila de produção para quem é da operação — a URL continua `/`, só o conteúdo muda.)

- [ ] **Step 2: O teste da produção**

`e2e/producao.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test'
import { entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

async function ordemPara(page: Page, linha: string, prometida: string | null): Promise<string> {
  await page.goto('/ordens/nova')
  await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const campo = page.getByLabel('Lançar item ou acréscimo')
  await campo.fill(linha)
  await campo.press('Enter')
  await expect(campo).toHaveValue('', { timeout: 30_000 })
  if (prometida !== null) {
    await page.getByLabel('Entrega prometida').fill(prometida)
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
  }
  return (await page.getByRole('heading', { name: /nº (\d{6})/ }).textContent())?.match(/(\d{6})/)?.[1] ?? ''
}

test.describe('Produção', () => {
  test('a fila mostra o que produzir por urgencia, sem valor, e o botao finaliza o servico', async ({ page }) => {
    await entrar(page)
    const atrasada = await ordemPara(page, '2 PLACA ACM ATRASADA 100,00', '2020-01-01')
    const semData = await ordemPara(page, '1 BANNER SEM DATA 80,00', null)

    await page.goto('/producao')
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Atrasadas/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Sem data combinada/ })).toBeVisible()

    // O que a producao precisa ler esta na tela; o que ela nao pode ver, nao esta.
    await expect(page.getByText('PLACA ACM ATRASADA')).toBeVisible()
    await expect(page.getByText('R$ 100,00')).toHaveCount(0)
    await expect(page.getByText('R$')).toHaveCount(0)

    const cartao = page.locator('.card').filter({ hasText: atrasada })
    await cartao.getByRole('button', { name: 'Serviço finalizado' }).click()
    await expect(page.locator('.card').filter({ hasText: atrasada })).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('.card').filter({ hasText: semData })).toBeVisible()

    // Finalizar na producao move o eixo de producao e nao encosta no de pagamento.
    await page.goto(`/ordens?q=${atrasada}`)
    const linha = page.getByRole('row').filter({ hasText: atrasada })
    await expect(linha).toContainText('Serviço finalizado')
    await expect(linha).toContainText('Não pago')
  })

  test('operacao entra e cai direto na fila de producao, sem menu de administracao', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Produção' })).toBeVisible()
    for (const escondido of ['Financeiro', 'Operação', 'Usuários', 'Dados da empresa', 'Materiais e preços']) {
      await expect(page.getByRole('link', { name: escondido })).toHaveCount(0)
    }
    await page.goto('/usuarios')
    await expect(page).toHaveURL(/\/$/)
  })
})
```

- [ ] **Step 3: O teste da administração**

`e2e/administracao.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { entrar } from './apoio'

test.describe('Administração', () => {
  test('operacao mostra os indicadores com o alvo da spec e o ano a ano', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Operação' }).click()
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByTestId('nao-finalizadas')).toContainText('%')
    await expect(page.getByText('Alvo: abaixo de 5%. No legado, 29,4% em 2025.')).toBeVisible()
    await expect(page.getByTestId('valor-parado')).toContainText('R$')
    await expect(page.getByTestId('pessoas')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Ano a ano' }).getByRole('row').filter({ hasText: '2026' })).toBeVisible()

    await page.getByLabel('Aberta de').fill('2020-01-01')
    await page.getByLabel('até').fill('2020-12-31')
    await page.getByRole('button', { name: 'Mostrar' }).click()
    await expect(page.getByText('Período de 2020-01-01 a 2020-12-31.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Nenhuma ordem ainda.')).toBeVisible()
  })

  test('carteira agrupa os cadastros do mesmo CNPJ e separa a lista de reativacao', async ({ page }) => {
    await entrar(page)
    await page.goto('/clientes/carteira')
    await expect(page.getByRole('heading', { name: 'Carteira de clientes' })).toBeVisible()
    await expect(page.getByTestId('faturado-total')).toContainText('R$')
    await expect(page.getByRole('table', { name: 'Concentração de receita' })).toBeVisible()
    await expect(page.getByText('de 6 a 24 meses — é a lista de reativação')).toBeVisible()
  })

  test('usuarios: cria, troca papel, desativa, e nao deixa se desativar', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Usuários' }).click()
    const login = `teste${Date.now()}`

    await page.getByLabel('Nome').fill('Fulano de Teste')
    await page.getByLabel('Login').fill(login)
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'escolha o papel' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('Papel').selectOption('operacao')
    await page.getByLabel('Senha inicial').fill('curta')
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 8 caracteres' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('Senha inicial').fill('senha-boa-123')
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    const linha = page.getByRole('row').filter({ hasText: login })
    await expect(linha).toBeVisible({ timeout: 30_000 })
    await expect(linha).toContainText('Operação')

    await linha.getByRole('button', { name: 'Editar' }).click()
    await linha.getByLabel(/^Papel de/).selectOption('administracao')
    await linha.getByRole('button', { name: 'Gravar', exact: true }).click()
    await expect(linha).toContainText('Administração', { timeout: 30_000 })

    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(linha).toContainText('desativado', { timeout: 30_000 })

    // A propria linha nao tem botao de desativar: ninguem se tranca do lado de fora.
    const minhaLinha = page.getByRole('row').filter({ hasText: 'você' })
    await expect(minhaLinha.getByRole('button', { name: 'Desativar' })).toHaveCount(0)
  })

  test('dados da empresa saem no cabecalho do impresso', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Dados da empresa' }).click()
    await page.getByLabel('Nome fantasia').fill('DruSign')
    await page.getByLabel('CNPJ').fill('11.222.333/0001-81')
    await page.getByLabel('Telefone', { exact: true }).fill('(38) 3676-1234')
    await page.getByLabel('Endereço').fill('Rua Rio Preto, 100')
    await page.getByLabel('Cidade').fill('Unaí')
    await page.getByLabel('UF').fill('MG')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Salvo.' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('CNPJ').fill('123')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'CNPJ inválido' })).toBeVisible({ timeout: 30_000 })

    await page.goto('/ordens/nova')
    await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
    const id = page.url().split('/').pop()
    await page.goto(`/ordens/${id}/impresso`)
    await expect(page.getByText('DruSign').first()).toBeVisible()
    await expect(page.getByText('11.222.333/0001-81')).toBeVisible()
    await expect(page.getByText('Rua Rio Preto, 100')).toBeVisible()
    await expect(page.getByText('Unaí/MG')).toBeVisible()
    await expect(page.getByText('(38) 3676-1234')).toBeVisible()
  })
})
```

- [ ] **Step 4: Rodar**

Antes: `npm run typecheck`; `npm run db:local:ls` com `drusign` e `drusign-test` de pé; `DATABASE_POOL_MAX=2` no `.env.local`.

Run: `npm run e2e`
Expected: **30 passed** (24 anteriores + 2 de produção + 4 de administração). Se aparecer `Connection terminated unexpectedly`, reiniciar o daemon (`npx prisma dev stop drusign` e `npm run db:local`) — o `gracefulShutdown` do Playwright já evita a sangria, mas um `next dev` morto à força fora da suíte ainda derruba o teto.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: fila de producao, indicadores, carteira, usuarios e dados da empresa no impresso ponta a ponta"
```

---

### Task 6: Verificação final da fase

- [ ] **Step 1: Tudo verde**

Run: `npm run check` → typecheck, unitários e integração (**68**) verdes. Run: `npm run build` → verde. Run: `npm run e2e` → 30 passed.

- [ ] **Step 2: Marcar o plano e a memória**

Marcar todos os passos e os critérios de conclusão abaixo; anotar no plano os desvios que a execução exigiu (mesmo formato das notas da Fase 4). Atualizar `drusign-sistema-novo.md`: Fase 5 concluída, commit, contagens.

```bash
git add docs/superpowers/plans/2026-08-29-fase5-producao-administracao.md
git commit -m "docs: plano da Fase 5 executado"
```

---

## Critério de conclusão da Fase 5

Verificação da spec (seção 13): *"Fila de produção, dashboard de operação, visão administrativa de clientes, configurações."*

- [ ] `producao.int.test.ts` verde: a fila traz só ordens abertas, agrupadas por urgência, com os itens e a versão que serve para concluir; orçamento, concluída e cancelada ficam de fora
- [ ] a fila de produção não mostra nenhum valor — provado no e2e (`R$` não aparece na tela)
- [ ] quem é da operação entra e cai na fila de produção, sem nenhum item de menu de administração
- [ ] a tela de operação mostra os cinco indicadores da spec (seção 11) com o alvo de cada um ao lado, e o ano a ano
- [ ] a carteira agrupa os cadastros do mesmo documento (a Prefeitura de Unaí é um cliente, não 18) e separa a faixa adormecida como lista de reativação
- [ ] `usuarios/repositorio.int.test.ts` verde: cria com Argon2, login único, desativa sem apagar, e não deixa a última administração ativa se desativar nem alguém se desativar
- [ ] os dados da empresa saem no cabeçalho do impresso — provado no e2e
- [ ] `npm run check` e `npm run build` verdes

Feito isso, a Fase 6 (importação das 18.443 ordens legadas como arquivo, anexo de arte no R2, relatório para o contador, estados vazios refinados) ganha seu próprio plano — e é a última.

## Backlog de refinamento (depois que a Odete e a produção usarem)

Logo da empresa no impresso (junto com o R2, Fase 6); som ou destaque quando entra ordem nova na fila de produção; ordenar a fila de produção por quem vai produzir; indicador de retrabalho; exportar a carteira em CSV; histórico de quem alterou o quê (`LogAuditoria`); o próprio usuário trocar a senha sem passar pela administração; segundo fator; sessão expirando por inatividade.
