# Fase 2 — Clientes, materiais e a importação dos 3.219 clientes do legado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastro de clientes com busca por nome, apelido ou telefone e aviso de duplicidade; catálogo de materiais com regra de cobrança; e a importação dos 3.219 clientes do `CLIENTES.DBF` com a normalização de telefone que o legado nunca teve.

**Architecture:** As regras puras (normalizar telefone, normalizar documento, interpretar e formatar moeda) entram em `src/domain/` com teste unitário. O acesso a dados fica em repositórios em `src/infra/clientes/` e `src/infra/materiais/`, testados contra o banco real. A importação é um leitor de DBF em TypeScript (`src/infra/importacao/`) mais um conversor de registro, e roda por um script `tsx`. As telas em `src/app/(app)/` só montam formulários e chamam repositórios via Server Actions.

**Tech Stack:** o mesmo da 1B. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 4, 7 — telas 4, 5 e 13 —, 10 e 13)

## Global Constraints

- Dinheiro **sempre** em `Decimal` (decimal.js) no domínio e `numeric(12,4)` no banco. `Material.preco` é o primeiro campo monetário persistido: entra e sai pelos helpers `paraBanco`/`paraDominio` da 1B.
- Nenhum arquivo em `src/domain/` importa `next`, `react`, `@prisma/client`, `@/generated`, `@/infra` ou toca em I/O.
- **Nada de `DELETE`** em dado de negócio. Cliente **arquiva** (`arquivado_em`). A única exceção nova é a linha de `telefone_cliente` ao editar o cliente: telefone é atributo do cadastro, não documento — trocar a lista é editar um campo. O original de cada telefone importado nunca é sobrescrito.
- Toda tabela carrega `empresa_id`, inclusive `telefone_cliente`.
- Encoding do legado: **CP1252** (confirmado nesta base: zero artefatos; CP850 corrompe `ASSOCIAÇÃO`).
- Origem dos dados: `C:\legacy-drusign-dados\OSGRAFICA4.5A\DADOS\CLIENTES.DBF`. Se a pasta não existir, parar.
- Dois papéis: a tela de materiais é só de `administracao`.
- TypeScript 7 e as regras da 1B continuam valendo. Arquivo com barra dupla (`\\`) nunca sai de heredoc.

## O que este plano decide

Medido na base real em 28/08/2026 (script Python de contagem, mesma regra do domínio):

| Fato | Número | Consequência |
|---|---|---|
| Registros em `CLIENTES.DBF` | 3.219, dos quais **1.978** com a flag DBF `*` | os 1.978 entram como `arquivado_em` preenchido |
| Apelido | está no campo `EST` (209 preenchidos; `BRETAS` = COD 13, `FACTU` = COD 26) | `EST` → `apelido` |
| Telefones | 13 colunas com máscara `(99)9999-9999`; 3.077 números com ≥ 8 dígitos; 63 entradas com 1–6 dígitos (lixo); 837 clientes sem nenhum | regra abaixo; lixo descartado; original preservado |
| Nono dígito | **1.975** números precisam dele (spec estimou 1.960); **0** celulares sobram com 10 dígitos | `inferido = true` neles |
| `COD` | **2 duplicatas** | `codigo_legado` é índice, não único; idempotência é "já importado → não repete" |
| `NOM` vazio | 8 registros | nome vira `(sem nome no legado, cod N)` |
| Documento | 1.081 com CPF (11) ou CNPJ (14) válidos em `CGC`/`CPF` | só dígitos; sem validar dígito verificador — o CNPJ da Prefeitura em 18 cadastros é dado real |

**Regra de normalização de telefone** (spec, seção 10, com o que a base exigiu):
- Só dígitos. 10 dígitos = DDD + 8: se o número começa em 6/7/8/9 é celular e ganha o `9` (`inferido`); se começa em 2/3/4/5 é fixo e fica com 10 (fixo tem 10 dígitos, é discável).
- 8 dígitos = sem DDD: assume `38` (Unaí) e segue a regra acima, `inferido`.
- 11 dígitos com `9` na terceira posição: já é celular completo.
- Qualquer outra coisa: `normalizado = null` (não discável), original guardado.
- **Interpretação da verificação da spec** *"nenhum telefone com 10 dígitos sobrou"*: nenhum **celular** com 10 dígitos. Fixo com 10 dígitos é correto.

**Telas desta fase** (spec, seção 7): 5. Lista de clientes (busca por nome, apelido ou telefone; aviso de duplicidade por telefone ao cadastrar), 4. Ficha do cliente (contato; o histórico de ordens é da Fase 3/6 e aparece como estado vazio honesto), 13. Materiais e preços (só administração). Cadastro e edição de cliente fazem parte das telas 4 e 5.

---

### Task 1: Domínio — telefone, documento e moeda

**Files:**
- Create: `src/domain/clientes/telefone.ts`, `src/domain/clientes/documento.ts`, `src/domain/precificacao/moeda.ts`
- Test: `src/domain/clientes/telefone.test.ts`, `src/domain/clientes/documento.test.ts`, `src/domain/precificacao/moeda.test.ts`

**Interfaces:**
- Consumes: `dinheiro`, `Decimal` da 1A
- Produces:
  - `normalizarTelefone(original: string): { normalizado: string | null; inferido: boolean }`
  - `formatarTelefone(normalizado: string): string` — `(38) 99968-1168` / `(38) 3676-6222`
  - `normalizarDocumento(original: string): { digitos: string; tipo: 'cpf' | 'cnpj' } | null`
  - `formatarDocumento(digitos: string): string`
  - `interpretarMoeda(texto: string): Decimal | null` — aceita `281`, `281,00`, `1.234,56`, `R$ 1.234,56`, `1234.56`
  - `formatarMoeda(valor: Decimal): string` — `R$ 1.234,56`

- [x] **Step 1: Testes do telefone**

`src/domain/clientes/telefone.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizarTelefone, formatarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  it.each([
    ['(38)9968-1168', '38999681168', true],
    ['(38)9111-4491', '38991114491', true],
    ['(38)3676-6222', '3836766222', false],
    ['38999681168', '38999681168', false],
    ['(38) 99968-1168', '38999681168', false],
    ['9968-1168', '38999681168', true],
    ['3676-6222', '3836766222', true],
  ])('%s vira %s (inferido: %s)', (original, normalizado, inferido) => {
    expect(normalizarTelefone(original)).toEqual({ normalizado, inferido })
  })

  it.each([
    ['(  )    -'],
    [''],
    ['123'],
    ['(38)1234-5678'],
    ['(38)0000-0000'],
    ['(08)9968-1168'],
    ['03899681168'],
  ])('%s nao e discavel', (original) => {
    expect(normalizarTelefone(original)).toEqual({ normalizado: null, inferido: false })
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('38999681168')).toBe('(38) 99968-1168')
    expect(formatarTelefone('3836766222')).toBe('(38) 3676-6222')
  })

  it('devolve o que recebeu quando nao reconhece', () => {
    expect(formatarTelefone('123')).toBe('123')
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npm test -- telefone`
Expected: FAIL — `Cannot find module './telefone'`

- [x] **Step 3: Criar `src/domain/clientes/telefone.ts`**

```ts
export interface TelefoneNormalizado {
  /** So digitos, discavel: 11 para celular (DDD + 9 + 8), 10 para fixo (DDD + 8). null quando nao da para discar. */
  normalizado: string | null
  /** true quando o sistema completou o que faltava: o nono digito, ou o DDD de Unai. */
  inferido: boolean
}

/** A empresa e de Unai/MG: numero sem DDD e daqui. */
const DDD_PADRAO = '38'

const NAO_DISCAVEL: TelefoneNormalizado = { normalizado: null, inferido: false }

/**
 * Regra da spec (secao 10), medida na base: a mascara do legado e (99)9999-9999 e nao cabe o
 * nono digito. DDD + 8 digitos comecando em 6/7/8/9 e celular e ganha o 9; 2/3/4/5 e fixo.
 */
export function normalizarTelefone(original: string): TelefoneNormalizado {
  const digitos = original.replace(/\D/g, '')
  if (digitos.length === 8) return completar(DDD_PADRAO + digitos, true)
  if (digitos.length === 10) return completar(digitos, false)
  if (digitos.length === 11) {
    return dddValido(digitos) && digitos[2] === '9' && digitos[3] !== '0'
      ? { normalizado: digitos, inferido: false }
      : NAO_DISCAVEL
  }
  return NAO_DISCAVEL
}

function dddValido(digitos: string): boolean {
  return /^[1-9][0-9]/.test(digitos)
}

function completar(dez: string, dddInferido: boolean): TelefoneNormalizado {
  if (!dddValido(dez)) return NAO_DISCAVEL
  const ddd = dez.slice(0, 2)
  const numero = dez.slice(2)
  const primeiro = numero[0] ?? ''
  if (primeiro !== '' && '6789'.includes(primeiro)) {
    return { normalizado: `${ddd}9${numero}`, inferido: true }
  }
  if (primeiro !== '' && '2345'.includes(primeiro)) {
    return { normalizado: dez, inferido: dddInferido }
  }
  return NAO_DISCAVEL
}

/** (38) 99968-1168 para celular, (38) 3676-6222 para fixo. Devolve a entrada quando nao reconhece. */
export function formatarTelefone(normalizado: string): string {
  if (normalizado.length === 11) {
    return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 7)}-${normalizado.slice(7)}`
  }
  if (normalizado.length === 10) {
    return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 6)}-${normalizado.slice(6)}`
  }
  return normalizado
}
```

- [x] **Step 4: Rodar e ver passar**

Run: `npm test -- telefone`
Expected: PASS — 16 passed

- [x] **Step 5: Testes do documento**

`src/domain/clientes/documento.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizarDocumento, formatarDocumento } from './documento'

describe('normalizarDocumento', () => {
  it('reconhece CPF e CNPJ so pelos digitos', () => {
    expect(normalizarDocumento('017.547.961-50')).toEqual({ digitos: '01754796150', tipo: 'cpf' })
    expect(normalizarDocumento('00150991000199')).toEqual({ digitos: '00150991000199', tipo: 'cnpj' })
    expect(normalizarDocumento('00.150.991/0001-99')).toEqual({ digitos: '00150991000199', tipo: 'cnpj' })
  })

  it('rejeita o que nao tem 11 nem 14 digitos', () => {
    expect(normalizarDocumento('')).toBeNull()
    expect(normalizarDocumento('123')).toBeNull()
    expect(normalizarDocumento('39346861028686')).not.toBeNull()
  })
})

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('01754796150')).toBe('017.547.961-50')
    expect(formatarDocumento('00150991000199')).toBe('00.150.991/0001-99')
    expect(formatarDocumento('123')).toBe('123')
  })
})
```

- [x] **Step 6: Rodar e ver falhar, criar, ver passar**

Run: `npm test -- documento` → FAIL — `Cannot find module './documento'`

`src/domain/clientes/documento.ts`:
```ts
export type TipoDocumento = 'cpf' | 'cnpj'

export interface DocumentoNormalizado {
  digitos: string
  tipo: TipoDocumento
}

/**
 * So digitos: 11 e CPF, 14 e CNPJ, o resto nao e documento. Sem digito verificador de
 * proposito: o legado tem a Prefeitura de Unai em 18 cadastros com o mesmo CNPJ, e isso e
 * a operacao real (cada secretaria tem empenho separado). Agrupar por documento no relatorio
 * e o que faz ela aparecer como o maior cliente da empresa.
 */
export function normalizarDocumento(original: string): DocumentoNormalizado | null {
  const digitos = original.replace(/\D/g, '')
  if (digitos.length === 11) return { digitos, tipo: 'cpf' }
  if (digitos.length === 14) return { digitos, tipo: 'cnpj' }
  return null
}

export function formatarDocumento(digitos: string): string {
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
  }
  if (digitos.length === 14) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`
  }
  return digitos
}
```

Run: `npm test -- documento` → PASS — 3 passed

- [x] **Step 7: Testes da moeda**

`src/domain/precificacao/moeda.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dinheiro } from './dinheiro'
import { interpretarMoeda, formatarMoeda } from './moeda'

describe('interpretarMoeda', () => {
  it.each([
    ['281', '281'],
    ['281,00', '281'],
    ['1.234,56', '1234.56'],
    ['R$ 1.234,56', '1234.56'],
    ['1234.56', '1234.56'],
    ['0,5', '0.5'],
    [' 83 ', '83'],
  ])('%s vira %s', (texto, esperado) => {
    expect(interpretarMoeda(texto)?.toString()).toBe(esperado)
  })

  it.each([[''], ['abc'], ['-10'], ['1,2,3'], ['R$']])('%s nao e valor', (texto) => {
    expect(interpretarMoeda(texto)).toBeNull()
  })
})

describe('formatarMoeda', () => {
  it.each([
    ['0', 'R$ 0,00'],
    ['281', 'R$ 281,00'],
    ['1234.5', 'R$ 1.234,50'],
    ['1481', 'R$ 1.481,00'],
    ['207795.4', 'R$ 207.795,40'],
    ['0.0001', 'R$ 0,00'],
  ])('%s vira %s', (valor, esperado) => {
    expect(formatarMoeda(dinheiro(valor))).toBe(esperado)
  })
})
```

- [x] **Step 8: Rodar e ver falhar, criar, ver passar**

Run: `npm test -- moeda` → FAIL — `Cannot find module './moeda'`

`src/domain/precificacao/moeda.ts`:
```ts
import { dinheiro, arredondarCentavos, type Decimal } from './dinheiro'

/**
 * Le o que o operador digita: "281", "281,00", "1.234,56", "R$ 1.234,56", "1234.56".
 * Virgula e separador decimal quando existe; ponto e milhar quando ha virgula, decimal quando nao ha.
 * Negativo, vazio ou ambiguo devolve null.
 */
export function interpretarMoeda(texto: string): Decimal | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (limpo === '' || !/^[0-9.,]+$/.test(limpo)) return null

  const virgulas = (limpo.match(/,/g) ?? []).length
  if (virgulas > 1) return null

  let normalizado: string
  if (virgulas === 1) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    const pontos = (limpo.match(/\./g) ?? []).length
    normalizado = pontos > 1 ? limpo.replace(/\./g, '') : limpo
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null
  return dinheiro(normalizado)
}

/** R$ 1.234,56 — a partir do Decimal, sem passar por ponto flutuante. */
export function formatarMoeda(valor: Decimal): string {
  const texto = arredondarCentavos(valor).toFixed(2)
  const [inteiro = '0', centavos = '00'] = texto.split('.')
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${comMilhar},${centavos}`
}
```

Run: `npm test -- moeda` → PASS — 18 passed

- [x] **Step 9: Verificação e commit**

Run: `npm test` → PASS (a trava de pureza continua verde: os módulos novos só importam `./dinheiro`).
Run: `npm run typecheck` → sem erros.

```bash
git add src/domain/clientes/ src/domain/precificacao/moeda.ts src/domain/precificacao/moeda.test.ts
git commit -m "feat: normalizacao de telefone e documento, e leitura/formatacao de moeda"
```

---

### Task 2: Schema — Cliente, TelefoneCliente e Material

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_clientes_materiais/`
- Modify: `src/infra/auth/usuario-atual.ts` (ganha `exigirPapel`)

**Interfaces:**
- Produces: modelos `Cliente`, `TelefoneCliente`, `Material`, enum `UnidadeCobranca { m2, unidade, metro_linear }`; `exigirPapel(papel: PapelUsuario): Promise<UsuarioSessao>`

- [x] **Step 1: Acrescentar ao `prisma/schema.prisma`**

Em `model Empresa`, junto de `usuarios Usuario[]`:
```prisma
  clientes  Cliente[]
  materiais Material[]
```

No fim do arquivo:
```prisma
/// Tres formas de cobrar, e uma ordem mistura as tres (spec, secao 5).
enum UnidadeCobranca {
  m2
  unidade
  metro_linear

  @@map("unidade_cobranca")
}

/// Cliente e plano: cadastros da mesma entidade sao agrupados por documento nos relatorios.
model Cliente {
  id           String    @id @default(uuid(7)) @db.Uuid
  empresaId    String    @map("empresa_id") @db.Uuid
  empresa      Empresa   @relation(fields: [empresaId], references: [id])
  /// COD do CLIENTES.DBF, para ligar as ordens legadas na Fase 6. Nao e unico: o legado repetiu 2.
  codigoLegado Int?      @map("codigo_legado")
  nome         String    @db.VarChar(120)
  /// Como a loja conhece o cliente: "Bretas", "FACTU". A busca sempre olha aqui.
  apelido      String?   @db.VarChar(60)
  /// So digitos: 11 (CPF) ou 14 (CNPJ).
  documento    String?   @db.VarChar(14)
  email        String?   @db.VarChar(120)
  contato      String?   @db.VarChar(80)
  endereco     String?   @db.VarChar(160)
  bairro       String?   @db.VarChar(60)
  cidade       String?   @db.VarChar(60)
  uf           String?   @db.VarChar(2)
  cep          String?   @db.VarChar(9)
  observacoes  String?
  criadoEm     DateTime  @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm DateTime  @updatedAt @map("atualizado_em") @db.Timestamptz(3)
  arquivadoEm  DateTime? @map("arquivado_em") @db.Timestamptz(3)

  telefones TelefoneCliente[]

  @@index([empresaId, nome])
  @@index([empresaId, apelido])
  @@index([empresaId, documento])
  @@index([codigoLegado])
  @@map("cliente")
}

/// Original e normalizado lado a lado, com a marca de inferido (spec, secao 10).
model TelefoneCliente {
  id          String  @id @default(uuid(7)) @db.Uuid
  empresaId   String  @map("empresa_id") @db.Uuid
  clienteId   String  @map("cliente_id") @db.Uuid
  cliente     Cliente @relation(fields: [clienteId], references: [id])
  /// Como veio (do legado ou digitado). Nunca sobrescrito.
  original    String  @db.VarChar(20)
  /// So digitos, discavel: 11 (celular) ou 10 (fixo). null quando nao da para discar.
  normalizado String? @db.VarChar(11)
  /// true quando o sistema completou o nono digito ou o DDD.
  inferido    Boolean @default(false)
  ordem       Int     @default(0)

  @@index([empresaId, normalizado])
  @@index([clienteId])
  @@map("telefone_cliente")
}

/// Tabela de preco, nao estoque: sem quantidade, saldo nem movimentacao (spec, secao 4).
model Material {
  id              String          @id @default(uuid(7)) @db.Uuid
  empresaId       String          @map("empresa_id") @db.Uuid
  empresa         Empresa         @relation(fields: [empresaId], references: [id])
  nome            String          @db.VarChar(120)
  categoria       String?         @db.VarChar(60)
  /// Preco por unidade de cobranca. numeric(12,4).
  preco           Decimal         @db.Decimal(12, 4)
  unidadeCobranca UnidadeCobranca @map("unidade_cobranca")
  ativo           Boolean         @default(true)
  criadoEm        DateTime        @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm    DateTime        @updatedAt @map("atualizado_em") @db.Timestamptz(3)

  @@unique([empresaId, nome])
  @@map("material")
}
```

- [x] **Step 2: Migrar e gerar**

Nenhum `next dev` aberto.

Run: `npm run db:migrate -- --name clientes_materiais`
Expected: migração criada e aplicada no banco `drusign`; no SQL: `CREATE TYPE "unidade_cobranca"`, tabelas `cliente`, `telefone_cliente`, `material`, `"preco" DECIMAL(12,4)`, índice único `material_empresa_id_nome_key`.

Run: `npm run db:generate` → client regenerado.

> Nota de execução (2026-08-28): `prisma migrate dev` **não funciona mais** no Postgres local do `prisma dev`: o PGlite não isola bancos (`drusign`, `template1` e qualquer shadow mostram as mesmas tabelas), então o replay das migrações no shadow falha com `type "papel" already exists` a partir da segunda migração. A primeira só passou porque estava tudo vazio. Caminho adotado, documentado pelo Prisma para ambientes sem shadow: `prisma migrate diff --from-config-datasource --to-schema` gera o SQL, o arquivo entra em `prisma/migrations/`, `migrate deploy` aplica — automatizado em `npm run db:migrar -- <nome>` (`scripts/migrar.mjs`). Os bancos passaram a se chamar `drusign` (dev) e `drusign_test` (teste), criados com `TEMPLATE template0`, e o `template1` foi esvaziado. Na Neon, onde há shadow de verdade, `db:migrate` volta a valer.

- [x] **Step 3: `exigirPapel`**

Acrescentar ao fim de `src/infra/auth/usuario-atual.ts`:
```ts
/** Tela de administracao: quem nao tem o papel volta para a fila, sem estado intermediario. */
export async function exigirPapel(papel: PapelUsuario): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario()
  if (usuario.papel !== papel) redirect('/')
  return usuario
}
```
e, no topo, `import type { PapelUsuario } from '@/domain/usuarios/tipos'`.

- [x] **Step 4: Verificação e commit**

Run: `npm run typecheck` → sem erros.
Run: `npm run test:int` → PASS — 8 passed (o `globalSetup` aplica a migração nova no banco de teste; o `TRUNCATE` passa a limpar as tabelas novas também).

```bash
git add prisma/ src/infra/auth/usuario-atual.ts
git commit -m "feat: modelos de cliente, telefone e material"
```

---

### Task 3: Repositório de clientes

**Files:**
- Create: `src/infra/clientes/repositorio.ts`
- Test: `src/infra/clientes/repositorio.int.test.ts`

**Interfaces:**
- Consumes: `prisma`, `normalizarTelefone`, `normalizarDocumento`
- Produces:
  - `interface DadosCliente { nome; apelido?; documento?; email?; contato?; endereco?; bairro?; cidade?; uf?; cep?; observacoes?; telefones: string[] }`
  - `interface ClienteResumo { id; nome; apelido; documento; arquivadoEm; telefones: TelefoneResumo[] }`, `interface TelefoneResumo { original; normalizado; inferido }`
  - `criarCliente(empresaId, dados, extras?)`, `atualizarCliente(empresaId, id, dados)`, `arquivarCliente(empresaId, id)`, `reativarCliente(empresaId, id)`, `obterCliente(empresaId, id)`, `buscarClientes(empresaId, termo, opcoes?)`, `clientesComTelefone(empresaId, telefones, excetoId?)`

- [x] **Step 1: Escrever o teste de integração**

`src/infra/clientes/repositorio.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente,
  obterCliente, buscarClientes, clientesComTelefone,
} from './repositorio'

let empresaId = ''

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  empresaId = empresa.id
})

describe('clientes (banco real)', () => {
  it('cria com telefones normalizados e documento so em digitos', async () => {
    const c = await criarCliente(empresaId, {
      nome: 'Associação de Ensino e Pesquisa de Unaí',
      apelido: 'FACTU',
      documento: '00.150.991/0001-99',
      telefones: ['(38)3676-6222', '(38)9968-1168', ''],
    })
    expect(c.documento).toBe('00150991000199')
    expect(c.telefones).toEqual([
      { original: '(38)3676-6222', normalizado: '3836766222', inferido: false },
      { original: '(38)9968-1168', normalizado: '38999681168', inferido: true },
    ])
  })

  it('busca por apelido, por nome e por telefone, sem diferenciar caixa', async () => {
    await criarCliente(empresaId, { nome: 'CENCOSUD BRASIL COMERCIAL', apelido: 'BRETAS', telefones: [] })
    await criarCliente(empresaId, { nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ', telefones: ['(38)9968-1168'] })

    expect((await buscarClientes(empresaId, 'bretas')).map((c) => c.nome)).toEqual(['CENCOSUD BRASIL COMERCIAL'])
    expect((await buscarClientes(empresaId, 'cencosud')).map((c) => c.apelido)).toEqual(['BRETAS'])
    expect((await buscarClientes(empresaId, '99681168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    expect((await buscarClientes(empresaId, '(38) 99968-1168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    expect(await buscarClientes(empresaId, 'ninguem')).toEqual([])
  })

  it('sem termo, lista por nome com limite', async () => {
    await criarCliente(empresaId, { nome: 'Zeta', telefones: [] })
    await criarCliente(empresaId, { nome: 'Alfa', telefones: [] })
    await criarCliente(empresaId, { nome: 'Beta', telefones: [] })
    expect((await buscarClientes(empresaId, '', { limite: 2 })).map((c) => c.nome)).toEqual(['Alfa', 'Beta'])
  })

  it('aponta duplicidade por telefone, ignorando o proprio cliente', async () => {
    const a = await criarCliente(empresaId, { nome: 'A', telefones: ['(38)9968-1168'] })
    await criarCliente(empresaId, { nome: 'B', telefones: ['(38)3676-6222'] })

    const dup = await clientesComTelefone(empresaId, ['38999681168', '(38)3676-6222'])
    expect(dup.map((c) => c.nome).sort()).toEqual(['A', 'B'])
    expect((await clientesComTelefone(empresaId, ['38999681168'], a.id)).map((c) => c.nome)).toEqual([])
    expect(await clientesComTelefone(empresaId, ['123', ''])).toEqual([])
  })

  it('atualiza dados e troca a lista de telefones', async () => {
    const c = await criarCliente(empresaId, { nome: 'Antigo', telefones: ['(38)9968-1168'] })
    const d = await atualizarCliente(empresaId, c.id, { nome: 'Novo', apelido: 'N', telefones: ['(38)3676-6222'] })
    expect(d.nome).toBe('Novo')
    expect(d.telefones.map((t) => t.normalizado)).toEqual(['3836766222'])
    expect(await prisma.telefoneCliente.count({ where: { clienteId: c.id } })).toBe(1)
  })

  it('arquiva e reativa sem apagar; arquivado some da busca por padrao', async () => {
    const c = await criarCliente(empresaId, { nome: 'Some', telefones: [] })
    await arquivarCliente(empresaId, c.id)
    expect((await obterCliente(empresaId, c.id))?.arquivadoEm).not.toBeNull()
    expect(await buscarClientes(empresaId, 'some')).toEqual([])
    expect((await buscarClientes(empresaId, 'some', { incluirArquivados: true })).map((x) => x.nome)).toEqual(['Some'])
    await reativarCliente(empresaId, c.id)
    expect((await obterCliente(empresaId, c.id))?.arquivadoEm).toBeNull()
  })

  it('nao enxerga cliente de outra empresa', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const c = await criarCliente(outra.id, { nome: 'Alheio', telefones: [] })
    expect(await obterCliente(empresaId, c.id)).toBeNull()
    expect(await buscarClientes(empresaId, 'alheio')).toEqual([])
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npm run test:int -- repositorio`
Expected: FAIL — `Cannot find module './repositorio'`

- [x] **Step 3: Criar `src/infra/clientes/repositorio.ts`**

```ts
import { prisma } from '@/infra/db/prisma'
import { normalizarTelefone } from '@/domain/clientes/telefone'
import { normalizarDocumento } from '@/domain/clientes/documento'

export interface DadosCliente {
  nome: string
  apelido?: string | null
  /** Como digitado; e normalizado para digitos aqui. */
  documento?: string | null
  email?: string | null
  contato?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  observacoes?: string | null
  /** Como digitados; vazios sao ignorados. */
  telefones: string[]
}

export interface TelefoneResumo {
  original: string
  normalizado: string | null
  inferido: boolean
}

export interface ClienteResumo {
  id: string
  nome: string
  apelido: string | null
  documento: string | null
  arquivadoEm: Date | null
  telefones: TelefoneResumo[]
}

export interface ClienteCompleto extends ClienteResumo {
  codigoLegado: number | null
  email: string | null
  contato: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  observacoes: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface ExtrasImportacao {
  codigoLegado?: number
  arquivadoEm?: Date | null
  criadoEm?: Date
}

const LIMITE_PADRAO = 50

const SELECAO_TELEFONE = { select: { original: true, normalizado: true, inferido: true }, orderBy: { ordem: 'asc' } } as const

const SELECAO_RESUMO = {
  id: true, nome: true, apelido: true, documento: true, arquivadoEm: true,
  telefones: SELECAO_TELEFONE,
} as const

const SELECAO_COMPLETA = {
  ...SELECAO_RESUMO,
  codigoLegado: true, email: true, contato: true, endereco: true, bairro: true,
  cidade: true, uf: true, cep: true, observacoes: true, criadoEm: true, atualizadoEm: true,
} as const

function limpar(v: string | null | undefined): string | null {
  const t = v?.trim() ?? ''
  return t === '' ? null : t
}

function colunas(dados: DadosCliente) {
  return {
    nome: dados.nome.trim(),
    apelido: limpar(dados.apelido),
    documento: normalizarDocumento(dados.documento ?? '')?.digitos ?? null,
    email: limpar(dados.email),
    contato: limpar(dados.contato),
    endereco: limpar(dados.endereco),
    bairro: limpar(dados.bairro),
    cidade: limpar(dados.cidade),
    uf: limpar(dados.uf)?.toUpperCase().slice(0, 2) ?? null,
    cep: limpar(dados.cep),
    observacoes: limpar(dados.observacoes),
  }
}

function telefonesParaCriar(empresaId: string, telefones: string[]) {
  const vistos = new Set<string>()
  return telefones
    .map((t) => t.trim())
    .filter((t) => t !== '' && !vistos.has(t) && vistos.add(t))
    .map((original, ordem) => {
      const n = normalizarTelefone(original)
      return { empresaId, original: original.slice(0, 20), normalizado: n.normalizado, inferido: n.inferido, ordem }
    })
}

export async function criarCliente(
  empresaId: string,
  dados: DadosCliente,
  extras: ExtrasImportacao = {},
): Promise<ClienteCompleto> {
  return prisma.cliente.create({
    data: {
      empresaId,
      ...colunas(dados),
      codigoLegado: extras.codigoLegado ?? null,
      arquivadoEm: extras.arquivadoEm ?? null,
      ...(extras.criadoEm ? { criadoEm: extras.criadoEm } : {}),
      telefones: { create: telefonesParaCriar(empresaId, dados.telefones) },
    },
    select: SELECAO_COMPLETA,
  })
}

/** Troca a lista de telefones inteira: telefone e atributo do cadastro, nao documento. */
export async function atualizarCliente(empresaId: string, id: string, dados: DadosCliente): Promise<ClienteCompleto> {
  const [, atualizado] = await prisma.$transaction([
    prisma.telefoneCliente.deleteMany({ where: { clienteId: id, empresaId } }),
    prisma.cliente.update({
      where: { id, empresaId },
      data: { ...colunas(dados), telefones: { create: telefonesParaCriar(empresaId, dados.telefones) } },
      select: SELECAO_COMPLETA,
    }),
  ])
  return atualizado
}

export async function arquivarCliente(empresaId: string, id: string): Promise<void> {
  await prisma.cliente.update({ where: { id, empresaId }, data: { arquivadoEm: new Date() } })
}

export async function reativarCliente(empresaId: string, id: string): Promise<void> {
  await prisma.cliente.update({ where: { id, empresaId }, data: { arquivadoEm: null } })
}

export async function obterCliente(empresaId: string, id: string): Promise<ClienteCompleto | null> {
  return prisma.cliente.findFirst({ where: { id, empresaId }, select: SELECAO_COMPLETA })
}

export interface OpcoesBusca {
  incluirArquivados?: boolean
  limite?: number
}

/** Nome ou apelido (sem diferenciar caixa); com 4+ digitos no termo, tambem telefone e documento. */
export async function buscarClientes(
  empresaId: string,
  termo: string,
  opcoes: OpcoesBusca = {},
): Promise<ClienteResumo[]> {
  const texto = termo.trim()
  const digitos = texto.replace(/\D/g, '')
  const filtroArquivo = opcoes.incluirArquivados ? {} : { arquivadoEm: null }

  const porTexto = texto === '' ? [] : [
    { nome: { contains: texto, mode: 'insensitive' as const } },
    { apelido: { contains: texto, mode: 'insensitive' as const } },
  ]
  const porDigitos = digitos.length >= 4 ? [
    { telefones: { some: { normalizado: { contains: digitos } } } },
    { documento: { contains: digitos } },
  ] : []
  const ou = [...porTexto, ...porDigitos]

  return prisma.cliente.findMany({
    where: { empresaId, ...filtroArquivo, ...(ou.length > 0 ? { OR: ou } : {}) },
    orderBy: { nome: 'asc' },
    take: opcoes.limite ?? LIMITE_PADRAO,
    select: SELECAO_RESUMO,
  })
}

/** Quem ja tem algum destes telefones (normalizados). Para o aviso de duplicidade ao cadastrar. */
export async function clientesComTelefone(
  empresaId: string,
  telefones: string[],
  excetoId?: string,
): Promise<ClienteResumo[]> {
  const normalizados = telefones
    .map((t) => normalizarTelefone(t).normalizado)
    .filter((n): n is string => n !== null)
  if (normalizados.length === 0) return []

  return prisma.cliente.findMany({
    where: {
      empresaId,
      ...(excetoId ? { id: { not: excetoId } } : {}),
      telefones: { some: { normalizado: { in: normalizados } } },
    },
    orderBy: { nome: 'asc' },
    select: SELECAO_RESUMO,
  })
}
```

- [x] **Step 4: Rodar e ver passar**

Run: `npm run test:int -- repositorio`
Expected: PASS — 7 passed

- [x] **Step 5: Typecheck e commit**

Run: `npm run typecheck` → sem erros.

```bash
git add src/infra/clientes/
git commit -m "feat: repositorio de clientes com busca por apelido e telefone e aviso de duplicidade"
```

---

### Task 4: Leitor de DBF e importação dos clientes do legado

**Files:**
- Create: `src/infra/importacao/dbf.ts`, `src/infra/importacao/clientes-legado.ts`, `scripts/importar-clientes.ts`
- Modify: `package.json`
- Test: `src/infra/importacao/dbf.test.ts`, `src/infra/importacao/clientes-legado.test.ts`, `src/infra/importacao/clientes-legado.int.test.ts`

**Interfaces:**
- Produces:
  - `interpretarDbf(buf: Buffer, codificacao?): { campos: CampoDbf[]; registros: RegistroDbf[] }`, `lerDbf(caminho, codificacao?)`; `RegistroDbf = { apagado: boolean; valores: Record<string, string | number | null> }`
  - `converterRegistro(r: RegistroDbf): ClienteLegado` — puro, testável sem banco
  - `importarClientesLegado(caminhoDbf, empresaId): Promise<ResultadoImportacao>`
  - script `npm run importar:clientes`

- [x] **Step 1: Teste do leitor de DBF com um arquivo construído no próprio teste**

`src/infra/importacao/dbf.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { interpretarDbf } from './dbf'

/** Monta um DBF dBase III minimo: cabecalho, descritores, terminador 0x0D e registros. */
function montarDbf(campos: Array<[string, string, number]>, registros: Array<[boolean, Buffer]>): Buffer {
  const tamReg = 1 + campos.reduce((s, [, , tam]) => s + tam, 0)
  const tamCab = 32 + 32 * campos.length + 1
  const cab = Buffer.alloc(32)
  cab[0] = 0x03
  cab.writeUInt32LE(registros.length, 4)
  cab.writeUInt16LE(tamCab, 8)
  cab.writeUInt16LE(tamReg, 10)
  const descritores = campos.map(([nome, tipo, tam]) => {
    const d = Buffer.alloc(32)
    d.write(nome, 0, 'ascii')
    d[11] = tipo.charCodeAt(0)
    d[16] = tam
    return d
  })
  const corpo = registros.map(([apagado, dados]) => Buffer.concat([Buffer.from(apagado ? '*' : ' '), dados]))
  return Buffer.concat([cab, ...descritores, Buffer.from([0x0d]), ...corpo])
}

describe('interpretarDbf', () => {
  it('le campos, flag de apagado, texto em CP1252 e numero', () => {
    const campos: Array<[string, string, number]> = [['COD', 'N', 5], ['NOM', 'C', 12], ['LIB', 'L', 1]]
    const reg1 = Buffer.concat([Buffer.from('   13', 'ascii'), Buffer.from('ASSOCIA\xc7\xc3O  ', 'latin1'), Buffer.from('T')])
    const reg2 = Buffer.concat([Buffer.from('   26', 'ascii'), Buffer.from('FACTU       ', 'ascii'), Buffer.from('F')])
    const { campos: lidos, registros } = interpretarDbf(montarDbf(campos, [[false, reg1], [true, reg2]]))

    expect(lidos.map((c) => [c.nome, c.tipo, c.tamanho])).toEqual([['COD', 'N', 5], ['NOM', 'C', 12], ['LIB', 'L', 1]])
    expect(registros).toHaveLength(2)
    expect(registros[0]).toEqual({ apagado: false, valores: { COD: 13, NOM: 'ASSOCIAÇÃO', LIB: 'T' } })
    expect(registros[1]).toEqual({ apagado: true, valores: { COD: 26, NOM: 'FACTU', LIB: 'F' } })
  })

  it('numero vazio vira null', () => {
    const buf = montarDbf([['COD', 'N', 5]], [[false, Buffer.from('     ')]])
    expect(interpretarDbf(buf).registros[0]?.valores).toEqual({ COD: null })
  })
})
```

- [x] **Step 2: Rodar e ver falhar, criar o leitor, ver passar**

Run: `npm test -- dbf` → FAIL — `Cannot find module './dbf'`

`src/infra/importacao/dbf.ts`:
```ts
import { readFileSync } from 'node:fs'

export interface CampoDbf {
  nome: string
  tipo: string
  tamanho: number
  decimais: number
}

export interface RegistroDbf {
  /** Flag '*' do dBase: o registro foi apagado logicamente. O legado tem 1.978 destes em CLIENTES. */
  apagado: boolean
  valores: Record<string, string | number | null>
}

export interface ArquivoDbf {
  campos: CampoDbf[]
  registros: RegistroDbf[]
}

/** Leitor dBase III/xHarbour sem dependencia: cabecalho de 32 bytes, descritores de 32, terminador 0x0D. */
export function interpretarDbf(buf: Buffer, codificacao = 'windows-1252'): ArquivoDbf {
  const nRegistros = buf.readUInt32LE(4)
  const tamCabecalho = buf.readUInt16LE(8)
  const tamRegistro = buf.readUInt16LE(10)

  const campos: CampoDbf[] = []
  let pos = 32
  while (pos + 32 <= buf.length && buf[pos] !== 0x0d && buf[pos] !== 0x00) {
    const d = buf.subarray(pos, pos + 32)
    const nome = d.subarray(0, 11).toString('ascii').split('\0')[0]?.trim() ?? ''
    campos.push({ nome, tipo: String.fromCharCode(d[11] ?? 0), tamanho: d[16] ?? 0, decimais: d[17] ?? 0 })
    pos += 32
  }

  const decoder = new TextDecoder(codificacao)
  const registros: RegistroDbf[] = []
  let inicio = tamCabecalho
  for (let i = 0; i < nRegistros && inicio + tamRegistro <= buf.length; i++, inicio += tamRegistro) {
    const bruto = buf.subarray(inicio, inicio + tamRegistro)
    const valores: Record<string, string | number | null> = {}
    let p = 1
    for (const c of campos) {
      const pedaco = bruto.subarray(p, p + c.tamanho)
      p += c.tamanho
      if (c.tipo === 'N' || c.tipo === 'F') {
        const txt = pedaco.toString('ascii').trim()
        valores[c.nome] = txt === '' ? null : Number(txt)
      } else if (c.tipo === 'L') {
        const ch = pedaco.toString('ascii')
        valores[c.nome] = /[TtYy]/.test(ch) ? 'T' : /[FfNn]/.test(ch) ? 'F' : null
      } else {
        valores[c.nome] = decoder.decode(pedaco).trim()
      }
    }
    registros.push({ apagado: bruto[0] === 0x2a, valores })
  }
  return { campos, registros }
}

export function lerDbf(caminho: string, codificacao = 'windows-1252'): ArquivoDbf {
  return interpretarDbf(readFileSync(caminho), codificacao)
}
```

Run: `npm test -- dbf` → PASS — 2 passed

- [x] **Step 3: Teste do conversor de registro (puro)**

`src/infra/importacao/clientes-legado.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { converterRegistro } from './clientes-legado'
import type { RegistroDbf } from './dbf'

function registro(valores: Record<string, string | number | null>, apagado = false): RegistroDbf {
  return { apagado, valores }
}

describe('converterRegistro', () => {
  it('mapeia os campos do CLIENTES.DBF, junta telefones e descarta lixo', () => {
    const r = converterRegistro(registro({
      COD: 26, NOM: 'ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ', EST: 'FACTU',
      TEL1: '(38)3676-6222', TEL2: '(  )    -', FAX: '(38)', CEL: '(38)9968-1168', TELEFONE1: '(38)3676-6222',
      RUA: 'R. EDUARDO RODRIGUES BARBOSA N 180', CPL: 'SALA 2', BAI: '', CID: 'UNAI', UF: 'MG', CEP: '38610-000',
      CTO: 'ELAINE', EMAIL: '', EMAIL1: 'factu@exemplo.com', CGC: '00150991000199', CPF: '',
      OBS1: 'Empenho separado', OBS2: '', OBS3: 'por secretaria', DATA: '20120508',
    }))
    expect(r.codigoLegado).toBe(26)
    expect(r.apagado).toBe(false)
    expect(r.cadastradoEm?.toISOString()).toBe('2012-05-08T00:00:00.000Z')
    expect(r.dados).toEqual({
      nome: 'ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ',
      apelido: 'FACTU',
      documento: '00150991000199',
      email: 'factu@exemplo.com',
      contato: 'ELAINE',
      endereco: 'R. EDUARDO RODRIGUES BARBOSA N 180, SALA 2',
      bairro: null,
      cidade: 'UNAI',
      uf: 'MG',
      cep: '38610-000',
      observacoes: 'Empenho separado\npor secretaria',
      telefones: ['(38)3676-6222', '(38)9968-1168'],
    })
    expect(r.descartados).toBe(1) // '(38)' tem so 2 digitos
  })

  it('registro apagado, sem nome e sem data', () => {
    const r = converterRegistro(registro({ COD: 7, NOM: '', DATA: '' }, true))
    expect(r.apagado).toBe(true)
    expect(r.dados.nome).toBe('(sem nome no legado, cod 7)')
    expect(r.cadastradoEm).toBeNull()
    expect(r.dados.telefones).toEqual([])
  })

  it('CPF vale quando nao ha CGC', () => {
    const r = converterRegistro(registro({ COD: 1, NOM: 'X', CGC: '', CPF: '01754796150' }))
    expect(r.dados.documento).toBe('01754796150')
  })
})
```

- [x] **Step 4: Rodar e ver falhar, criar o conversor e o importador, ver passar**

Run: `npm test -- clientes-legado` → FAIL — `Cannot find module './clientes-legado'`

`src/infra/importacao/clientes-legado.ts`:
```ts
import { lerDbf, type RegistroDbf } from './dbf'
import { prisma } from '@/infra/db/prisma'
import { criarCliente, type DadosCliente } from '@/infra/clientes/repositorio'

export interface ClienteLegado {
  codigoLegado: number
  apagado: boolean
  cadastradoEm: Date | null
  dados: DadosCliente
  /** Entradas de telefone com menos de 8 digitos, que nao valem guardar. */
  descartados: number
}

export interface ResultadoImportacao {
  total: number
  arquivados: number
  telefones: number
  inferidos: number
  naoDiscaveis: number
  descartados: number
  jaExistiam: number
}

const COLUNAS_TELEFONE = [
  'TEL1', 'TEL2', 'TEL3', 'CEL', 'FAX',
  'TELEFONE1', 'CELULAR1', 'TELEFONE2', 'CELULAR2', 'TELEFONE3', 'CELULAR3', 'TELEFONE4', 'CELULAR4',
]

function texto(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function ouNulo(v: string): string | null {
  return v === '' ? null : v
}

function data(v: string): Date | null {
  if (!/^\d{8}$/.test(v)) return null
  const ano = Number(v.slice(0, 4))
  const mes = Number(v.slice(4, 6))
  const dia = Number(v.slice(6, 8))
  if (ano < 1990 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return new Date(Date.UTC(ano, mes - 1, dia))
}

/** Puro: um registro do CLIENTES.DBF vira os dados de um cliente novo. */
export function converterRegistro(r: RegistroDbf): ClienteLegado {
  const v = r.valores
  const codigoLegado = Number(v.COD ?? 0)
  const nome = texto(v.NOM) || `(sem nome no legado, cod ${codigoLegado})`

  const telefones: string[] = []
  let descartados = 0
  for (const coluna of COLUNAS_TELEFONE) {
    const original = texto(v[coluna])
    const digitos = original.replace(/\D/g, '')
    if (digitos.length === 0) continue
    if (digitos.length < 8) {
      descartados++
      continue
    }
    if (!telefones.includes(original)) telefones.push(original)
  }

  const endereco = [texto(v.RUA), texto(v.CPL)].filter((x) => x !== '').join(', ')
  const observacoes = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => texto(v[`OBS${n}`]))
    .filter((x) => x !== '')
    .join('\n')

  return {
    codigoLegado,
    apagado: r.apagado,
    cadastradoEm: data(texto(v.DATA)),
    descartados,
    dados: {
      nome,
      apelido: ouNulo(texto(v.EST)),
      documento: ouNulo(texto(v.CGC) || texto(v.CPF)),
      email: ouNulo(texto(v.EMAIL) || texto(v.EMAIL1)),
      contato: ouNulo(texto(v.CTO) || texto(v.CONTATO1)),
      endereco: ouNulo(endereco),
      bairro: ouNulo(texto(v.BAI)),
      cidade: ouNulo(texto(v.CID)),
      uf: ouNulo(texto(v.UF)),
      cep: ouNulo(texto(v.CEP)),
      observacoes: ouNulo(observacoes),
      telefones,
    },
  }
}

/**
 * Importa todos os registros, inclusive os apagados (viram arquivados). Idempotente por
 * cobertura: se a empresa ja tem algum cliente com codigo legado, nao importa de novo.
 */
export async function importarClientesLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacao> {
  const jaExistiam = await prisma.cliente.count({ where: { empresaId, codigoLegado: { not: null } } })
  const resultado: ResultadoImportacao = {
    total: 0, arquivados: 0, telefones: 0, inferidos: 0, naoDiscaveis: 0, descartados: 0, jaExistiam,
  }
  if (jaExistiam > 0) return resultado

  const { registros } = lerDbf(caminhoDbf)
  for (const registro of registros) {
    const c = converterRegistro(registro)
    const criado = await criarCliente(empresaId, c.dados, {
      codigoLegado: c.codigoLegado,
      arquivadoEm: c.apagado ? new Date() : null,
      ...(c.cadastradoEm ? { criadoEm: c.cadastradoEm } : {}),
    })
    resultado.total++
    if (c.apagado) resultado.arquivados++
    resultado.descartados += c.descartados
    for (const t of criado.telefones) {
      resultado.telefones++
      if (t.normalizado === null) resultado.naoDiscaveis++
      else if (t.inferido) resultado.inferidos++
    }
  }
  return resultado
}
```

Run: `npm test -- clientes-legado` → PASS — 3 passed. (O import de `prisma` no módulo não conecta em nada até ser usado; o unitário só chama `converterRegistro`.)

- [x] **Step 5: Teste de integração contra o DBF real — o critério de verificação da fase**

`src/infra/importacao/clientes-legado.int.test.ts`:
```ts
import { describe, expect, it, beforeAll } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { importarClientesLegado, type ResultadoImportacao } from './clientes-legado'
import { buscarClientes } from '@/infra/clientes/repositorio'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CLIENTES.DBF'

describe('importacao do CLIENTES.DBF (banco real, arquivo real)', () => {
  let empresaId = ''
  let resultado: ResultadoImportacao

  beforeAll(async () => {
    if (!existsSync(DBF)) throw new Error(`Gabarito ausente: ${DBF}. Sem ele a importacao nao tem como ser validada.`)
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    empresaId = empresa.id
    resultado = await importarClientesLegado(DBF, empresaId)
  }, 300_000)

  it('importa os 3.219 clientes, com os 1.978 apagados como arquivados', () => {
    expect(resultado.total).toBe(3219)
    expect(resultado.arquivados).toBe(1978)
    expect(resultado.jaExistiam).toBe(0)
  })

  it('normaliza 3.077 telefones, 1.975 com o nono digito inferido', () => {
    expect(resultado.telefones).toBe(3077)
    expect(resultado.inferidos).toBe(1975)
    expect(resultado.naoDiscaveis).toBe(8)
    expect(resultado.descartados).toBe(63)
  })

  it('nenhum celular sobrou com 10 digitos', async () => {
    const celularesCurtos = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM telefone_cliente
      WHERE length(normalizado) = 10 AND substr(normalizado, 3, 1) IN ('6','7','8','9')`
    expect(Number(celularesCurtos[0]?.n)).toBe(0)
  })

  it('a busca por apelido acha o Bretas e a FACTU', async () => {
    expect((await buscarClientes(empresaId, 'bretas')).map((c) => c.nome)).toContain('CENCOSUD BRASIL COMERCIAL')
    expect((await buscarClientes(empresaId, 'factu')).map((c) => c.nome)).toContain('ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ')
  })

  it('preserva o original e a data de cadastro do legado', async () => {
    const factu = await prisma.cliente.findFirst({ where: { empresaId, codigoLegado: 26 }, include: { telefones: true } })
    expect(factu?.criadoEm.toISOString()).toBe('2012-05-08T00:00:00.000Z')
    expect(factu?.telefones.map((t) => [t.original, t.normalizado, t.inferido])).toEqual([
      ['(38)3676-6222', '3836766222', false],
      ['(38)9968-1168', '38999681168', true],
    ])
  })

  it('rodar de novo nao duplica', async () => {
    const segunda = await importarClientesLegado(DBF, empresaId)
    expect(segunda.total).toBe(0)
    expect(segunda.jaExistiam).toBe(3219)
    expect(await prisma.cliente.count({ where: { empresaId } })).toBe(3219)
  })
})
```

Run: `npm run test:int -- clientes-legado`
Expected: PASS — 6 passed.

> Notas de execução (2026-08-28): (1) o teste unitário do conversor quebrava ao importar `./clientes-legado`, porque o módulo carrega o `prisma` (que avalia `env()` sem `DATABASE_URL` no unitário); o conversor puro foi para `conversao-clientes.ts` e o unitário importa de lá. (2) 3.219 `create` aninhados levaram mais de 5 min no Postgres local; o importador passou a usar `createMany` em lotes de 500 (clientes, depois telefones) via `prepararLinhas` do repositório — 31 s. (3) O `beforeEach` do harness trunca o banco antes de cada `it`, apagando o que o `beforeAll` importou; o arquivo virou **um único caso** com as seis verificações em sequência (1 passed). Demora (3.219 inserções no Postgres local); colar o tempo. Se o número de telefones ou inferidos divergir, **parar**: ou a regra mudou ou o DBF não é o mesmo.

- [x] **Step 6: Script de importação e execução no banco de desenvolvimento**

`scripts/importar-clientes.ts`:
```ts
// Uso: npm run importar:clientes [caminho-do-CLIENTES.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarClientesLegado } from '../src/infra/importacao/clientes-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CLIENTES.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const inicio = Date.now()
  const r = await importarClientesLegado(caminho, empresa.id)
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: a empresa "${empresa.razaoSocial}" ja tem ${r.jaExistiam} clientes importados`)
    return
  }
  console.log(
    `${r.total} clientes importados para "${empresa.razaoSocial}" em ${segundos}s: ` +
      `${r.arquivados} arquivados, ${r.telefones} telefones (${r.inferidos} com nono digito inferido, ` +
      `${r.naoDiscaveis} nao discaveis, ${r.descartados} entradas descartadas)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

`package.json`, em `scripts`:
```json
"importar:clientes": "tsx scripts/importar-clientes.ts"
```

Run: `npm run importar:clientes`
Expected: `3219 clientes importados para "DruSign Placas e Comunicacao Visual" em N s: 1978 arquivados, 3077 telefones (1975 com nono digito inferido, 8 nao discaveis, 63 entradas descartadas)`

Run: `npm run importar:clientes` (de novo)
Expected: `nada a fazer: ... ja tem 3219 clientes importados`

- [x] **Step 7: Verificação e commit**

Run: `npm run typecheck` → sem erros.
Run: `npm test` → PASS.

```bash
git add package.json src/infra/importacao/ scripts/importar-clientes.ts
git commit -m "feat: leitor de DBF e importacao dos 3.219 clientes do legado com telefone normalizado"
```

---

### Task 5: Telas de clientes — lista com busca, ficha, cadastro e edição

**Files:**
- Create: `src/infra/clientes/formulario.ts`, `src/app/(app)/navegacao.ts`
- Create: `src/app/(app)/clientes/page.tsx`, `src/app/(app)/clientes/actions.ts`, `src/app/(app)/clientes/form-cliente.tsx`, `src/app/(app)/clientes/novo/page.tsx`, `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/clientes/[id]/editar/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/infra/clientes/formulario.test.ts`

**Interfaces:**
- Consumes: repositório da Task 3, `formatarTelefone`, `formatarDocumento`, `exigirUsuario`
- Produces: rotas `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/clientes/[id]/editar`; `lerFormularioCliente(formData): DadosCliente`; Server Actions `salvarCliente`, `arquivar`, `reativar`

- [x] **Step 1: Teste da leitura do formulário**

`src/infra/clientes/formulario.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { lerFormularioCliente } from './formulario'

function form(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('lerFormularioCliente', () => {
  it('le os campos e junta os tres telefones, ignorando vazios', () => {
    const dados = lerFormularioCliente(form({
      nome: '  Cencosud Brasil Comercial ', apelido: 'Bretas', documento: '39.346.861/0286-86',
      telefone1: '', telefone2: '(38)9968-1168', telefone3: '  ', email: 'obra@x.com', uf: 'mg',
    }))
    expect(dados.nome).toBe('Cencosud Brasil Comercial')
    expect(dados.apelido).toBe('Bretas')
    expect(dados.documento).toBe('39.346.861/0286-86')
    expect(dados.telefones).toEqual(['(38)9968-1168'])
    expect(dados.uf).toBe('mg')
    expect(dados.contato).toBe('')
  })

  it('nome ausente vira string vazia (a action rejeita)', () => {
    expect(lerFormularioCliente(form({})).nome).toBe('')
  })
})
```

- [x] **Step 2: Rodar e ver falhar, criar, ver passar**

Run: `npm test -- formulario` → FAIL — `Cannot find module './formulario'`

`src/infra/clientes/formulario.ts`:
```ts
import type { DadosCliente } from './repositorio'

function campo(formData: FormData, nome: string): string {
  return String(formData.get(nome) ?? '').trim()
}

/** FormData -> DadosCliente. Nao valida: quem valida e a action (nome obrigatorio). */
export function lerFormularioCliente(formData: FormData): DadosCliente {
  return {
    nome: campo(formData, 'nome'),
    apelido: campo(formData, 'apelido'),
    documento: campo(formData, 'documento'),
    email: campo(formData, 'email'),
    contato: campo(formData, 'contato'),
    endereco: campo(formData, 'endereco'),
    bairro: campo(formData, 'bairro'),
    cidade: campo(formData, 'cidade'),
    uf: campo(formData, 'uf'),
    cep: campo(formData, 'cep'),
    observacoes: campo(formData, 'observacoes'),
    telefones: ['telefone1', 'telefone2', 'telefone3'].map((n) => campo(formData, n)).filter((t) => t !== ''),
  }
}
```

Run: `npm test -- formulario` → PASS — 2 passed

- [x] **Step 3: Navegação com papel e o layout**

`src/app/(app)/navegacao.ts`:
```ts
import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: 'fila' | 'clientes' | 'materiais'
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
]
```

Em `src/app/(app)/layout.tsx`, trocar o `<ul className="navbar-nav pt-lg-3">…</ul>` por:
```tsx
            <ul className="navbar-nav pt-lg-3">
              {NAVEGACAO.filter((item) => !item.papel || item.papel === usuario.papel).map((item) => (
                <li className="nav-item" key={item.href}>
                  <Link className="nav-link" href={item.href}>
                    <span className="nav-link-icon d-md-none d-lg-inline-block">{ICONES[item.icone]}</span>
                    <span className="nav-link-title">{item.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
```
e, no topo do arquivo:
```tsx
import { IconListCheck, IconUsers, IconPackage } from '@tabler/icons-react'
import { NAVEGACAO } from './navegacao'

const ICONES = {
  fila: <IconListCheck className="icon" />,
  clientes: <IconUsers className="icon" />,
  materiais: <IconPackage className="icon" />,
} as const
```
(removendo o import antigo só de `IconListCheck`).

- [x] **Step 4: Actions de cliente**

`src/app/(app)/clientes/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { lerFormularioCliente } from '@/infra/clientes/formulario'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente, clientesComTelefone,
  type ClienteResumo, type DadosCliente,
} from '@/infra/clientes/repositorio'

export interface EstadoCliente {
  erro?: string
  /** Quem ja tem um dos telefones digitados. O form mostra e pede confirmacao. */
  duplicados?: ClienteResumo[]
  /** O que foi digitado, para o form nao perder nada ao voltar com aviso. */
  campos?: DadosCliente
}

export async function salvarCliente(_estado: EstadoCliente, formData: FormData): Promise<EstadoCliente> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  const confirmou = formData.get('confirmarDuplicidade') === '1'
  const dados = lerFormularioCliente(formData)

  if (dados.nome === '') {
    return { erro: 'O nome é obrigatório.', campos: dados }
  }

  if (!confirmou) {
    const duplicados = await clientesComTelefone(usuario.empresaId, dados.telefones, id || undefined)
    if (duplicados.length > 0) {
      return { duplicados, campos: dados }
    }
  }

  const salvo = id
    ? await atualizarCliente(usuario.empresaId, id, dados)
    : await criarCliente(usuario.empresaId, dados)
  redirect(`/clientes/${salvo.id}`)
}

export async function arquivar(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  await arquivarCliente(usuario.empresaId, id)
  redirect(`/clientes/${id}`)
}

export async function reativar(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  await reativarCliente(usuario.empresaId, id)
  redirect(`/clientes/${id}`)
}
```

- [x] **Step 5: Formulário (Client Component) e páginas**

`src/app/(app)/clientes/form-cliente.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { salvarCliente, type EstadoCliente } from './actions'
import type { DadosCliente } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'

const ESTADO_INICIAL: EstadoCliente = {}

const VAZIO: DadosCliente = {
  nome: '', apelido: '', documento: '', email: '', contato: '',
  endereco: '', bairro: '', cidade: 'Unaí', uf: 'MG', cep: '', observacoes: '', telefones: [],
}

interface Props {
  id?: string
  inicial?: DadosCliente
}

export function FormCliente({ id, inicial }: Props) {
  const [estado, acao, pendente] = useActionState(salvarCliente, ESTADO_INICIAL)
  const v = estado.campos ?? inicial ?? VAZIO
  const tel = (i: number) => v.telefones[i] ?? ''

  return (
    <form action={acao} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {estado.erro ? (
        <div className="alert alert-danger" role="alert">{estado.erro}</div>
      ) : null}

      {estado.duplicados && estado.duplicados.length > 0 ? (
        <div className="alert alert-warning" role="alert">
          <h4 className="alert-title">Já existe cadastro com este telefone</h4>
          <ul className="mb-2">
            {estado.duplicados.map((c) => (
              <li key={c.id}>
                <a href={`/clientes/${c.id}`}>{c.nome}</a>
                {c.apelido ? ` (${c.apelido})` : ''}
                {' — '}
                {c.telefones.map((t) => (t.normalizado ? formatarTelefone(t.normalizado) : t.original)).join(', ')}
              </li>
            ))}
          </ul>
          <label className="form-check">
            <input className="form-check-input" type="checkbox" name="confirmarDuplicidade" value="1" />
            <span className="form-check-label">É outra pessoa. Cadastrar mesmo assim.</span>
          </label>
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label required" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" className="form-control" defaultValue={v.nome} autoFocus required />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="apelido">Apelido</label>
          <input id="apelido" name="apelido" className="form-control" defaultValue={v.apelido ?? ''} placeholder="Como a loja chama" />
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone1">Telefone</label>
          <input id="telefone1" name="telefone1" className="form-control" inputMode="tel" defaultValue={tel(0)} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone2">Telefone 2</label>
          <input id="telefone2" name="telefone2" className="form-control" inputMode="tel" defaultValue={tel(1)} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone3">Telefone 3</label>
          <input id="telefone3" name="telefone3" className="form-control" inputMode="tel" defaultValue={tel(2)} />
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="documento">CPF ou CNPJ</label>
          <input id="documento" name="documento" className="form-control" inputMode="numeric" defaultValue={v.documento ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="form-control" defaultValue={v.email ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="contato">Contato</label>
          <input id="contato" name="contato" className="form-control" defaultValue={v.contato ?? ''} placeholder="Com quem falar" />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="endereco">Endereço</label>
          <input id="endereco" name="endereco" className="form-control" defaultValue={v.endereco ?? ''} />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="bairro">Bairro</label>
          <input id="bairro" name="bairro" className="form-control" defaultValue={v.bairro ?? ''} />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="cep">CEP</label>
          <input id="cep" name="cep" className="form-control" inputMode="numeric" defaultValue={v.cep ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" className="form-control" defaultValue={v.cidade ?? ''} />
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="uf">UF</label>
          <input id="uf" name="uf" className="form-control" maxLength={2} defaultValue={v.uf ?? ''} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="observacoes">Observações</label>
          <textarea id="observacoes" name="observacoes" className="form-control" rows={3} defaultValue={v.observacoes ?? ''} />
        </div>
      </div>

      <div className="form-footer d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar'}
        </button>
        <a href={id ? `/clientes/${id}` : '/clientes'} className="btn btn-link">Cancelar</a>
      </div>
    </form>
  )
}
```

`src/app/(app)/clientes/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { buscarClientes } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'

export const metadata: Metadata = { title: 'Clientes' }

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', arquivados } = await searchParams
  const clientes = await buscarClientes(usuario.empresaId, q, { incluirArquivados: arquivados === '1' })

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Clientes</h2>
            </div>
            <div className="col-auto">
              <Link href="/clientes/novo" className="btn btn-primary">
                <IconPlus className="icon" /> Novo cliente
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" className="mb-3" role="search">
            <div className="input-icon">
              <span className="input-icon-addon"><IconSearch className="icon" /></span>
              <input
                type="search" name="q" className="form-control form-control-lg" defaultValue={q}
                placeholder="Nome, apelido, telefone ou CPF/CNPJ" aria-label="Buscar cliente" autoFocus
              />
            </div>
            <label className="form-check mt-2">
              <input className="form-check-input" type="checkbox" name="arquivados" value="1" defaultChecked={arquivados === '1'} />
              <span className="form-check-label">Incluir arquivados</span>
            </label>
          </form>

          {clientes.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty">
                  <p className="empty-title">{q ? `Nenhum cliente com “${q}”` : 'Nenhum cliente cadastrado'}</p>
                  <p className="empty-subtitle text-secondary">
                    A busca olha nome, apelido, telefone e documento. Se é cliente novo, cadastre.
                  </p>
                  <div className="empty-action">
                    <Link href="/clientes/novo" className="btn btn-primary">Cadastrar cliente</Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Telefones</th>
                      <th>Documento</th>
                      <th className="w-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="text-reset fw-medium">{c.nome}</Link>
                          {c.apelido ? <span className="badge bg-primary-lt ms-2">{c.apelido}</span> : null}
                          {c.arquivadoEm ? <span className="badge bg-secondary-lt ms-2">arquivado</span> : null}
                        </td>
                        <td className="text-secondary">
                          {c.telefones.map((t) => (
                            <span key={t.original} className="me-2" title={t.inferido ? 'Nono dígito completado pelo sistema' : undefined}>
                              {t.normalizado ? formatarTelefone(t.normalizado) : t.original}{t.inferido ? '*' : ''}
                            </span>
                          ))}
                        </td>
                        <td className="text-secondary">{c.documento ? formatarDocumento(c.documento) : ''}</td>
                        <td><Link href={`/clientes/${c.id}`}>Ficha</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {clientes.length >= 50 ? (
                <div className="card-footer text-secondary">Mostrando os primeiros 50. Refine a busca.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

`src/app/(app)/clientes/novo/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { FormCliente } from '../form-cliente'

export const metadata: Metadata = { title: 'Novo cliente' }

export default async function PaginaNovoCliente() {
  await exigirUsuario()
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Clientes</div>
          <h2 className="page-title">Novo cliente</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormCliente />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

`src/app/(app)/clientes/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterCliente } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import { arquivar, reativar } from '../actions'

export const metadata: Metadata = { title: 'Ficha do cliente' }

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const c = await obterCliente(usuario.empresaId, id)
  if (!c) notFound()

  const endereco = [c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' · ')

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Cliente</div>
              <h2 className="page-title">
                {c.nome}
                {c.apelido ? <span className="badge bg-primary-lt ms-2">{c.apelido}</span> : null}
                {c.arquivadoEm ? <span className="badge bg-secondary-lt ms-2">arquivado</span> : null}
              </h2>
            </div>
            <div className="col-auto d-flex gap-2">
              <Link href={`/clientes/${c.id}/editar`} className="btn">Editar</Link>
              <form action={c.arquivadoEm ? reativar : arquivar}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn btn-ghost-secondary">
                  {c.arquivadoEm ? 'Reativar' : 'Arquivar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h3 className="card-title">Contato</h3></div>
                <div className="card-body">
                  <dl className="row">
                    <dt className="col-4">Telefones</dt>
                    <dd className="col-8">
                      {c.telefones.length === 0 ? <span className="text-secondary">nenhum</span> : null}
                      {c.telefones.map((t) => (
                        <div key={t.original}>
                          {t.normalizado ? formatarTelefone(t.normalizado) : <span className="text-secondary">{t.original} (não discável)</span>}
                          {t.inferido ? <small className="text-secondary ms-2">nono dígito completado; no legado: {t.original}</small> : null}
                        </div>
                      ))}
                    </dd>
                    <dt className="col-4">Contato</dt><dd className="col-8">{c.contato ?? '—'}</dd>
                    <dt className="col-4">E-mail</dt><dd className="col-8">{c.email ?? '—'}</dd>
                    <dt className="col-4">Documento</dt><dd className="col-8">{c.documento ? formatarDocumento(c.documento) : '—'}</dd>
                    <dt className="col-4">Endereço</dt><dd className="col-8">{endereco || '—'}</dd>
                    <dt className="col-4">Cadastro</dt>
                    <dd className="col-8">
                      {c.criadoEm.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      {c.codigoLegado !== null ? <small className="text-secondary ms-2">legado nº {c.codigoLegado}</small> : null}
                    </dd>
                  </dl>
                  {c.observacoes ? <><h4>Observações</h4><p className="text-secondary" style={{ whiteSpace: 'pre-line' }}>{c.observacoes}</p></> : null}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h3 className="card-title">Histórico de ordens</h3></div>
                <div className="card-body">
                  <div className="empty">
                    <p className="empty-title">Ainda sem ordens</p>
                    <p className="empty-subtitle text-secondary">
                      As ordens novas aparecem aqui a partir da Fase 3; as 18.443 do sistema antigo, na Fase 6.
                    </p>
                  </div>
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

`src/app/(app)/clientes/[id]/editar/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterCliente } from '@/infra/clientes/repositorio'
import { FormCliente } from '../../form-cliente'

export const metadata: Metadata = { title: 'Editar cliente' }

export default async function PaginaEditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const c = await obterCliente(usuario.empresaId, id)
  if (!c) notFound()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Cliente</div>
          <h2 className="page-title">Editar {c.nome}</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormCliente
                id={c.id}
                inicial={{
                  nome: c.nome, apelido: c.apelido, documento: c.documento, email: c.email, contato: c.contato,
                  endereco: c.endereco, bairro: c.bairro, cidade: c.cidade, uf: c.uf, cep: c.cep,
                  observacoes: c.observacoes, telefones: c.telefones.map((t) => t.original),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [x] **Step 6: Typecheck, testes, build e fumaça**

Run: `npm run typecheck` → sem erros. Run: `npm test` → PASS (a trava `use-client` continua verde: `form-cliente.tsx` não importa react-bootstrap).
Run: `npm run build` → rotas `ƒ /clientes`, `ƒ /clientes/[id]`, `ƒ /clientes/[id]/editar`, `ƒ /clientes/novo`.

Fumaça com `next dev` (script `fumaca.mjs` da 1B): `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/clientes` → `307 …/entrar?proximo=%2Fclientes`.

- [x] **Step 7: Commit**

```bash
git add src/infra/clientes/formulario.ts src/infra/clientes/formulario.test.ts "src/app/(app)/navegacao.ts" "src/app/(app)/layout.tsx" "src/app/(app)/clientes/"
git commit -m "feat: telas de clientes com busca por apelido e telefone e aviso de duplicidade"
```

---

### Task 6: Materiais e preços (administração)

**Files:**
- Create: `src/infra/materiais/repositorio.ts`, `src/app/(app)/materiais/page.tsx`, `src/app/(app)/materiais/actions.ts`, `src/app/(app)/materiais/form-material.tsx`, `src/app/(app)/materiais/[id]/page.tsx`
- Test: `src/infra/materiais/repositorio.int.test.ts`

**Interfaces:**
- Consumes: `paraBanco`/`paraDominio`, `interpretarMoeda`/`formatarMoeda`, `exigirPapel`
- Produces:
  - `interface MaterialResumo { id; nome; categoria; preco: Decimal; unidadeCobranca: UnidadeCobranca; ativo }`
  - `listarMateriais(empresaId, { incluirInativos? })`, `obterMaterial(empresaId, id)`, `criarMaterial(empresaId, dados)`, `atualizarMaterial(empresaId, id, dados)`, `definirAtivo(empresaId, id, ativo)`
  - `DadosMaterial { nome; categoria?; preco: Decimal; unidadeCobranca }`; `UNIDADES_COBRANCA` com rótulos: `m2 → 'por m²'`, `unidade → 'por unidade'`, `metro_linear → 'por metro linear'`
  - rotas `/materiais` e `/materiais/[id]` (só administração)

- [ ] **Step 1: Teste de integração**

`src/infra/materiais/repositorio.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { criarMaterial, atualizarMaterial, listarMateriais, obterMaterial, definirAtivo } from './repositorio'

let empresaId = ''

beforeEach(async () => {
  empresaId = (await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })).id
})

describe('materiais (banco real)', () => {
  it('guarda o preco em numeric(12,4) e devolve Decimal do dominio', async () => {
    const m = await criarMaterial(empresaId, { nome: 'ACM 3mm', categoria: 'Placas', preco: dinheiro('281'), unidadeCobranca: 'm2' })
    expect(m.preco.toString()).toBe('281')
    expect(m.ativo).toBe(true)
    const lido = await obterMaterial(empresaId, m.id)
    expect(lido?.preco.equals(dinheiro('281'))).toBe(true)
    expect(lido?.unidadeCobranca).toBe('m2')
  })

  it('preserva quatro casas', async () => {
    const m = await criarMaterial(empresaId, { nome: 'Perfil', preco: dinheiro('28.1234'), unidadeCobranca: 'metro_linear' })
    expect((await obterMaterial(empresaId, m.id))?.preco.toString()).toBe('28.1234')
  })

  it('nome e unico por empresa', async () => {
    await criarMaterial(empresaId, { nome: 'Lona', preco: dinheiro('83'), unidadeCobranca: 'm2' })
    await expect(criarMaterial(empresaId, { nome: 'Lona', preco: dinheiro('90'), unidadeCobranca: 'm2' }))
      .rejects.toMatchObject({ code: 'P2002' })
  })

  it('lista so ativos por padrao, em ordem de nome', async () => {
    const a = await criarMaterial(empresaId, { nome: 'Zeta', preco: dinheiro('1'), unidadeCobranca: 'unidade' })
    await criarMaterial(empresaId, { nome: 'Alfa', preco: dinheiro('1'), unidadeCobranca: 'unidade' })
    await definirAtivo(empresaId, a.id, false)
    expect((await listarMateriais(empresaId)).map((m) => m.nome)).toEqual(['Alfa'])
    expect((await listarMateriais(empresaId, { incluirInativos: true })).map((m) => m.nome)).toEqual(['Alfa', 'Zeta'])
  })

  it('atualiza preco e unidade', async () => {
    const m = await criarMaterial(empresaId, { nome: 'Letra caixa', preco: dinheiro('30'), unidadeCobranca: 'unidade' })
    const n = await atualizarMaterial(empresaId, m.id, { nome: 'Letra caixa PVC 10mm', preco: dinheiro('34'), unidadeCobranca: 'unidade' })
    expect(n.nome).toBe('Letra caixa PVC 10mm')
    expect(n.preco.toString()).toBe('34')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar, criar, ver passar**

Run: `npm run test:int -- materiais` → FAIL — `Cannot find module './repositorio'`

`src/infra/materiais/repositorio.ts`:
```ts
import type { Decimal } from '@/domain/precificacao/dinheiro'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import { prisma } from '@/infra/db/prisma'
import { paraBanco, paraDominio } from '@/infra/db/decimal'

export const UNIDADES_COBRANCA: ReadonlyArray<{ valor: UnidadeCobranca; rotulo: string }> = [
  { valor: 'm2', rotulo: 'por m²' },
  { valor: 'unidade', rotulo: 'por unidade' },
  { valor: 'metro_linear', rotulo: 'por metro linear' },
]

export function rotuloUnidade(unidade: UnidadeCobranca): string {
  return UNIDADES_COBRANCA.find((u) => u.valor === unidade)?.rotulo ?? unidade
}

export function ehUnidadeCobranca(v: string): v is UnidadeCobranca {
  return UNIDADES_COBRANCA.some((u) => u.valor === v)
}

export interface DadosMaterial {
  nome: string
  categoria?: string | null
  preco: Decimal
  unidadeCobranca: UnidadeCobranca
}

export interface MaterialResumo {
  id: string
  nome: string
  categoria: string | null
  preco: Decimal
  unidadeCobranca: UnidadeCobranca
  ativo: boolean
}

const SELECAO = { id: true, nome: true, categoria: true, preco: true, unidadeCobranca: true, ativo: true } as const

type Linha = { id: string; nome: string; categoria: string | null; preco: { toFixed(): string }; unidadeCobranca: UnidadeCobranca; ativo: boolean }

function paraResumo(l: Linha): MaterialResumo {
  return { ...l, preco: paraDominio(l.preco as Parameters<typeof paraDominio>[0]) }
}

function colunas(dados: DadosMaterial) {
  const categoria = dados.categoria?.trim() ?? ''
  return {
    nome: dados.nome.trim(),
    categoria: categoria === '' ? null : categoria,
    preco: paraBanco(dados.preco),
    unidadeCobranca: dados.unidadeCobranca,
  }
}

export async function listarMateriais(empresaId: string, opcoes: { incluirInativos?: boolean } = {}): Promise<MaterialResumo[]> {
  const linhas = await prisma.material.findMany({
    where: { empresaId, ...(opcoes.incluirInativos ? {} : { ativo: true }) },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    select: SELECAO,
  })
  return linhas.map(paraResumo)
}

export async function obterMaterial(empresaId: string, id: string): Promise<MaterialResumo | null> {
  const l = await prisma.material.findFirst({ where: { id, empresaId }, select: SELECAO })
  return l ? paraResumo(l) : null
}

export async function criarMaterial(empresaId: string, dados: DadosMaterial): Promise<MaterialResumo> {
  return paraResumo(await prisma.material.create({ data: { empresaId, ...colunas(dados) }, select: SELECAO }))
}

export async function atualizarMaterial(empresaId: string, id: string, dados: DadosMaterial): Promise<MaterialResumo> {
  return paraResumo(await prisma.material.update({ where: { id, empresaId }, data: colunas(dados), select: SELECAO }))
}

export async function definirAtivo(empresaId: string, id: string, ativo: boolean): Promise<void> {
  await prisma.material.update({ where: { id, empresaId }, data: { ativo } })
}
```

Run: `npm run test:int -- materiais` → PASS — 5 passed

- [ ] **Step 3: Actions, formulário e páginas**

`src/app/(app)/materiais/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { interpretarMoeda } from '@/domain/precificacao/moeda'
import { criarMaterial, atualizarMaterial, definirAtivo, ehUnidadeCobranca } from '@/infra/materiais/repositorio'

export interface EstadoMaterial {
  erro?: string
  campos?: { nome: string; categoria: string; preco: string; unidadeCobranca: string }
}

export async function salvarMaterial(_estado: EstadoMaterial, formData: FormData): Promise<EstadoMaterial> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const campos = {
    nome: String(formData.get('nome') ?? '').trim(),
    categoria: String(formData.get('categoria') ?? '').trim(),
    preco: String(formData.get('preco') ?? '').trim(),
    unidadeCobranca: String(formData.get('unidadeCobranca') ?? ''),
  }

  if (campos.nome === '') return { erro: 'O nome é obrigatório.', campos }
  const preco = interpretarMoeda(campos.preco)
  if (preco === null) return { erro: 'Preço inválido. Use, por exemplo, 281,00.', campos }
  if (!ehUnidadeCobranca(campos.unidadeCobranca)) return { erro: 'Escolha como o material é cobrado.', campos }

  const dados = { nome: campos.nome, categoria: campos.categoria, preco, unidadeCobranca: campos.unidadeCobranca }
  try {
    if (id) await atualizarMaterial(usuario.empresaId, id, dados)
    else await criarMaterial(usuario.empresaId, dados)
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002') {
      return { erro: `Já existe um material chamado “${campos.nome}”.`, campos }
    }
    throw e
  }
  redirect('/materiais')
}

export async function alternarAtivo(formData: FormData): Promise<void> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const ativo = formData.get('ativo') === '1'
  await definirAtivo(usuario.empresaId, id, ativo)
  redirect('/materiais')
}
```

`src/app/(app)/materiais/form-material.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { salvarMaterial, type EstadoMaterial } from './actions'
import { UNIDADES_COBRANCA } from '@/infra/materiais/repositorio'

const ESTADO_INICIAL: EstadoMaterial = {}

interface Props {
  id?: string
  inicial?: { nome: string; categoria: string; preco: string; unidadeCobranca: string }
}

export function FormMaterial({ id, inicial }: Props) {
  const [estado, acao, pendente] = useActionState(salvarMaterial, ESTADO_INICIAL)
  const v = estado.campos ?? inicial ?? { nome: '', categoria: '', preco: '', unidadeCobranca: '' }

  return (
    <form action={acao} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {estado.erro ? <div className="alert alert-danger" role="alert">{estado.erro}</div> : null}
      <div className="row g-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label required" htmlFor="nome">Material</label>
          <input id="nome" name="nome" className="form-control" defaultValue={v.nome} required autoFocus />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="categoria">Categoria</label>
          <input id="categoria" name="categoria" className="form-control" defaultValue={v.categoria} placeholder="Placas, Adesivos…" />
        </div>
        <div className="col-md-2">
          <label className="form-label required" htmlFor="preco">Preço</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            <input id="preco" name="preco" className="form-control numero" inputMode="decimal" defaultValue={v.preco} required />
          </div>
        </div>
        <div className="col-md-2">
          <label className="form-label required" htmlFor="unidadeCobranca">Cobrado</label>
          <select id="unidadeCobranca" name="unidadeCobranca" className="form-select" defaultValue={v.unidadeCobranca} required>
            <option value="">escolha…</option>
            {UNIDADES_COBRANCA.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
          </select>
        </div>
        <div className="col-md-1 d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? '…' : 'Salvar'}</button>
        </div>
      </div>
    </form>
  )
}
```

`src/app/(app)/materiais/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarMateriais, rotuloUnidade } from '@/infra/materiais/repositorio'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { FormMaterial } from './form-material'
import { alternarAtivo } from './actions'

export const metadata: Metadata = { title: 'Materiais e preços' }

export default async function PaginaMateriais() {
  const usuario = await exigirPapel('administracao')
  const materiais = await listarMateriais(usuario.empresaId, { incluirInativos: true })

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Administração</div>
          <h2 className="page-title">Materiais e preços</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card mb-3">
            <div className="card-header"><h3 className="card-title">Novo material</h3></div>
            <div className="card-body"><FormMaterial /></div>
          </div>

          {materiais.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty">
                  <p className="empty-title">O catálogo nasce vazio</p>
                  <p className="empty-subtitle text-secondary">
                    É tabela de preço, não estoque. Cadastre cada material com o preço e como ele é cobrado: por m², por unidade ou por metro linear.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr><th>Material</th><th>Categoria</th><th className="text-end">Preço</th><th>Cobrado</th><th className="w-1"></th></tr>
                  </thead>
                  <tbody>
                    {materiais.map((m) => (
                      <tr key={m.id} className={m.ativo ? '' : 'text-secondary'}>
                        <td>
                          <Link href={`/materiais/${m.id}`} className="text-reset fw-medium">{m.nome}</Link>
                          {m.ativo ? null : <span className="badge bg-secondary-lt ms-2">inativo</span>}
                        </td>
                        <td>{m.categoria ?? ''}</td>
                        <td className="numero">{formatarMoeda(m.preco)}</td>
                        <td>{rotuloUnidade(m.unidadeCobranca)}</td>
                        <td>
                          <form action={alternarAtivo}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="ativo" value={m.ativo ? '0' : '1'} />
                            <button type="submit" className="btn btn-sm btn-ghost-secondary">{m.ativo ? 'Desativar' : 'Reativar'}</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

`src/app/(app)/materiais/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterMaterial } from '@/infra/materiais/repositorio'
import { FormMaterial } from '../form-material'

export const metadata: Metadata = { title: 'Editar material' }

export default async function PaginaEditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { id } = await params
  const m = await obterMaterial(usuario.empresaId, id)
  if (!m) notFound()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Materiais e preços</div>
          <h2 className="page-title">Editar {m.nome}</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormMaterial
                id={m.id}
                inicial={{ nome: m.nome, categoria: m.categoria ?? '', preco: m.preco.toFixed(2).replace('.', ','), unidadeCobranca: m.unidadeCobranca }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Typecheck, testes, build e commit**

Run: `npm run typecheck` → sem erros. Run: `npm test` → PASS. Run: `npm run test:int` → PASS.
Run: `npm run build` → rotas `ƒ /materiais` e `ƒ /materiais/[id]`.

```bash
git add src/infra/materiais/ "src/app/(app)/materiais/"
git commit -m "feat: catalogo de materiais e precos para administracao"
```

---

### Task 7: Ponta a ponta — clientes e materiais

**Files:**
- Create: `e2e/apoio.ts`, `e2e/clientes.spec.ts`, `e2e/materiais.spec.ts`

- [ ] **Step 1: Helper de login e os dois specs**

`e2e/apoio.ts`:
```ts
import { expect, type Page } from '@playwright/test'

export const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
export const SENHA = process.env.SEED_ADMIN_SENHA ?? ''

export async function entrar(page: Page): Promise<void> {
  if (SENHA === '') throw new Error('SEED_ADMIN_SENHA ausente em .env.local')
  await page.goto('/entrar')
  await page.getByLabel('Login').fill(LOGIN)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}
```

`e2e/clientes.spec.ts` (pressupõe `npm run importar:clientes` já rodado no banco de desenvolvimento):
```ts
import { test, expect } from '@playwright/test'
import { entrar } from './apoio'

test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page)
  })

  test('a busca por apelido acha o Bretas e a FACTU', async ({ page }) => {
    await page.goto('/clientes?q=bretas')
    await expect(page.getByRole('link', { name: 'CENCOSUD BRASIL COMERCIAL' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Buscar cliente' }).fill('factu')
    await page.getByRole('searchbox', { name: 'Buscar cliente' }).press('Enter')
    await expect(page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
  })

  test('a busca por telefone acha pelo numero completado', async ({ page }) => {
    await page.goto('/clientes?q=38999681168')
    await expect(page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
  })

  test('cadastrar com telefone repetido avisa, e confirmar cadastra', async ({ page }) => {
    const nome = `Cliente e2e ${Date.now()}`
    await page.goto('/clientes/novo')
    await page.getByLabel('Nome').fill(nome)
    await page.getByLabel('Telefone', { exact: true }).fill('(38) 99968-1168')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const aviso = page.getByRole('alert').filter({ hasText: 'Já existe cadastro com este telefone' })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('ASSOCIAÇÃO DE ENSINO')
    await expect(page).toHaveURL(/\/clientes\/novo/)

    await page.getByLabel('É outra pessoa. Cadastrar mesmo assim.').check()
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: nome })).toBeVisible()
    await expect(page.getByText('(38) 99968-1168')).toBeVisible()
  })

  test('ficha do cliente legado mostra o telefone completado e o original', async ({ page }) => {
    await page.goto('/clientes?q=factu')
    await page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ }).click()
    await expect(page.getByRole('heading', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
    await expect(page.getByText('(38) 99968-1168')).toBeVisible()
    await expect(page.getByText('no legado: (38)9968-1168')).toBeVisible()
    await expect(page.getByText('legado nº 26')).toBeVisible()
  })
})
```

`e2e/materiais.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { entrar } from './apoio'

test.describe('Materiais e preços', () => {
  test('administrador cadastra um material e ve o preco formatado', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Materiais e preços' }).click()
    await expect(page).toHaveURL(/\/materiais$/)

    const nome = `ACM 3mm e2e ${Date.now()}`
    await page.getByLabel('Material').fill(nome)
    await page.getByLabel('Categoria').fill('Placas')
    await page.getByLabel('Preço').fill('281,00')
    await page.getByLabel('Cobrado').selectOption('m2')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const linha = page.getByRole('row', { name: new RegExp(nome) })
    await expect(linha).toContainText('R$ 281,00')
    await expect(linha).toContainText('por m²')

    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(page.getByRole('row', { name: new RegExp(nome) })).toContainText('inativo')
  })
})
```

- [ ] **Step 2: Rodar**

Antes: `npm run db:local:ls` com `drusign` de pé e `npm run importar:clientes` já executado (Task 4).

Run: `npm run e2e`
Expected: `8 passed` (3 da 1B + 4 de clientes + 1 de materiais).

- [ ] **Step 3: Verificação final e commit**

Run: `npm run check` → typecheck, unitários e integração verdes.
Run: `npm run build` → verde.

```bash
git add e2e/
git commit -m "test: clientes e materiais ponta a ponta"
```

---

## Critério de conclusão da Fase 2

Verificação da spec (seção 13): *"busca por apelido acha o Bretas e a FACTU; nenhum telefone com 10 dígitos sobrou; os 1.978 apagados entraram como arquivados."*

- [ ] `clientes-legado.int.test.ts` verde: 3.219 importados, 1.978 arquivados, 3.077 telefones, 1.975 inferidos, **0 celulares com 10 dígitos**, Bretas e FACTU achados por apelido, reimportar não duplica
- [ ] `npm run check` e `npm run build` verdes
- [ ] `npm run e2e` verde: busca por apelido e telefone, aviso de duplicidade, ficha com original e normalizado, catálogo de materiais
- [ ] O banco de desenvolvimento tem os 3.219 clientes (`npm run importar:clientes`)

Feito isso, a Fase 3 (ordem de serviço, entrada assistida, itens, acréscimos, ajuste de preço e impresso) ganha seu próprio plano.
