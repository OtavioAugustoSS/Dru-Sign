# Fase 1B — Fundação: Next.js, banco, autenticação e layout base

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o sistema de pé: Next.js sobre o domínio puro da 1A, PostgreSQL com Prisma e migrações, login por credenciais com Argon2 e sessão em cookie, e o layout base com Tabler — verificado por um teste ponta a ponta que entra, chega na fila de trabalho e sai.

**Architecture:** O domínio (`src/domain/`) continua puro e intocado. Tudo que fala com o mundo — banco, senha, cookie, variáveis de ambiente — vive em `src/infra/`. O Next.js é casca: `src/app/` só monta telas e chama `src/infra/`. Sessão fica **no banco** (tabela `sessao`, cookie carrega só um id opaco), porque é o único modelo que permite desativar um usuário e derrubar a sessão dele na hora. O Postgres de desenvolvimento e teste roda **local, sem Docker**, via `prisma dev` (Prisma Postgres embutido) — a única opção verificada nesta máquina.

**Tech Stack:** Next.js 16.3.3 (App Router, Turbopack) · React 19.2.8 · TypeScript 7.0.2 (já instalado) · Prisma 7.10.0 + `@prisma/adapter-pg` · `@node-rs/argon2` · `@tabler/core` 1.4.0 + `react-bootstrap` 2.10.10 + `@tabler/icons-react` · Geist · Vitest 4 · Playwright 1.62

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 3, 4, 8, 9 e 13)

## Global Constraints

- Dinheiro **sempre** em `Decimal` (decimal.js) no domínio e `numeric(12,4)` no banco. Ponto flutuante em nenhum cálculo monetário.
- Nenhum arquivo em `src/domain/` importa `next`, `react`, `@prisma/client`, `@/generated`, `@/infra` ou toca em I/O. A trava de pureza (`src/domain/pureza.test.ts`) é reforçada na Task 2.
- Dimensões em **metros** dentro do domínio.
- **Nada de `DELETE`** em dado de negócio. A única exceção é a linha de `sessao`, que não é dado de negócio.
- Toda tabela carrega `empresa_id` (spec, seção 4). `Sessao` aponta para `usuario`, que carrega o `empresa_id`.
- Dois papéis apenas: `administracao` e `operacao` (spec, seção 3).
- **TypeScript 7** no repo: sem `baseUrl`, com `"types": ["node"]`, e `it.each` com callback declarando todos os elementos da tupla. Não pinar TS 5. Não setar `experimental.useTypeScriptCli` no Next.
- Versões **exatas** (`--save-exact`) em tudo que este plano instala. Em especial: `npm view prisma` aponta `latest` para `8.0.0-rc`; instalar **sempre** `prisma@7.10.0`.
- Comentários e nomes de domínio em português; palavras-chave da linguagem em inglês.
- Antes de rodar `prisma generate` ou `next build`, **nenhum `next dev` pode estar aberto** (Windows dá EPERM em arquivo em uso).

## O que este plano decide (e por quê)

Cada decisão abaixo foi verificada em fonte primária ou executada nesta máquina em 28/08/2026. O detalhe está no relatório de pesquisa da sessão; aqui fica só o veredito.

| Decisão | Escolha | Motivo |
|---|---|---|
| Next.js com TypeScript 7 | Next 16.3.3 chama o `tsc` local por padrão; `next build` com TS 7.0.2 foi executado com sucesso | Não precisa pinar TS 5 |
| Prisma | 7.10.0 exato, generator `prisma-client` com `output`, driver adapter `@prisma/adapter-pg` (obrigatório na v7) | `latest` do CLI é um RC do Prisma 8 |
| Postgres local | `prisma dev` (PGlite via TCP), duas instâncias: `drusign` (dev) e `drusign-test` (testes) | Sem Docker nem psql na máquina; fornece shadow database para `migrate dev` |
| Argon2 | `@node-rs/argon2` 2.1.0, Argon2id m=19456 t=2 p=1 (perfil OWASP) | Binário pré-compilado; instalou e rodou aqui sem toolchain C++ |
| Sessão | Tabela `sessao` + cookie `drusign_sessao` com id opaco; 12 h | Revogável (desativar usuário derruba a sessão); sem segredo compartilhado |
| Identificação | `login` (spec, seção 4), único, minúsculo | Spec define `login`, não e-mail |
| Rota de login | `/entrar`; retorno via `?proximo=`; home logada é `/` (fila de trabalho) | Vocabulário da loja |
| `proxy.ts` (ex-`middleware.ts`) | Só checa **presença** do cookie; validação real no layout via `exigirUsuario()` | Doc do Next: nunca confiar só no proxy |
| UI | `@tabler/core` só CSS (sem `bootstrap`, sem `tabler.js`); `react-bootstrap` isolado em arquivos `'use client'`; primária `#0E7C93` via `--tblr-*` | Verificado no CSS compilado que só `--tblr-primary` não basta |
| Fonte | Geist via pacote `geist`, aplicada por `--tblr-font-sans-serif` | **Licença OFL 1.1, não MIT** — permissiva, mas a spec precisa registrar |
| Layout | Sidebar vertical à esquerda (como nos artboards em `design/`), usuário embaixo | É o que o Otavio validou visualmente |
| Env | `@next/env` (`loadEnvConfig`) em Prisma CLI, seed e Vitest — nunca `dotenv` | Uma única regra de precedência de `.env*` em todo o repo |
| Testes | Unitário (`*.test.ts`, sem banco), integração (`*.int.test.ts`, banco real, `TRUNCATE` entre testes), e2e (Playwright, `e2e/*.spec.ts`) | `npm test` passa sem banco; integração e e2e exigem o `prisma dev` |

**Desvios conscientes da spec, para o Otavio confirmar na revisão:**

1. **Docker fica para a fase de deploy.** A spec diz "Docker desde o início". Sem Docker nesta máquina, um `Dockerfile` seria código morto não verificável. Entra quando houver como construir a imagem.
2. **ESLint não entra na 1B.** `eslint-config-next` depende do `typescript-eslint`, que usa a API JavaScript do compilador — inexistente no TS 7. Não foi verificado; fica para depois.
3. **Geist é OFL 1.1**, não MIT. O uso comercial é permitido; só não pode vender a fonte isolada.
4. Os artboards de `design/` usam Instrument Sans; a spec diz Geist. O plano segue a spec.
5. `Empresa` nasce só com `razao_social`. CNPJ, endereço, telefone e logo entram na Fase 5, com a tela "Dados da empresa".

## Antes de começar

- Internet: o `npm i` baixa Next, Prisma e Chromium (~280 MB na Task 7).
- Nenhum `DATABASE_URL` é necessário de antemão — a Task 2 cria o banco local.
- `git status` limpo em `main` (só `design/` e `docs/superpowers/specs/` sem versionar, como estão).

---

### Task 1: Next.js sobre o repo existente, com o typecheck e o build verdes no TypeScript 7

Instala o Next.js sem `create-next-app`, ajusta o `tsconfig.json` para JSX/DOM sem perder o que a 1A configurou, troca o `__dirname` do Vitest pelo `import.meta.dirname`, e cria o módulo de variáveis de ambiente — o primeiro habitante de `src/infra/`.

**Files:**
- Modify: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.example`
- Create: `src/infra/env.ts`
- Test: `src/infra/env.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `validarEnv(fonte?: Record<string, string | undefined>): Env` — lança um único `Error` listando tudo que falta
  - `env(): Env` — lazy e memoizado; `Env = { NODE_ENV: 'development' | 'production' | 'test'; DATABASE_URL: string; DIRECT_URL: string | undefined }`
  - scripts `dev`, `build`, `start`, `typecheck` (= `next typegen && tsc --noEmit`)

- [x] **Step 1: Instalar o Next.js e o React com versões exatas**

```bash
npm i --save-exact next@16.3.3 react@19.2.8 react-dom@19.2.8
npm i -D --save-exact @types/react@19.2.18 @types/react-dom@19.2.5
```

Expected: `package.json` com as cinco versões sem `^`. Não mexer em `typescript`, `vitest`, `@types/node` nem `decimal.js`.

- [x] **Step 2: Substituir o `tsconfig.json`**

O Next exige `jsx: react-jsx`, `lib` com `dom`, `next-env.d.ts` e `.next/types` no `include`. Aplicar **antes** do primeiro `next build`, senão o Next reescreve o arquivo por conta própria.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "next.config.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [x] **Step 3: Criar `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

- [x] **Step 4: Atualizar `vitest.config.ts`**

`import.meta.dirname` no lugar de `__dirname` (o Vite avisa a cada execução). O `exclude` impede que o padrão unitário capture os testes de integração e e2e das próximas tasks.

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.int.test.ts', 'e2e/**', '.next/**'],
  },
})
```

- [x] **Step 5: Scripts do `package.json`**

Substituir o bloco `scripts` inteiro por:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsc --noEmit` sozinho falha num checkout limpo porque `next-env.d.ts` e `.next/types` não existem; `next typegen` os gera sem buildar.

- [x] **Step 6: Substituir o `.gitignore`**

```
node_modules/
dist/
.next/
out/
.vercel/

# env: so .env.example e .env.test entram no repo
.env
.env.*
!.env.example
!.env.test

# gerados
next-env.d.ts
tsconfig.tsbuildinfo
src/generated/

# testes
coverage/
test-results/
playwright-report/
blob-report/

*.log
.DS_Store
Thumbs.db
```

- [x] **Step 7: Criar o root layout e a página provisória**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/page.tsx` (provisória; a Task 6 a substitui pela fila de trabalho):
```tsx
export default function PaginaProvisoria() {
  return (
    <main>
      <h1>DruSign</h1>
    </main>
  )
}
```

- [x] **Step 8: Escrever o teste do módulo de ambiente**

`src/infra/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validarEnv } from './env'

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/drusign_test',
}

describe('validarEnv', () => {
  it('aceita a configuracao minima', () => {
    const e = validarEnv(base)
    expect(e.NODE_ENV).toBe('test')
    expect(e.DATABASE_URL).toBe(base.DATABASE_URL)
    expect(e.DIRECT_URL).toBeUndefined()
  })

  it('assume development quando NODE_ENV esta vazio', () => {
    expect(validarEnv({ DATABASE_URL: base.DATABASE_URL }).NODE_ENV).toBe('development')
  })

  it('lista todas as faltas de uma vez', () => {
    expect(() => validarEnv({ NODE_ENV: 'palco' })).toThrow(
      /NODE_ENV invalido[\s\S]*DATABASE_URL ausente/,
    )
  })

  it('rejeita DATABASE_URL que nao e postgres', () => {
    expect(() => validarEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/postgresql/)
  })

  it('rejeita DIRECT_URL invalida, mas aceita ausente', () => {
    expect(() => validarEnv({ ...base, DIRECT_URL: 'nao-e-url' })).toThrow(/DIRECT_URL/)
    expect(validarEnv({ ...base, DIRECT_URL: '' }).DIRECT_URL).toBeUndefined()
  })

  it('devolve um objeto congelado', () => {
    expect(Object.isFrozen(validarEnv(base))).toBe(true)
  })
})
```

- [x] **Step 9: Rodar e ver falhar**

Run: `npm test -- env`
Expected: FAIL — `Cannot find module './env'`

- [x] **Step 10: Criar `src/infra/env.ts`**

```ts
/**
 * Variaveis de ambiente do DruSign.
 * Sem zod: validacao manual, um unico erro listando tudo que falta.
 * Avaliacao lazy (env()) para nao estourar durante `next build`, onde nao ha banco.
 */

export type Ambiente = 'development' | 'production' | 'test'

export interface Env {
  readonly NODE_ENV: Ambiente
  /** Conexao usada pelo PrismaClient em runtime (na Neon, host com -pooler). */
  readonly DATABASE_URL: string
  /** Conexao direta usada so pelo Prisma CLI (migrate). Opcional em runtime. */
  readonly DIRECT_URL: string | undefined
}

const AMBIENTES: readonly string[] = ['development', 'production', 'test']

function ehUrlPostgres(v: string): boolean {
  return /^postgres(ql)?:\/\/.+/.test(v)
}

export function validarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const erros: string[] = []

  const nodeEnvBruto = fonte.NODE_ENV ?? 'development'
  const nodeEnvValido = AMBIENTES.includes(nodeEnvBruto)
  if (!nodeEnvValido) {
    erros.push(`NODE_ENV invalido: "${nodeEnvBruto}" (use development, production ou test)`)
  }
  const NODE_ENV = (nodeEnvValido ? nodeEnvBruto : 'development') as Ambiente

  const DATABASE_URL = fonte.DATABASE_URL ?? ''
  if (DATABASE_URL === '') erros.push('DATABASE_URL ausente')
  else if (!ehUrlPostgres(DATABASE_URL)) erros.push('DATABASE_URL nao e uma URL postgresql://')

  const DIRECT_URL = fonte.DIRECT_URL || undefined
  if (DIRECT_URL !== undefined && !ehUrlPostgres(DIRECT_URL)) {
    erros.push('DIRECT_URL nao e uma URL postgresql://')
  }

  if (erros.length > 0) {
    throw new Error(
      `Configuracao de ambiente invalida:\n  - ${erros.join('\n  - ')}\n` +
        'Veja .env.example para o formato esperado.',
    )
  }

  return Object.freeze({ NODE_ENV, DATABASE_URL, DIRECT_URL })
}

let cache: Env | undefined

/** Lazy e memoizado: lanca na primeira leitura se faltar algo. */
export function env(): Env {
  if (!cache) cache = validarEnv()
  return cache
}
```

- [x] **Step 11: Rodar e ver passar**

Run: `npm test -- env`
Expected: PASS — 6 passed

- [x] **Step 12: Criar `.env.example`**

```
# Copie para .env.local e preencha. .env.local nunca e versionado.
# Ordem de leitura (Next, Prisma CLI e Vitest usam a mesma):
#   .env.<modo>.local > .env.local > .env.<modo> > .env
# Em modo test o .env.local e IGNORADO: use .env.test.local.

# Conexao usada pela aplicacao em runtime.
#  - Local: `npm run db:local` imprime a URL (a porta varia por instancia), no formato
#    postgres://postgres:postgres@localhost:51218/template1?sslmode=disable
#  - Neon (branch, host com -pooler):
#    postgresql://USER:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL=

# Conexao DIRETA usada so pelo Prisma CLI (migrate). Local: igual a DATABASE_URL. Neon: sem -pooler.
DIRECT_URL=

# Usado so pelo seed (npm run db:seed) para criar o primeiro administrador.
SEED_ADMIN_LOGIN=admin
SEED_ADMIN_SENHA=
```

- [x] **Step 13: Rodar typecheck, suíte e build**

Run: `npm run typecheck`
Expected: `next typegen` gera `next-env.d.ts`; `tsc --noEmit` sem erros.

Run: `npm test`
Expected: PASS — todos os arquivos da 1A mais `env.test.ts`; sem o aviso do Vite sobre `__dirname`.

Run: `npm run build`
Expected: build conclui com `Running TypeScript` … `Finished TypeScript` e a rota `/` listada. Depois, `git status` **não** pode mostrar `tsconfig.json` modificado — se mostrar, o Next reescreveu algo; ler o diff, entender, e manter o resultado.

- [x] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore next.config.ts .env.example src/app/ src/infra/
git commit -m "feat: Next.js 16 sobre o dominio puro, com typecheck e build no TypeScript 7"
```

---

### Task 2: Prisma 7, Postgres local sem Docker, primeira migração e harness de integração

Cria o schema (`Empresa`, `Usuario`, `Sessao`, enum `Papel`), sobe o Postgres local com `prisma dev`, aplica a migração inicial, e monta o harness de testes de integração que trunca as tabelas entre testes. Fecha com o reforço da trava de pureza.

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `.env.test`
- Create: `src/infra/carrega-env.ts`, `src/infra/db/prisma.ts`, `src/infra/db/decimal.ts`, `src/instrumentation.ts`
- Create: `vitest.config.integration.ts`, `src/infra/test/integracao-global.ts`, `src/infra/test/integracao-setup.ts`
- Modify: `package.json`, `next.config.ts`, `tsconfig.json`, `src/domain/pureza.test.ts`
- Test: `src/infra/db/decimal.test.ts`, `src/infra/db/usuario.int.test.ts`

**Interfaces:**
- Consumes: `env()` da Task 1
- Produces:
  - `prisma: PrismaClient` — singleton com driver adapter, em `@/infra/db/prisma`
  - `paraDominio(v: Prisma.Decimal): Decimal` e `paraBanco(v: Decimal): Prisma.Decimal` — conversão sem perda, sempre por string
  - modelos `Empresa { id, razaoSocial, criadoEm, atualizadoEm, arquivadoEm }`, `Usuario { id, empresaId, nome, login, senhaHash, papel, ativo, criadoEm, atualizadoEm }`, `Sessao { id, usuarioId, criadoEm, expiraEm }`
  - scripts `db:*`, `test:int`, `postinstall`

- [x] **Step 1: Instalar o Prisma com versões exatas**

```bash
npm i --save-exact @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.23.0 @next/env@16.3.3
npm i -D --save-exact prisma@7.10.0 tsx@4.23.12 @types/pg
```

Expected: `npm ls prisma @prisma/client` mostra `7.10.0` nos dois. Se aparecer `8.0.0-rc`, a versão não foi pinada — refazer.

- [x] **Step 2: Criar `prisma/schema.prisma`**

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  runtime             = "nodejs"
  moduleFormat        = "esm"
  importFileExtension = "ts"
}

datasource db {
  provider = "postgresql"
  // A URL fica em prisma.config.ts (Prisma 7).
}

/// Dois papeis, nao mais (spec, secao 3).
enum Papel {
  administracao
  operacao

  @@map("papel")
}

/// O que sai no cabecalho do impresso. CNPJ, endereco, telefone e logo entram na Fase 5.
model Empresa {
  id           String    @id @default(uuid(7)) @db.Uuid
  razaoSocial  String    @map("razao_social") @db.VarChar(160)
  criadoEm     DateTime  @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm DateTime  @updatedAt @map("atualizado_em") @db.Timestamptz(3)
  arquivadoEm  DateTime? @map("arquivado_em") @db.Timestamptz(3)

  usuarios Usuario[]

  @@map("empresa")
}

model Usuario {
  id           String   @id @default(uuid(7)) @db.Uuid
  empresaId    String   @map("empresa_id") @db.Uuid
  empresa      Empresa  @relation(fields: [empresaId], references: [id])
  nome         String   @db.VarChar(120)
  login        String   @unique @db.VarChar(64)
  senhaHash    String   @map("senha_hash")
  papel        Papel    @default(operacao)
  ativo        Boolean  @default(true)
  criadoEm     DateTime @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm DateTime @updatedAt @map("atualizado_em") @db.Timestamptz(3)

  sessoes Sessao[]

  @@index([empresaId])
  @@map("usuario")
}

/// Sessao no banco: o cookie carrega so o id opaco. Nao e dado de negocio — pode ser apagada.
model Sessao {
  id        String   @id @db.VarChar(64)
  usuarioId String   @map("usuario_id") @db.Uuid
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  criadoEm  DateTime @default(now()) @map("criado_em") @db.Timestamptz(3)
  expiraEm  DateTime @map("expira_em") @db.Timestamptz(3)

  @@index([usuarioId])
  @@map("sessao")
}
```

- [x] **Step 3: Criar `prisma.config.ts`**

```ts
import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'prisma/config'

// Mesma ordem de leitura do Next: .env.<modo>.local > .env.local > .env.<modo> > .env
loadEnvConfig(process.cwd())

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // O CLI (migrate) precisa de conexao direta (na Neon, sem -pooler).
    // Sem env(): `prisma generate` nao pode quebrar quando nao ha banco (postinstall na Vercel).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
})
```

Adicionar `"prisma.config.ts"` ao `include` do `tsconfig.json`, logo depois de `"next.config.ts"`.

- [x] **Step 4: Scripts do banco e `.env.test`**

Acrescentar ao bloco `scripts` do `package.json` (mantendo os existentes):

```json
{
  "scripts": {
    "test:int": "vitest run -c vitest.config.integration.ts",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:local": "prisma dev -n drusign --detach",
    "db:local:test": "prisma dev -n drusign-test --detach",
    "db:local:ls": "prisma dev ls"
  }
}
```

**Ainda não** adicionar `postinstall` — isso é o Step 14, depois que tudo existir.

`.env.test` (versionado; os valores locais reais vão em `.env.test.local`, que não é):
```
# Banco de TESTE. Localmente, sobrescreva DATABASE_URL e DIRECT_URL em .env.test.local
# com a URL que `npm run db:local:test` imprimir. Este arquivo e o padrao para CI.
DATABASE_URL=postgresql://drusign:drusign@localhost:5432/drusign_test
DIRECT_URL=postgresql://drusign:drusign@localhost:5432/drusign_test
```

- [x] **Step 5: Subir os dois Postgres locais e apontar os `.env`**

Run: `npm run db:local`
Expected: na primeira vez baixa os binários; ao final imprime uma URL no formato `postgres://postgres:postgres@localhost:<porta>/template1?sslmode=disable`. Colar a saída real.

Run: `npm run db:local:test`
Expected: outra URL, com **outra porta**.

Run: `npm run db:local:ls`
Expected: as duas instâncias (`drusign` e `drusign-test`) listadas com suas portas.

Criar `.env.local` (não versionado) com a URL da instância `drusign` em **ambas** as variáveis, e a senha do administrador local:
```
DATABASE_URL=<URL impressa por db:local>
DIRECT_URL=<a mesma URL>
SEED_ADMIN_LOGIN=admin
SEED_ADMIN_SENHA=drusign-dev-2026
```

Criar `.env.test.local` (não versionado) com a URL da instância `drusign-test`:
```
DATABASE_URL=<URL impressa por db:local:test>
DIRECT_URL=<a mesma URL>
```

> Se as instâncias forem paradas e recriadas, a porta pode mudar: conferir com `npm run db:local:ls` e atualizar os dois arquivos.

- [x] **Step 6: Gerar o client e aplicar a migração inicial**

Run: `npm run db:generate`
Expected: `Generated Prisma Client (7.10.0) to ./src/generated/prisma`. A pasta `src/generated/` fica fora do git.

Run: `npm run db:migrate -- --name init`
Expected: cria `prisma/migrations/<timestamp>_init/migration.sql` e `prisma/migrations/migration_lock.toml`, e aplica no banco `drusign`. Colar a saída. Conferir no SQL gerado: `CREATE TYPE "papel" AS ENUM ('administracao', 'operacao')`, tabelas `empresa`, `usuario` e `sessao`, `"login"` com índice único, `"expira_em" TIMESTAMPTZ(3)`.

- [x] **Step 7: Escrever o teste da conversão de Decimal**

`src/infra/db/decimal.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { Prisma } from '@/generated/prisma/client'
import { paraBanco, paraDominio } from './decimal'

describe('conversao de Decimal entre banco e dominio', () => {
  // Prisma.Decimal e um decimal.js empacotado, mas e outra classe: instanceof falha entre eles.
  it.each(['12.3456', '0.0001', '99999999.9999', '0', '1234.5'])('ida e volta preserva %s', (texto) => {
    const dominio = new Decimal(texto)
    const banco = paraBanco(dominio)
    expect(banco).toBeInstanceOf(Prisma.Decimal)
    expect(banco.toFixed()).toBe(dominio.toFixed())

    const volta = paraDominio(banco)
    expect(volta).toBeInstanceOf(Decimal)
    expect(volta.equals(dominio)).toBe(true)
  })

  it('nao passa por ponto flutuante', () => {
    const banco = paraBanco(new Decimal('0.1').plus('0.2'))
    expect(banco.toFixed()).toBe('0.3')
  })
})
```

- [x] **Step 8: Rodar e ver falhar**

Run: `npm test -- decimal`
Expected: FAIL — `Cannot find module './decimal'`

- [x] **Step 9: Criar `src/infra/db/decimal.ts`**

```ts
import Decimal from 'decimal.js'
import { Prisma } from '@/generated/prisma/client'

/**
 * Banco -> dominio. Prisma.Decimal e um decimal.js empacotado dentro do Prisma,
 * mas e outra classe: `instanceof` falha e o TypeScript recusa a atribuicao.
 * A conversao e sempre por string; nunca por Number.
 */
export function paraDominio(valor: Prisma.Decimal): Decimal {
  return new Decimal(valor.toFixed())
}

/** Dominio -> banco. `toFixed()` sem argumento e a representacao exata, sem notacao cientifica. */
export function paraBanco(valor: Decimal): Prisma.Decimal {
  return new Prisma.Decimal(valor.toFixed())
}
```

- [x] **Step 10: Rodar e ver passar**

Run: `npm test -- decimal`
Expected: PASS — 6 passed

- [x] **Step 11: Reforçar a trava de pureza**

Em `src/domain/pureza.test.ts`, trocar a linha de `PROIBIDOS` por:

```ts
const PROIBIDOS = ['next', 'react', '@prisma/client', '@/generated', '@/infra', 'node:fs', 'node:http']
```

Run: `npm test -- pureza`
Expected: PASS — 1 passed (o domínio da 1A não importa nada disso).

> Nota de execução (2026-08-28): o arquivo commitado na 1A tinha a regex corrompida — o heredoc do shell colapsa barra dupla em barra simples, e `from\s+` dentro de template literal vira `from s+`; a trava nunca tinha casado com nada. Reescrita pela ferramenta de edição e provada com uma violação temporária (`import ... from 'next/headers'` em `src/domain/`): vermelho com ela, verde sem ela. Regra daqui em diante: arquivo com barra dupla nunca sai de heredoc.

- [x] **Step 12: Escrever o harness de integração e o primeiro teste com banco real**

`src/infra/carrega-env.ts`:
```ts
import { loadEnvConfig } from '@next/env'

// Fora do Next (Prisma CLI, seed, Vitest) carregamos os .env com a mesma ordem que o Next usa.
// Com NODE_ENV=test: .env.test.local > .env.test > .env (o .env.local e ignorado de proposito).
loadEnvConfig(process.cwd())
```

`vitest.config.integration.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    // Um banco so, compartilhado: os arquivos rodam em serie.
    fileParallelism: false,
    globalSetup: ['src/infra/test/integracao-global.ts'],
    setupFiles: ['src/infra/test/integracao-setup.ts'],
    testTimeout: 20_000,
  },
})
```

`src/infra/test/integracao-global.ts`:
```ts
import { execSync } from 'node:child_process'
import { loadEnvConfig } from '@next/env'

/** Roda uma vez antes da suite: carrega .env.test(.local) e aplica as migracoes no banco de teste. */
export default function setup(): void {
  process.env.NODE_ENV ??= 'test'
  loadEnvConfig(process.cwd())
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente. Rode `npm run db:local:test` e copie a URL para .env.test.local')
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
```

> Nota de execução (2026-08-28): a linha `process.env.NODE_ENV ??= 'test'` não compila — os tipos do Next declaram `NODE_ENV` somente leitura (TS2540). Removida; o Vitest já define `NODE_ENV=test`.

`src/infra/test/integracao-setup.ts`:
```ts
import { afterAll, beforeEach } from 'vitest'
import '@/infra/carrega-env'
import { prisma } from '@/infra/db/prisma'

/** TRUNCATE em todas as tabelas (menos a de migracoes) antes de cada teste. */
async function limparBanco(): Promise<void> {
  const linhas = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  const tabelas = linhas
    .map((l) => l.tablename)
    .filter((n) => n !== '_prisma_migrations')
    .map((n) => `"public"."${n}"`)
    .join(', ')
  if (tabelas.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE;`)
  }
}

beforeEach(async () => {
  await limparBanco()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

`src/infra/db/usuario.int.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/infra/db/prisma'

describe('usuario (banco real)', () => {
  it('nasce ativo, com papel operacao e preso a uma empresa', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    const usuario = await prisma.usuario.create({
      data: { empresaId: empresa.id, nome: 'Ana', login: 'ana', senhaHash: 'x' },
    })
    expect(usuario.papel).toBe('operacao')
    expect(usuario.ativo).toBe(true)
    expect(usuario.empresaId).toBe(empresa.id)
  })

  it('login e unico', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    await prisma.usuario.create({
      data: { empresaId: empresa.id, nome: 'Ana', login: 'ana', senhaHash: 'x' },
    })
    await expect(
      prisma.usuario.create({
        data: { empresaId: empresa.id, nome: 'Outra Ana', login: 'ana', senhaHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('o TRUNCATE entre testes deixa o banco vazio', async () => {
    expect(await prisma.usuario.count()).toBe(0)
    expect(await prisma.empresa.count()).toBe(0)
  })
})
```

- [x] **Step 13: Rodar e ver falhar, criar o client, rodar e ver passar**

Run: `npm run test:int`
Expected: FAIL — o `globalSetup` aplica as migrações no banco `drusign-test` (`1 migration found` … `applied`), e depois `Cannot find module '@/infra/db/prisma'`.

Criar `src/infra/db/prisma.ts`:
```ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from '@/infra/env'

function criarClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL })
  return new PrismaClient({ adapter })
}

// Uma instancia so, mesmo com o hot reload do `next dev`.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalParaPrisma.prisma ?? criarClient()

if (env().NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
```

Run: `npm run test:int`
Expected: PASS — 3 passed

- [x] **Step 14: Instrumentação, externals e `postinstall`**

`src/instrumentation.ts` (raiz de `src/`, nunca em `domain/`):
```ts
/** Roda uma vez quando o servidor Next sobe: valida o ambiente cedo, em vez de na primeira consulta. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/infra/env')
    env()
  }
}
```

Em `next.config.ts`, acrescentar os pacotes nativos que o Turbopack não deve empacotar:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
}

export default nextConfig
```

Só agora, no `package.json`, acrescentar aos `scripts`:
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```
(`build` substitui o anterior; `postinstall` é novo.)

- [x] **Step 15: Verificação completa**

Run: `npm run typecheck`
Expected: sem erros (o client gerado tem `// @ts-nocheck`; `prisma.config.ts` entra no include).

Run: `npm test`
Expected: PASS — tudo da 1A + `env` + `decimal` + `pureza`; **nenhum** `*.int.test.ts` executado.

Run: `npm run test:int`
Expected: PASS — 3 passed

Run: `npm run build`
Expected: `prisma generate` e depois o build verde.

- [x] **Step 16: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts prisma/ prisma.config.ts .env.test vitest.config.integration.ts src/infra/ src/instrumentation.ts src/domain/pureza.test.ts
git commit -m "feat: Prisma 7 com Postgres local, migracao inicial e harness de integracao"
```

Conferir com `git status` que `.env.local`, `.env.test.local` e `src/generated/` ficaram de fora.

---

### Task 3: Senha com Argon2 e o seed do primeiro administrador

**Files:**
- Create: `src/infra/auth/senha.ts`, `prisma/seed.ts`
- Modify: `next.config.ts`
- Test: `src/infra/auth/senha.test.ts`

**Interfaces:**
- Consumes: `prisma` da Task 2
- Produces:
  - `hashSenha(senha: string): Promise<string>` — PHC `$argon2id$v=19$m=19456,t=2,p=1$…`; lança em senha vazia
  - `verificarSenha(hashArmazenado: string, senha: string): Promise<boolean>` — nunca lança
  - `hashDummy(): Promise<string>` — hash válido para verificar quando o login não existe (tempo constante)
  - `npm run db:seed` cria a empresa e o usuário `admin` (papel `administracao`) a partir de `SEED_ADMIN_LOGIN` / `SEED_ADMIN_SENHA`

- [x] **Step 1: Instalar o Argon2**

```bash
npm i --save-exact @node-rs/argon2@2.1.0
```

Expected: `node_modules/@node-rs/argon2-win32-x64-msvc` presente (binário pré-compilado; nada de node-gyp). Nunca instalar com `--no-optional`.

- [x] **Step 2: Escrever o teste, real e sem mock**

`src/infra/auth/senha.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hashSenha, verificarSenha, hashDummy } from './senha'

describe('senha (argon2id real, sem mock)', () => {
  it('gera hash PHC argon2id com os parametros OWASP e verifica a senha correta', async () => {
    const h = await hashSenha('Segredo!2026')
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    expect(await verificarSenha(h, 'Segredo!2026')).toBe(true)
  })

  it('rejeita senha errada', async () => {
    const h = await hashSenha('Segredo!2026')
    expect(await verificarSenha(h, 'segredo!2026')).toBe(false)
  })

  it('dois hashes da mesma senha sao diferentes (salt) e ambos verificam', async () => {
    const [a, b] = await Promise.all([hashSenha('x'), hashSenha('x')])
    expect(a).not.toBe(b)
    expect(await verificarSenha(a, 'x')).toBe(true)
    expect(await verificarSenha(b, 'x')).toBe(true)
  })

  it('hash invalido devolve false em vez de lancar', async () => {
    expect(await verificarSenha('nao-e-um-hash', 'x')).toBe(false)
  })

  it('senha vazia e recusada no hash', async () => {
    await expect(hashSenha('')).rejects.toThrow('senha vazia')
  })

  it('o hash dummy e um argon2id valido e nao confere com uma senha qualquer', async () => {
    const h = await hashDummy()
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    expect(await verificarSenha(h, 'qualquer-coisa')).toBe(false)
    expect(await hashDummy()).toBe(h) // memoizado
  })
})
```

- [x] **Step 3: Rodar e ver falhar**

Run: `npm test -- senha`
Expected: FAIL — `Cannot find module './senha'`

- [x] **Step 4: Criar `src/infra/auth/senha.ts`**

```ts
import { Algorithm, hash, verify } from '@node-rs/argon2'

/** Perfil OWASP (Password Storage Cheat Sheet): Argon2id, m = 19 MiB, t = 2, p = 1. ~65 ms por hash. */
const PARAMETROS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashSenha(senha: string): Promise<string> {
  if (senha.length === 0) throw new Error('senha vazia')
  return hash(senha, PARAMETROS)
}

export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha)
  } catch {
    // hash malformado conta como senha invalida
    return false
  }
}

let dummy: Promise<string> | undefined

/**
 * Hash de referencia para quando o login nao existe: a verificacao demora o mesmo
 * tempo que uma verificacao real, e o tempo de resposta nao revela quais logins existem.
 */
export function hashDummy(): Promise<string> {
  dummy ??= hash('senha-que-nunca-e-usada', PARAMETROS)
  return dummy
}
```

- [x] **Step 5: Rodar e ver passar**

Run: `npm test -- senha`
Expected: PASS — 6 passed (uns 5–8 s: é Argon2 de verdade)

> Nota de execução (2026-08-28): `Algorithm.Argon2id` é um const enum ambiente e o `isolatedModules` recusa (TS2748). O campo `algorithm` foi retirado de `PARAMETROS` — Argon2id é o padrão da lib, e o teste do prefixo `$argon2id$` garante isso. Os 6 testes rodaram em ~0,7 s, não 5–8 s.

- [x] **Step 6: Criar o seed e registrar o pacote nativo no Next**

`prisma/seed.ts`:
```ts
// A ordem dos imports importa: carrega-env precisa rodar antes de prisma.ts avaliar env().
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { hashSenha } from '../src/infra/auth/senha'

const EMPRESA_ID = '01900000-0000-7000-8000-000000000001'

async function main(): Promise<void> {
  const login = (process.env.SEED_ADMIN_LOGIN ?? 'admin').trim().toLowerCase()
  const senha = process.env.SEED_ADMIN_SENHA
  if (!senha || senha.length < 8) {
    throw new Error('Defina SEED_ADMIN_SENHA (minimo 8 caracteres) em .env.local ou no ambiente')
  }

  const empresa = await prisma.empresa.upsert({
    where: { id: EMPRESA_ID },
    update: {},
    create: { id: EMPRESA_ID, razaoSocial: 'DruSign Placas e Comunicacao Visual' },
  })

  // Idempotente: rodar de novo nao troca a senha de quem ja existe.
  const usuario = await prisma.usuario.upsert({
    where: { login },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Administrador',
      login,
      senhaHash: await hashSenha(senha),
      papel: 'administracao',
    },
  })

  console.log(`empresa "${empresa.razaoSocial}" e usuario "${usuario.login}" (${usuario.papel}) prontos`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

Em `next.config.ts`, acrescentar `'@node-rs/argon2'` à lista:
```ts
serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', '@node-rs/argon2'],
```

- [x] **Step 7: Rodar o seed no banco de desenvolvimento**

Run: `npm run db:seed`
Expected: `empresa "DruSign Placas e Comunicacao Visual" e usuario "admin" (administracao) prontos` e, do Prisma, `The seed command has been executed`.

> Nota de execução (2026-08-28): sob o `tsx`, `import { loadEnvConfig } from '@next/env'` falha (`does not provide an export named`): o pacote é CommonJS empacotado. `src/infra/carrega-env.ts` passou a carregá-lo com `createRequire`. Nos arquivos que rodam dentro do Vite/Vitest o import nomeado continua funcionando.

Run: `npm run db:seed` (de novo)
Expected: a mesma mensagem, sem erro — o seed é idempotente.

- [x] **Step 8: Verificação e commit**

Run: `npm run typecheck` → sem erros.
Run: `npm test` → PASS, incluindo `senha`.

```bash
git add package.json package-lock.json next.config.ts prisma/seed.ts src/infra/auth/
git commit -m "feat: senha com Argon2id e seed do primeiro administrador"
```

---

### Task 4: Sessão no banco e o destino seguro do redirecionamento

A lógica de sessão fica separada do Next: `sessao.ts` só conhece o banco, e é testada contra ele. A cola com `cookies()` vem na Task 6.

**Files:**
- Create: `src/domain/usuarios/tipos.ts`, `src/infra/auth/sessao.ts`, `src/infra/auth/destino.ts`
- Test: `src/infra/auth/sessao.int.test.ts`, `src/infra/auth/destino.test.ts`

**Interfaces:**
- Consumes: `prisma` da Task 2
- Produces:
  - `type PapelUsuario = 'administracao' | 'operacao'` (domínio)
  - `interface UsuarioSessao { id; empresaId; login; nome; papel: PapelUsuario }`
  - `criarSessao(usuarioId, agora?): Promise<{ id; expiraEm }>`, `validarSessao(id, agora?): Promise<UsuarioSessao | null>`, `encerrarSessao(id): Promise<void>`, `DURACAO_SESSAO_SEGUNDOS = 43200`
  - `destinoSeguro(proximo: unknown, padrao = '/'): string`

- [x] **Step 1: Tipo de papel no domínio**

`src/domain/usuarios/tipos.ts`:
```ts
/** Dois papeis, nao mais (spec, secao 3). O enum do Prisma tem os mesmos literais. */
export type PapelUsuario = 'administracao' | 'operacao'
```

- [x] **Step 2: Escrever o teste do destino seguro**

`src/infra/auth/destino.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { destinoSeguro } from './destino'

describe('destinoSeguro', () => {
  it.each([
    ['/ordens/18461', '/ordens/18461'],
    ['/', '/'],
    ['/entrar?proximo=%2F', '/entrar?proximo=%2F'],
  ])('aceita caminho interno %s', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado)
  })

  it.each([
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['evil.com', '/'],
    ['', '/'],
    [undefined, '/'],
    [null, '/'],
    [42, '/'],
  ])('rejeita %s e devolve o padrao', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado)
  })

  it('aceita outro padrao', () => {
    expect(destinoSeguro(undefined, '/entrar')).toBe('/entrar')
  })
})
```

- [x] **Step 3: Rodar e ver falhar**

Run: `npm test -- destino`
Expected: FAIL — `Cannot find module './destino'`

- [x] **Step 4: Criar `src/infra/auth/destino.ts`**

```ts
/**
 * Aceita so caminho interno: comeca com uma barra e nao com duas nem com barra invertida
 * (navegadores tratam "/\evil.com" como "//evil.com"). Evita open redirect no ?proximo=.
 */
export function destinoSeguro(proximo: unknown, padrao = '/'): string {
  if (
    typeof proximo === 'string' &&
    proximo.startsWith('/') &&
    !proximo.startsWith('//') &&
    !proximo.startsWith('/\\')
  ) {
    return proximo
  }
  return padrao
}
```

- [x] **Step 5: Rodar e ver passar**

Run: `npm test -- destino`
Expected: PASS — 12 passed

- [x] **Step 6: Escrever o teste de integração da sessão**

`src/infra/auth/sessao.int.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { criarSessao, validarSessao, encerrarSessao, DURACAO_SESSAO_SEGUNDOS } from './sessao'

async function criarUsuario(ativo = true) {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  return prisma.usuario.create({
    data: { empresaId: empresa.id, nome: 'Odete', login: 'odete', senhaHash: 'x', papel: 'administracao', ativo },
  })
}

describe('sessao no banco', () => {
  it('cria e valida uma sessao de 12 horas', async () => {
    const usuario = await criarUsuario()
    const agora = new Date('2026-08-28T08:00:00-03:00')
    const { id, expiraEm } = await criarSessao(usuario.id, agora)

    expect(id).toHaveLength(43) // 32 bytes em base64url
    expect(expiraEm.getTime() - agora.getTime()).toBe(DURACAO_SESSAO_SEGUNDOS * 1000)
    expect(DURACAO_SESSAO_SEGUNDOS).toBe(12 * 60 * 60)

    expect(await validarSessao(id, agora)).toEqual({
      id: usuario.id,
      empresaId: usuario.empresaId,
      login: 'odete',
      nome: 'Odete',
      papel: 'administracao',
    })
  })

  it('rejeita sessao expirada', async () => {
    const usuario = await criarUsuario()
    const agora = new Date('2026-08-28T08:00:00-03:00')
    const { id } = await criarSessao(usuario.id, agora)
    const noLimite = new Date(agora.getTime() + DURACAO_SESSAO_SEGUNDOS * 1000)
    expect(await validarSessao(id, noLimite)).toBeNull()
  })

  it('rejeita sessao de usuario desativado', async () => {
    const usuario = await criarUsuario()
    const { id } = await criarSessao(usuario.id)
    await prisma.usuario.update({ where: { id: usuario.id }, data: { ativo: false } })
    expect(await validarSessao(id)).toBeNull()
  })

  it('rejeita id ausente ou desconhecido', async () => {
    expect(await validarSessao(undefined)).toBeNull()
    expect(await validarSessao('nao-existe')).toBeNull()
  })

  it('encerrar apaga a sessao e e idempotente', async () => {
    const usuario = await criarUsuario()
    const { id } = await criarSessao(usuario.id)
    await encerrarSessao(id)
    expect(await validarSessao(id)).toBeNull()
    await encerrarSessao(id)
    await encerrarSessao(undefined)
    expect(await prisma.sessao.count()).toBe(0)
  })
})
```

- [x] **Step 7: Rodar e ver falhar**

Run: `npm run test:int -- sessao`
Expected: FAIL — `Cannot find module './sessao'`

- [x] **Step 8: Criar `src/infra/auth/sessao.ts`**

```ts
import { randomBytes } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { PapelUsuario } from '@/domain/usuarios/tipos'

/** Turno de trabalho: 12 h. Com sessao no banco, `expiraEm` e a fonte de verdade; o cookie so espelha. */
export const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60

export interface UsuarioSessao {
  id: string
  empresaId: string
  login: string
  nome: string
  papel: PapelUsuario
}

export interface SessaoCriada {
  id: string
  expiraEm: Date
}

/** Cria a linha em `sessao` com um id opaco de 32 bytes. Quem chama grava o id no cookie. */
export async function criarSessao(usuarioId: string, agora: Date = new Date()): Promise<SessaoCriada> {
  const id = randomBytes(32).toString('base64url')
  const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_SEGUNDOS * 1000)
  await prisma.sessao.create({ data: { id, usuarioId, expiraEm } })
  return { id, expiraEm }
}

/** Valida no banco: a sessao existe, nao expirou e o usuario continua ativo. */
export async function validarSessao(
  id: string | undefined,
  agora: Date = new Date(),
): Promise<UsuarioSessao | null> {
  if (!id) return null
  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      usuario: { select: { id: true, empresaId: true, login: true, nome: true, papel: true, ativo: true } },
    },
  })
  if (!sessao || sessao.expiraEm <= agora || !sessao.usuario.ativo) return null

  const { id: usuarioId, empresaId, login, nome, papel } = sessao.usuario
  return { id: usuarioId, empresaId, login, nome, papel }
}

/** Apagar uma sessao nao e apagar dado de negocio: e o unico DELETE permitido no sistema. */
export async function encerrarSessao(id: string | undefined): Promise<void> {
  if (!id) return
  await prisma.sessao.deleteMany({ where: { id } })
}
```

- [x] **Step 9: Rodar e ver passar**

Run: `npm run test:int`
Expected: PASS — 8 passed (3 de `usuario` + 5 de `sessao`)

- [x] **Step 10: Verificação e commit**

Run: `npm run typecheck` → sem erros.
Run: `npm test` → PASS (`destino` incluso; `pureza` continua verde com `src/domain/usuarios/tipos.ts`).

```bash
git add src/domain/usuarios/ src/infra/auth/
git commit -m "feat: sessao revogavel no banco e destino seguro de redirecionamento"
```

---

### Task 5: Tabler, tema DruSign e Geist no root layout

Só CSS e fonte: nenhum comportamento novo. A verificação é o build e a inspeção do HTML gerado.

**Files:**
- Create: `src/app/tema.css`
- Modify: `src/app/layout.tsx`, `package.json`

**Interfaces:**
- Consumes: nada
- Produces: todas as classes do Tabler disponíveis em qualquer página; `--tblr-primary` = `#0E7C93`; `--tblr-font-sans-serif` = Geist; `--font-geist-mono` disponível para números tabulares

- [ ] **Step 1: Instalar as dependências de UI**

```bash
npm i --save-exact @tabler/core@1.4.0 react-bootstrap@2.10.10 @tabler/icons-react@3.46.0 geist@1.7.2
```

**Não** instalar `bootstrap`: o `@tabler/core` já é o Bootstrap 5.3 recompilado com prefixo `--tblr-`. Se o npm avisar `TAR_ENTRY_ERROR ENOENT` em `dist/libs/nouislider` (caminho longo do Windows), é só aviso — conferir que `node_modules/@tabler/core/dist/css/tabler.min.css` existe e seguir.

- [ ] **Step 2: Criar `src/app/tema.css`**

Só `--tblr-primary` não basta: vários tons ficam fixos em azul no CSS compilado. Esta é a lista completa.

```css
:root {
  /* Fonte: Geist, injetada pelo next/font como --font-geist-sans no <html> */
  --tblr-font-sans-serif: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  --tblr-font-monospace: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Cor primaria DruSign (spec, secao 8): #0E7C93 tem 4,86:1 sobre branco */
  --tblr-primary: #0E7C93;
  --tblr-primary-rgb: 14, 124, 147;
  --tblr-primary-fg: #ffffff;
  --tblr-primary-darken: #0A6478;          /* hover/active de .btn-primary */
  --tblr-primary-lt: #E4F2F6;              /* .bg-primary-lt, badges, avatares */
  --tblr-primary-lt-rgb: 228, 242, 246;
  --tblr-primary-200: rgba(14, 124, 147, 0.2);
  --tblr-primary-text-emphasis: #0A6478;
  --tblr-primary-bg-subtle: #E4F2F6;
  --tblr-primary-border-subtle: #9FD0DB;

  /* Links */
  --tblr-link-color: #0E7C93;
  --tblr-link-color-rgb: 14, 124, 147;
  --tblr-link-hover-color: #0A6478;
  --tblr-link-hover-color-rgb: 10, 100, 120;

  /* Foco (btn, form-control, form-select, form-check) */
  --tblr-focus-ring-color: rgba(14, 124, 147, 0.25);
}

/* O Tabler 1.4.0 fixa a borda de foco em azul; alinhar a primaria */
.form-control:focus,
.form-select:focus,
.form-check-input:focus {
  border-color: #0E7C93;
}

/* Numeros alinhados a direita, com digitos tabulares (spec, secao 7) */
.numero {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

- [ ] **Step 3: Atualizar `src/app/layout.tsx`**

A ordem dos imports importa: `tema.css` depois de `tabler.min.css`, porque os dois declaram `:root` e o último vence. `GeistSans.variable` vai no `<html>`; **não** usar `GeistSans.className` no `<body>`, senão a fonte é aplicada inline e o Tabler perde o controle via `--tblr-font-sans-serif`.

```tsx
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@tabler/core/dist/css/tabler.min.css'
import './tema.css'

export const metadata: Metadata = {
  title: { default: 'DruSign', template: '%s · DruSign' },
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Build e inspeção**

Run: `npm run build`
Expected: verde.

Run: `npx next start -p 3000` em segundo plano; depois `curl -s http://localhost:3000/ | grep -o 'tabler[^"]*\.css\|--font-geist-sans[^;"]*' | head -5`; depois parar o servidor.
Expected: aparece o link do CSS do Tabler e a classe com `--font-geist-sans` no `<html>`. (O Turbopack pode juntar os CSS num só arquivo `/_next/static/…/*.css`; nesse caso, `curl` esse arquivo e confirmar com `grep -c 'tblr-primary:#0E7C93'` ≥ 1.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/tema.css
git commit -m "feat: Tabler com tema DruSign e fonte Geist no layout raiz"
```

---

### Task 6: Entrar, sair, proxy e o shell da área logada

Junta tudo: a página `/entrar` com Server Action, o `proxy.ts` que barra quem não tem cookie, o layout com a sidebar vertical e o menu do usuário, e a home `/` como fila de trabalho (vazia, honesta).

**Files:**
- Create: `src/infra/auth/constantes.ts`, `src/infra/auth/cookie-sessao.ts`, `src/infra/auth/usuario-atual.ts`, `src/proxy.ts`
- Create: `src/app/(auth)/entrar/page.tsx`, `src/app/(auth)/entrar/form-entrar.tsx`, `src/app/(auth)/entrar/actions.ts`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/componentes/menu-usuario.tsx`
- Delete: `src/app/page.tsx`
- Test: `src/componentes/use-client.test.ts`

**Interfaces:**
- Consumes: `validarSessao`/`criarSessao`/`encerrarSessao` (Task 4), `verificarSenha`/`hashDummy` (Task 3), `prisma` (Task 2)
- Produces:
  - `COOKIE_SESSAO = 'drusign_sessao'`
  - `abrirSessaoNoCookie(usuarioId)`, `lerSessaoDoCookie()`, `fecharSessaoDoCookie()` — a cola com `cookies()`; só em Server Action/Route Handler para `abrir` e `fechar`
  - `usuarioAtual(): Promise<UsuarioSessao | null>` (memoizado por request) e `exigirUsuario(): Promise<UsuarioSessao>` (redireciona para `/entrar`)
  - Server Actions `entrar(estado, formData)` e `sair()`
  - rotas `/entrar` (pública) e `/` (protegida)

- [ ] **Step 1: Instalar `server-only`**

```bash
npm i --save-exact server-only@0.0.1
```

- [ ] **Step 2: Constante compartilhada, cola do cookie e usuário atual**

`src/infra/auth/constantes.ts` (sem imports: o `proxy.ts` também lê daqui e não pode puxar Prisma):
```ts
export const COOKIE_SESSAO = 'drusign_sessao'
```

`src/infra/auth/cookie-sessao.ts`:
```ts
import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE_SESSAO } from './constantes'
import { criarSessao, encerrarSessao, validarSessao, DURACAO_SESSAO_SEGUNDOS, type UsuarioSessao } from './sessao'

/** Chamar apenas em Server Action ou Route Handler: cookies().set nao funciona durante render. */
export async function abrirSessaoNoCookie(usuarioId: string): Promise<void> {
  const { id } = await criarSessao(usuarioId)
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  })
}

export async function lerSessaoDoCookie(): Promise<UsuarioSessao | null> {
  const jar = await cookies()
  return validarSessao(jar.get(COOKIE_SESSAO)?.value)
}

/** Apaga a linha no banco e o cookie. Chamar apenas em Server Action ou Route Handler. */
export async function fecharSessaoDoCookie(): Promise<void> {
  const jar = await cookies()
  await encerrarSessao(jar.get(COOKIE_SESSAO)?.value)
  jar.delete(COOKIE_SESSAO)
}
```

`src/infra/auth/usuario-atual.ts`:
```ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { lerSessaoDoCookie } from './cookie-sessao'
import type { UsuarioSessao } from './sessao'

/** Memoizado por request: layout, pagina e action no mesmo request fazem uma consulta so. */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => lerSessaoDoCookie())

/** Para paginas e actions protegidas: devolve o usuario ou manda para /entrar. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual()
  if (!usuario) redirect('/entrar')
  return usuario
}
```

- [ ] **Step 3: O proxy (Next 16 renomeou `middleware.ts` para `proxy.ts`)**

`src/proxy.ts` — verificação **otimista**: só olha se o cookie existe, sem tocar no banco. Quem valida de verdade é `exigirUsuario()` no layout. Por isso o proxy **não** redireciona `/entrar` para `/` quando há cookie: um cookie velho faria um loop (`/` → `/entrar` → `/` …). A página `/entrar` faz esse redirecionamento depois de validar no banco.

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/infra/auth/constantes'

const ROTAS_PUBLICAS = ['/entrar']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const temCookie = request.cookies.has(COOKIE_SESSAO)
  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (!temCookie && !ehPublica) {
    const url = new URL('/entrar', request.nextUrl)
    url.searchParams.set('proximo', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Tudo, exceto assets internos e arquivos estaticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)'],
}
```

- [ ] **Step 4: Server Actions de entrar e sair**

`src/app/(auth)/entrar/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/infra/db/prisma'
import { verificarSenha, hashDummy } from '@/infra/auth/senha'
import { abrirSessaoNoCookie, fecharSessaoDoCookie } from '@/infra/auth/cookie-sessao'
import { destinoSeguro } from '@/infra/auth/destino'

export interface EstadoEntrar {
  erro?: string
  login?: string
}

const ERRO_CREDENCIAIS = 'Login ou senha inválidos.'

export async function entrar(_estado: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  const proximo = destinoSeguro(formData.get('proximo'))

  if (login.length === 0 || senha.length === 0) {
    return { erro: 'Informe login e senha.', login }
  }
  if (login.length > 64 || senha.length > 256) {
    return { erro: ERRO_CREDENCIAIS, login }
  }

  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, senhaHash: true, ativo: true },
  })

  // Verifica sempre um hash (o dummy quando o login nao existe): o tempo de resposta nao revela logins.
  const senhaOk = await verificarSenha(usuario?.senhaHash ?? (await hashDummy()), senha)

  if (!usuario || !senhaOk || !usuario.ativo) {
    return { erro: ERRO_CREDENCIAIS, login }
  }

  await abrirSessaoNoCookie(usuario.id)
  redirect(proximo) // lanca NEXT_REDIRECT; fica fora de try/catch de proposito
}

export async function sair(): Promise<void> {
  await fecharSessaoDoCookie()
  redirect('/entrar')
}
```

- [ ] **Step 5: Página e formulário de entrar**

`src/app/(auth)/entrar/form-entrar.tsx` — Client Component mínimo (`useActionState` do React 19). A diretiva vai na **linha 1**.
```tsx
'use client'

import { useActionState } from 'react'
import { entrar, type EstadoEntrar } from './actions'

const ESTADO_INICIAL: EstadoEntrar = {}

export function FormEntrar({ proximo }: { proximo: string }) {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL)

  return (
    <form action={acao} noValidate>
      <input type="hidden" name="proximo" value={proximo} />

      {estado.erro ? (
        <div className="alert alert-danger" role="alert">
          {estado.erro}
        </div>
      ) : null}

      <div className="mb-3">
        <label className="form-label" htmlFor="login">
          Login
        </label>
        <input
          id="login"
          name="login"
          className="form-control"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={estado.login ?? ''}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          className="form-control"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn-primary w-100" disabled={pendente}>
          {pendente ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
```

`src/app/(auth)/entrar/page.tsx` — Server Component; quem já está logado (validado no banco) vai para o destino.
```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/infra/auth/usuario-atual'
import { destinoSeguro } from '@/infra/auth/destino'
import { FormEntrar } from './form-entrar'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams
  const destino = destinoSeguro(proximo)
  if (await usuarioAtual()) redirect(destino)

  return (
    <div className="page page-center">
      <div className="container container-tight py-4">
        <div className="text-center mb-4">
          <span className="navbar-brand navbar-brand-autodark h1">DruSign</span>
        </div>
        <div className="card card-md">
          <div className="card-body">
            <h2 className="h2 text-center mb-4">Entrar</h2>
            <FormEntrar proximo={destino} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Escrever a trava do `'use client'` e criar o menu do usuário SEM a diretiva**

`src/componentes/use-client.test.ts` — o `react-bootstrap` 2.10.10 não marca todos os módulos com `'use client'` (Form, Collapse, Tabs…); importá-los de um Server Component quebra. Regra do projeto: todo arquivo que importa `react-bootstrap` começa com `'use client'` na linha 1.
```ts
import { describe, expect, it } from 'vitest'
import { globSync, readFileSync } from 'node:fs'

describe('react-bootstrap so em Client Components', () => {
  it("todo arquivo que importa react-bootstrap comeca com 'use client'", () => {
    const arquivos = globSync('src/**/*.{ts,tsx}').filter((f) => !f.includes('generated'))
    const ofensores = arquivos.filter((f) => {
      const src = readFileSync(f, 'utf8')
      return /from\s+['"]react-bootstrap/.test(src) && !/^['"]use client['"]/.test(src)
    })
    expect(ofensores).toEqual([])
  })
})
```

`src/componentes/menu-usuario.tsx` — **de propósito ainda sem** a diretiva, para ver a trava morder:
```tsx
import Dropdown from 'react-bootstrap/Dropdown'
import { IconLogout } from '@tabler/icons-react'

interface Props {
  nome: string
  papel: string
  iniciais: string
  sairAction: () => Promise<void>
}

/** Unico ponto do shell que precisa de JS no navegador: o dropdown. Recebe so props serializaveis. */
export function MenuUsuario({ nome, papel, iniciais, sairAction }: Props) {
  return (
    <Dropdown className="nav-item" drop="up" align="end">
      <Dropdown.Toggle
        as="button"
        bsPrefix="nav-link"
        className="d-flex align-items-center lh-1 text-reset p-0 border-0 bg-transparent w-100"
        aria-label="Abrir menu do usuário"
      >
        <span className="avatar avatar-sm">{iniciais}</span>
        <div className="ps-2 text-start">
          <div>{nome}</div>
          <div className="mt-1 small text-secondary">{papel}</div>
        </div>
      </Dropdown.Toggle>
      <Dropdown.Menu className="dropdown-menu-arrow">
        <form action={sairAction}>
          <button type="submit" className="dropdown-item">
            <IconLogout className="icon dropdown-item-icon" />
            Sair
          </button>
        </form>
      </Dropdown.Menu>
    </Dropdown>
  )
}
```

- [ ] **Step 7: Rodar e ver a trava falhar**

Run: `npm test -- use-client`
Expected: FAIL — `expected [ 'src\componentes\menu-usuario.tsx' ] to deeply equal []`

- [ ] **Step 8: Acrescentar `'use client'` na linha 1 de `menu-usuario.tsx` e ver passar**

O arquivo passa a começar com:
```tsx
'use client'

import Dropdown from 'react-bootstrap/Dropdown'
```

Run: `npm test -- use-client`
Expected: PASS — 1 passed

- [ ] **Step 9: Layout da área logada com a sidebar vertical, e a fila de trabalho**

`src/app/(app)/layout.tsx` — sidebar à esquerda como nos artboards de `design/`; usuário embaixo. Server Component: só o `MenuUsuario` roda no navegador. Sem classes `collapse` (não há JS do Bootstrap): abaixo de `lg` a sidebar vira barra no topo, com os itens visíveis.
```tsx
import Link from 'next/link'
import { IconListCheck } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { MenuUsuario } from '@/componentes/menu-usuario'
import { sair } from '@/app/(auth)/entrar/actions'

const PAPEL_LEGIVEL = { administracao: 'Administração', operacao: 'Operação' } as const

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()

  return (
    <div className="page">
      <aside className="navbar navbar-vertical navbar-expand-lg">
        <div className="container-fluid">
          <div className="navbar-brand navbar-brand-autodark">
            <Link href="/">DruSign</Link>
          </div>

          <nav aria-label="Principal" className="navbar-collapse">
            <ul className="navbar-nav pt-lg-3">
              <li className="nav-item">
                <Link className="nav-link" href="/">
                  <span className="nav-link-icon d-md-none d-lg-inline-block">
                    <IconListCheck className="icon" />
                  </span>
                  <span className="nav-link-title">Fila de trabalho</span>
                </Link>
              </li>
            </ul>
          </nav>

          <div className="navbar-nav mt-auto pb-lg-3">
            <MenuUsuario
              nome={usuario.nome}
              papel={PAPEL_LEGIVEL[usuario.papel]}
              iniciais={iniciais(usuario.nome)}
              sairAction={sair}
            />
          </div>
        </div>
      </aside>

      <div className="page-wrapper">{children}</div>
    </div>
  )
}
```

`src/app/(app)/page.tsx` — a home é a fila de trabalho (spec, seção 7). Sem ordens ainda, ela diz o que é e o que vai mostrar.
```tsx
import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'

export const metadata: Metadata = { title: 'Fila de trabalho' }

export default async function PaginaFila() {
  const usuario = await exigirUsuario()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Fila de trabalho</h2>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <div className="empty">
                <p className="empty-title">Ainda não há ordens de serviço</p>
                <p className="empty-subtitle text-secondary">
                  Olá, {usuario.nome}. Aqui vão aparecer as ordens abertas há mais de uma semana e as
                  concluídas que ainda não foram pagas. A fila ganha vida na Fase 4, quando ordens e
                  recebimentos existirem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

Apagar a página provisória, que conflita com a rota `/`:
```bash
git rm src/app/page.tsx
```

- [ ] **Step 10: Typecheck, suíte e build**

Run: `npm run typecheck` → sem erros.
Run: `npm test` → PASS.
Run: `npm run build`
Expected: verde, com `ƒ /` e `ƒ /entrar` (dinâmicas) e a linha `ƒ Proxy (Middleware)`.

- [ ] **Step 11: Fumaça sem navegador**

Run: `npx next dev -p 3000` em segundo plano (ele lê `.env.local`). Aguardar `Ready`.

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/`
Expected: `307 http://localhost:3000/entrar?proximo=%2F`

Run: `curl -s http://localhost:3000/entrar | grep -o '<title>[^<]*</title>\|for="login"\|for="senha"'`
Expected: `<title>Entrar · DruSign</title>`, `for="login"`, `for="senha"`

Parar o `next dev` (matar o processo em segundo plano) **antes** de qualquer `prisma generate`/`next build` posterior.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json src/proxy.ts src/infra/auth/ src/app/ src/componentes/
git commit -m "feat: entrar e sair com sessao em cookie, proxy de rotas e shell com sidebar"
```

---

### Task 7: Teste ponta a ponta do login com Playwright — o critério de conclusão da fase

Nenhuma pesquisa executou `proxy.ts` + Server Action + cookie dentro de um Next real. Este teste é a prova.

**Files:**
- Create: `playwright.config.ts`, `e2e/entrar.spec.ts`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: o app inteiro; o usuário `admin` do seed (Task 3)
- Produces: `npm run e2e` e `npm run check`

- [ ] **Step 1: Instalar o Playwright e o Chromium**

```bash
npm i -D --save-exact @playwright/test@1.62.1
npx playwright install chromium
```

Expected: download de ~280 MB para `%USERPROFILE%\AppData\Local\ms-playwright`. **Risco aceito:** a matriz oficial do Playwright 1.62 é Windows 11+; o Chromium costuma rodar no Windows 10 19045. Se `npx playwright install` ou o primeiro teste falhar por causa do sistema, **parar e avisar** — o e2e passa a rodar só em CI, e a fase fecha com o Step 11 da Task 6 como evidência.

- [ ] **Step 2: Configuração**

`playwright.config.ts` — localmente sobe `next dev` (rápido, cookie sem `Secure`); em CI, build de produção.
```ts
import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Le .env.local com a mesma ordem do Next: o teste precisa das credenciais do seed.
loadEnvConfig(process.cwd())

const porta = 3000
const baseURL = `http://localhost:${porta}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? `npm run build && npx next start -p ${porta}` : `npx next dev -p ${porta}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

No `tsconfig.json`, acrescentar ao `include`, depois de `"prisma.config.ts"`:
```json
    "playwright.config.ts",
    "e2e/**/*.ts",
```

No `package.json`, acrescentar aos `scripts`:
```json
{
  "scripts": {
    "e2e": "playwright test",
    "check": "npm run typecheck && npm run test && npm run test:int"
  }
}
```

- [ ] **Step 3: Escrever o teste**

`e2e/entrar.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

// Credenciais do seed (npm run db:seed), lidas de .env.local pelo playwright.config.ts.
const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
const SENHA = process.env.SEED_ADMIN_SENHA ?? ''

test.beforeAll(() => {
  if (SENHA === '') throw new Error('SEED_ADMIN_SENHA ausente em .env.local — rode `npm run db:seed` antes')
})

test.describe('Entrar', () => {
  test('rota protegida sem sessao redireciona para /entrar', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar\?proximo=%2F$/)
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('senha errada mostra erro e permanece em /entrar', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Login').fill(LOGIN)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toContainText('Login ou senha inválidos')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('entra, chega na fila de trabalho e sai', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Login').fill(LOGIN)
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de trabalho' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()

    // Ja logado, /entrar volta para a home (validado no banco, nao so pelo cookie).
    await page.goto('/entrar')
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole('button', { name: 'Abrir menu do usuário' }).click()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar/)

    // A sessao foi apagada no banco: a home volta a exigir login.
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar/)
  })
})
```

- [ ] **Step 4: Rodar o e2e**

Antes: nenhum `next dev` aberto (o Playwright sobe o dele), `npm run db:local:ls` mostrando a instância `drusign` de pé, e o seed já aplicado (Task 3).

Run: `npm run e2e`
Expected: `3 passed`. Colar a saída. Se um teste falhar, ler o erro do Playwright (`test-results/` tem screenshot e trace) — os pontos mais prováveis são `cookies()` chamado fora de action, `redirect()` dentro de `try`, ou o `Dropdown.Toggle` não abrindo (fallback: `<details>` nativo com as classes do Tabler).

- [ ] **Step 5: Typecheck com o e2e incluso e a verificação final da fase**

Run: `npm run check`
Expected: typecheck sem erros (inclui `e2e/` e `playwright.config.ts`); unitários verdes; integração verde (8 passed).

Run: `npm run build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json playwright.config.ts e2e/
git commit -m "test: login ponta a ponta com Playwright e script check"
```

---

## Critério de conclusão da Fase 1B

Verificação da Fase 1 na spec (seção 13): *"as três fórmulas reproduzem os resultados conhecidos do legado"* — cumprido na 1A. Para a 1B, o que prova que a fundação está de pé:

- [ ] `npm run check` passa: typecheck, unitários (sem banco) e integração (banco real, 8 testes)
- [ ] `npm run build` passa no TypeScript 7, sem `experimental.useTypeScriptCli`
- [ ] `npm run e2e` passa: sem sessão redireciona; senha errada avisa; login certo chega na fila de trabalho, `/entrar` devolve para a home, e sair derruba a sessão no banco
- [ ] `prisma/migrations/` versionada com a migração `init`; `src/generated/`, `.env.local` e `.env.test.local` fora do git
- [ ] `src/domain/` continua puro, agora também contra `@/generated` e `@/infra` — verificado por teste

Feito isso, a Fase 2 (Cliente, Material e a importação dos 3.219 clientes com normalização de telefone) ganha seu próprio plano.

## Para quando houver deploy (fora da 1B)

Registrado aqui para não se perder, sem tarefa:

- **Neon:** projeto em `sa-east-1` (região é permanente), Postgres 16, plano *Launch* (usage-based, PITR de 7 dias). `DATABASE_URL` = host `-pooler`; `DIRECT_URL` = host direto. O `prisma.config.ts` já aceita `DATABASE_URL_UNPOOLED`, que é o nome que a integração Neon↔Vercel injeta.
- **Vercel:** plano Pro (Hobby proíbe uso comercial), `vercel.json` com `"regions": ["gru1"]`, `build` = `prisma generate && next build`; migrações via `prisma migrate deploy` fora do build.
- **Docker:** `output: 'standalone'` continua sendo o caminho; Dockerfile em 3 estágios sobre `node:24-slim` com `openssl`. Entra quando houver Docker para construir.
- **ESLint:** só depois de confirmar `typescript-eslint` com TS 7.
- **Limpeza de sessões expiradas:** `DELETE FROM sessao WHERE expira_em <= now()` num cron; 3 usuários não geram volume que exija isso na v1.
