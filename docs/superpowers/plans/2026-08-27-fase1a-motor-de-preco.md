# Fase 1A — Motor de preço e domínio puro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o motor de preço, o parser de entrada assistida e a máquina de estados como módulos TypeScript puros, testados contra o gabarito real extraído do sistema legado.

**Architecture:** Módulos sem nenhuma dependência de Next.js, React, Prisma ou banco de dados. Entram números e strings, saem números e objetos. Todo o resto do sistema consome estes módulos; eles não consomem nada do sistema. Isso é o que permite trocar o framework depois sem tocar na regra de negócio.

**Tech Stack:** TypeScript, Vitest, decimal.js

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md`

## Global Constraints

- Dinheiro **sempre** em `Decimal` (decimal.js). Ponto flutuante em nenhum cálculo monetário.
- Nenhum arquivo em `src/domain/` pode importar de `next`, `react`, `@prisma/client` ou tocar em I/O. Isso é verificado por teste na Task 10.
- Dimensões em **metros**, sempre. Conversão de centímetro acontece no parser, na fronteira.
- Node 20 ou superior.
- Comentários e nomes de domínio em português (é o vocabulário da empresa); palavras-chave de TypeScript em inglês, como a linguagem exige.

## Nota sobre o faseamento

A seção 13 da spec lista a entrada assistida e o ajuste de preço dentro da Fase 3, junto
da tela de ordem de serviço. Este plano traz a **lógica pura** dessas duas coisas para a
1A — o parser e a composição de preço são funções sem interface, e testá-las cedo é o que
retira o risco número um do projeto antes de existir tela. A **interface** delas continua
na Fase 3, como a spec define. Nenhum requisito muda; muda apenas quando a lógica é
escrita e testada.

---

### Task 1: Scaffolding do projeto e do harness de teste

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/domain/index.ts`
- Test: `src/domain/index.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: projeto TypeScript com Vitest rodando; alias `@/` apontando para `src/`

- [x] **Step 1: Inicializar o projeto**

```bash
npm init -y
npm i decimal.js
npm i -D typescript vitest @types/node
```

- [x] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [x] **Step 4: Adicionar scripts ao `package.json`**

```json
{
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [x] **Step 5: Escrever o teste que prova que o harness funciona**

`src/domain/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { VERSAO_DOMINIO } from './index'

describe('harness', () => {
  it('resolve o alias e roda TypeScript', () => {
    expect(VERSAO_DOMINIO).toBe('1.0.0')
  })
})
```

- [x] **Step 6: Rodar o teste e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./index"`

- [x] **Step 7: Criar `src/domain/index.ts`**

```ts
export const VERSAO_DOMINIO = '1.0.0'
```

- [x] **Step 8: Rodar o teste e ver passar**

Run: `npm test`
Expected: PASS — 1 passed

- [x] **Step 9: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros

> Nota de execução (2026-08-28): `npm i -D typescript` resolveu para TypeScript 7.0.2, que removeu `baseUrl` (erro TS5102). A opção foi retirada do `tsconfig.json`; `paths` com `./src/*` já é relativo ao tsconfig e continua funcionando.

- [x] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/
git commit -m "chore: scaffolding do projeto com TypeScript e Vitest"
```

---

### Task 2: Gabarito do legado como fixture

Extrai as 772 linhas da tabela `ORDEM2` do sistema antigo para um JSON que serve de gabarito aos testes das fórmulas. É um script de uso único; o JSON é o artefato que fica.

**Files:**
- Create: `scripts/extrair-gabarito.py`
- Create: `src/domain/precificacao/__fixtures__/ordem2-gabarito.json`
- Test: `src/domain/precificacao/__fixtures__/gabarito.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `ordem2-gabarito.json`, um array de objetos com a forma
  `{ os: number, descricao: string, unidadeLegado: string, altura: number, largura: number, totmt: number, valor: number, quantidade: number, total: number }`

- [x] **Step 1: Escrever o script de extração**

`scripts/extrair-gabarito.py` — lê o DBF direto, sem dependência externa:

```python
"""Extrai ORDEM2.DBF do legado para o gabarito de testes. Uso unico."""
import json, os, struct, sys

ORIGEM = r"C:\legacy-drusign-dados\OSGRAFICA4.5A\DADOS\ORDEM2.DBF"
DESTINO = os.path.join("src", "domain", "precificacao", "__fixtures__", "ordem2-gabarito.json")
ENCODING = "cp1252"

def ler_dbf(caminho):
    with open(caminho, "rb") as f:
        cab = f.read(32)
        n_regs, tam_cab, tam_reg = struct.unpack("<IHH", cab[4:12])
        campos = []
        f.seek(32)
        while True:
            d = f.read(32)
            if len(d) < 32 or d[0] in (0x0D, 0x00):
                break
            nome = d[0:11].split(b"\x00")[0].decode("ascii", "replace").strip()
            campos.append({"nome": nome, "tipo": chr(d[11]), "tam": d[16], "dec": d[17]})
        f.seek(tam_cab)
        for _ in range(n_regs):
            bruto = f.read(tam_reg)
            if len(bruto) < tam_reg:
                break
            if bruto[0:1] == b"*":
                continue
            valores, pos = {}, 1
            for c in campos:
                pedaco = bruto[pos:pos + c["tam"]]
                pos += c["tam"]
                if c["tipo"] in ("C", "M"):
                    valores[c["nome"]] = pedaco.decode(ENCODING, "replace").strip()
                elif c["tipo"] in ("N", "F"):
                    txt = pedaco.decode("ascii", "replace").strip()
                    valores[c["nome"]] = float(txt) if txt else 0.0
                else:
                    valores[c["nome"]] = pedaco.decode(ENCODING, "replace").strip()
            yield valores

def main():
    if not os.path.exists(ORIGEM):
        sys.exit(f"Origem nao encontrada: {ORIGEM}")
    linhas = []
    for v in ler_dbf(ORIGEM):
        linhas.append({
            "os": int(v.get("NUMERO") or 0),
            "descricao": v.get("DESCRICAO", ""),
            "unidadeLegado": v.get("UNIDADE", ""),
            "altura": round(v.get("ALTURA") or 0.0, 4),
            "largura": round(v.get("LARGURA") or 0.0, 4),
            "totmt": round(v.get("TOTMT") or 0.0, 4),
            "valor": round(v.get("VALOR") or 0.0, 2),
            "quantidade": round(v.get("QUANTIA") or 0.0, 4),
            "total": round(v.get("TOTAL") or 0.0, 2),
        })
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8") as f:
        json.dump(linhas, f, ensure_ascii=False, indent=1)
    print(f"{len(linhas)} linhas escritas em {DESTINO}")

if __name__ == "__main__":
    main()
```

- [x] **Step 2: Rodar o script**

Run: `python scripts/extrair-gabarito.py`
Expected: `772 linhas escritas em src\domain\precificacao\__fixtures__\ordem2-gabarito.json`

Se a origem não existir, os dados do legado precisam ser reextraídos antes de continuar — sem o gabarito, as fórmulas não têm como ser validadas contra a realidade.

- [x] **Step 3: Escrever o teste que valida a forma do gabarito**

`src/domain/precificacao/__fixtures__/gabarito.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import gabarito from './ordem2-gabarito.json'

describe('gabarito do ORDEM2', () => {
  it('tem as 772 linhas do legado', () => {
    expect(gabarito).toHaveLength(772)
  })

  it('toda linha tem os campos esperados', () => {
    for (const l of gabarito) {
      expect(typeof l.os).toBe('number')
      expect(typeof l.altura).toBe('number')
      expect(typeof l.largura).toBe('number')
      expect(typeof l.valor).toBe('number')
      expect(typeof l.quantidade).toBe('number')
      expect(typeof l.total).toBe('number')
    }
  })

  it('contem os casos conhecidos de metro linear', () => {
    const os53 = gabarito.find((l) => l.os === 53 && l.unidadeLegado === 'MTL')
    expect(os53).toBeDefined()
    expect(os53!.altura).toBeCloseTo(0.33, 4)
    expect(os53!.largura).toBeCloseTo(0.27, 4)
    expect(os53!.total).toBeCloseTo(40.8, 2)
  })
})
```

- [x] **Step 4: Habilitar import de JSON no tsconfig**

Adicionar em `compilerOptions`: `"resolveJsonModule": true`

- [x] **Step 5: Rodar os testes**

Run: `npm test`
Expected: PASS — 4 passed

- [x] **Step 6: Commit**

```bash
git add scripts/extrair-gabarito.py src/domain/precificacao/__fixtures__/ tsconfig.json
git commit -m "feat: gabarito do ORDEM2 do legado como fixture de teste"
```

---

### Task 3: Tipos do domínio e o helper de dinheiro

**Files:**
- Create: `src/domain/precificacao/tipos.ts`
- Create: `src/domain/precificacao/dinheiro.ts`
- Test: `src/domain/precificacao/dinheiro.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type UnidadeCobranca = 'm2' | 'unidade' | 'metro_linear'`
  - `interface ItemCobranca { unidade: UnidadeCobranca; quantidade: number; valorUnitario: number; altura?: number; largura?: number }`
  - `interface ResultadoItem { unidade: UnidadeCobranca; medida: Decimal; total: Decimal }`
  - `dinheiro(v: number | string): Decimal` — cria um Decimal
  - `arredondarCentavos(d: Decimal): Decimal` — arredonda para 2 casas, meio para cima

- [x] **Step 1: Escrever o teste do helper de dinheiro**

`src/domain/precificacao/dinheiro.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dinheiro, arredondarCentavos } from './dinheiro'

describe('dinheiro', () => {
  it('nao sofre o erro classico de ponto flutuante', () => {
    expect(dinheiro(0.1).plus(dinheiro(0.2)).toString()).toBe('0.3')
  })

  it('aceita string e numero', () => {
    expect(dinheiro('120.50').toString()).toBe('120.5')
    expect(dinheiro(120.5).toString()).toBe('120.5')
  })
})

describe('arredondarCentavos', () => {
  it('arredonda para duas casas, meio para cima', () => {
    expect(arredondarCentavos(dinheiro('4.975')).toString()).toBe('4.98')
    expect(arredondarCentavos(dinheiro('4.974')).toString()).toBe('4.97')
  })

  it('preserva valores ja com duas casas', () => {
    expect(arredondarCentavos(dinheiro('40.80')).toString()).toBe('40.8')
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npm test -- dinheiro`
Expected: FAIL — não consegue resolver `./dinheiro`

- [x] **Step 3: Criar `src/domain/precificacao/dinheiro.ts`**

```ts
import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

export function dinheiro(v: number | string): Decimal {
  return new Decimal(v)
}

export function arredondarCentavos(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}
```

- [x] **Step 4: Criar `src/domain/precificacao/tipos.ts`**

```ts
import type { Decimal } from './dinheiro'

export type UnidadeCobranca = 'm2' | 'unidade' | 'metro_linear'

export interface ItemCobranca {
  unidade: UnidadeCobranca
  quantidade: number
  valorUnitario: number
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  altura?: number
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  largura?: number
}

export interface ResultadoItem {
  unidade: UnidadeCobranca
  /** Area em m2, perimetro em metros, ou 1 para cobranca por unidade. */
  medida: Decimal
  total: Decimal
}
```

- [x] **Step 5: Rodar e ver passar**

Run: `npm test -- dinheiro`
Expected: PASS — 4 passed

- [x] **Step 6: Commit**

```bash
git add src/domain/precificacao/tipos.ts src/domain/precificacao/dinheiro.ts src/domain/precificacao/dinheiro.test.ts
git commit -m "feat: tipos do dominio de precificacao e helper de dinheiro em Decimal"
```

---

### Task 4: Fórmula de área (m²)

`total = altura × largura × valorUnitario × quantidade`

**Files:**
- Create: `src/domain/precificacao/formulas.ts`
- Test: `src/domain/precificacao/formulas.area.test.ts`

**Interfaces:**
- Consumes: `ItemCobranca`, `ResultadoItem`, `dinheiro`, `arredondarCentavos` da Task 3
- Produces: `calcularArea(item: ItemCobranca): ResultadoItem`

- [ ] **Step 1: Escrever o teste com os casos reais do legado**

`src/domain/precificacao/formulas.area.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcularArea } from './formulas'

describe('calcularArea', () => {
  // Casos extraidos do ORDEM2 do legado, com resultado conhecido e exato.
  it.each([
    { os: 27, altura: 0.2, largura: 0.1,  valorUnitario: 60, quantidade: 100, esperado: '120' },
    { os: 27, altura: 0.2, largura: 0.2,  valorUnitario: 40, quantidade: 50,  esperado: '80' },
    { os: 31, altura: 8.0, largura: 0.12, valorUnitario: 47, quantidade: 2,   esperado: '90.24' },
    { os: 32, altura: 0.7, largura: 0.5,  valorUnitario: 86, quantidade: 2,   esperado: '60.2' },
  ])('OS $os: $altura x $largura a $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularArea({
      unidade: 'm2',
      altura: c.altura,
      largura: c.largura,
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('expoe a area como medida', () => {
    const r = calcularArea({ unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 281, quantidade: 1 })
    expect(r.medida.toString()).toBe('0.48')
    expect(r.unidade).toBe('m2')
  })

  // O legado truncava a terceira casa; nos arredondamos meio para cima.
  // OS 32 do ORDEM2: 0,7 x 1,65 x 83 = 95,865. O legado gravou 95,86; o valor
  // correto e 95,87. Divergencia de um centavo, deliberada e documentada.
  it('arredonda meio para cima, divergindo do truncamento do legado', () => {
    const r = calcularArea({ unidade: 'm2', altura: 0.7, largura: 1.65, valorUnitario: 83, quantidade: 1 })
    expect(r.total.toString()).toBe('95.87')
  })

  it('rejeita item sem altura', () => {
    expect(() =>
      calcularArea({ unidade: 'm2', largura: 0.5, valorUnitario: 10, quantidade: 1 }),
    ).toThrow('altura e largura sao obrigatorias para cobranca por m2')
  })

  it('rejeita dimensao zero ou negativa', () => {
    expect(() =>
      calcularArea({ unidade: 'm2', altura: 0, largura: 0.5, valorUnitario: 10, quantidade: 1 }),
    ).toThrow('altura e largura precisam ser maiores que zero')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- formulas.area`
Expected: FAIL — não consegue resolver `./formulas`

- [ ] **Step 3: Criar `src/domain/precificacao/formulas.ts`**

```ts
import { dinheiro, arredondarCentavos } from './dinheiro'
import type { ItemCobranca, ResultadoItem } from './tipos'

export function calcularArea(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new Error('altura e largura sao obrigatorias para cobranca por m2')
  }
  if (item.altura <= 0 || item.largura <= 0) {
    throw new Error('altura e largura precisam ser maiores que zero')
  }
  const medida = dinheiro(item.altura).times(dinheiro(item.largura))
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'm2', medida, total }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- formulas.area`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/domain/precificacao/formulas.ts src/domain/precificacao/formulas.area.test.ts
git commit -m "feat: formula de cobranca por metro quadrado"
```

---

### Task 5: Fórmula de unidade

`total = valorUnitario × quantidade`

**Files:**
- Modify: `src/domain/precificacao/formulas.ts`
- Test: `src/domain/precificacao/formulas.unidade.test.ts`

**Interfaces:**
- Consumes: o mesmo da Task 4
- Produces: `calcularUnidade(item: ItemCobranca): ResultadoItem`

- [ ] **Step 1: Escrever o teste com os casos reais**

`src/domain/precificacao/formulas.unidade.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcularUnidade } from './formulas'

describe('calcularUnidade', () => {
  it.each([
    { os: 1, valorUnitario: 35, quantidade: 1, esperado: '35' },
    { os: 2, valorUnitario: 15, quantidade: 1, esperado: '15' },
    { os: 2, valorUnitario: 13, quantidade: 1, esperado: '13' },
    { os: 3, valorUnitario: 20, quantidade: 1, esperado: '20' },
  ])('OS $os: $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularUnidade({
      unidade: 'unidade',
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('calcula cracha: 18 letras caixa a 34,00', () => {
    const r = calcularUnidade({ unidade: 'unidade', valorUnitario: 34, quantidade: 18 })
    expect(r.total.toString()).toBe('612')
  })

  it('ignora dimensoes quando informadas', () => {
    const r = calcularUnidade({
      unidade: 'unidade', valorUnitario: 10, quantidade: 2, altura: 5, largura: 5,
    })
    expect(r.total.toString()).toBe('20')
    expect(r.medida.toString()).toBe('1')
  })

  it('rejeita quantidade zero', () => {
    expect(() =>
      calcularUnidade({ unidade: 'unidade', valorUnitario: 10, quantidade: 0 }),
    ).toThrow('quantidade precisa ser maior que zero')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- formulas.unidade`
Expected: FAIL — `calcularUnidade is not a function`

- [ ] **Step 3: Acrescentar a função em `formulas.ts`**

```ts
export function calcularUnidade(item: ItemCobranca): ResultadoItem {
  if (item.quantidade <= 0) {
    throw new Error('quantidade precisa ser maior que zero')
  }
  const total = arredondarCentavos(
    dinheiro(item.valorUnitario).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'unidade', medida: dinheiro(1), total }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- formulas.unidade`
Expected: PASS — 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/domain/precificacao/formulas.ts src/domain/precificacao/formulas.unidade.test.ts
git commit -m "feat: formula de cobranca por unidade"
```

---

### Task 6: Fórmula de metro linear (perímetro)

`total = 2 × (altura + largura) × valorUnitario × quantidade`

Metro linear no legado é o **perímetro** da peça, não um comprimento avulso. Cinco das seis linhas com dimensão preenchida confirmam a fórmula exatamente.

**Files:**
- Modify: `src/domain/precificacao/formulas.ts`
- Test: `src/domain/precificacao/formulas.metrolinear.test.ts`

**Interfaces:**
- Consumes: o mesmo da Task 4
- Produces: `calcularMetroLinear(item: ItemCobranca): ResultadoItem`

- [ ] **Step 1: Escrever o teste com os cinco casos confirmados**

`src/domain/precificacao/formulas.metrolinear.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcularMetroLinear } from './formulas'

describe('calcularMetroLinear', () => {
  // As cinco linhas MTL do ORDEM2 com dimensao preenchida que fecham exatamente.
  it.each([
    { os: 31, altura: 0.78,  largura: 0.028, valorUnitario: 19,   quantidade: 1, perimetro: '1.616', esperado: '30.7' },
    { os: 53, altura: 0.33,  largura: 0.27,  valorUnitario: 34,   quantidade: 1, perimetro: '1.2',   esperado: '40.8' },
    { os: 58, altura: 0.025, largura: 0.03,  valorUnitario: 35,   quantidade: 4, perimetro: '0.11',  esperado: '15.4' },
    { os: 84, altura: 0.05,  largura: 0.03,  valorUnitario: 62.5, quantidade: 1, perimetro: '0.16',  esperado: '10' },
    { os: 98, altura: 0.015, largura: 0.056, valorUnitario: 35,   quantidade: 1, perimetro: '0.142', esperado: '4.97' },
  ])('OS $os: perimetro $perimetro a $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularMetroLinear({
      unidade: 'metro_linear',
      altura: c.altura,
      largura: c.largura,
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.medida.toString()).toBe(c.perimetro)
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('calcula o perfil de aluminio de uma placa 0,61 x 0,60', () => {
    const r = calcularMetroLinear({
      unidade: 'metro_linear', altura: 0.61, largura: 0.6, valorUnitario: 28, quantidade: 1,
    })
    expect(r.medida.toString()).toBe('2.42')
    expect(r.total.toString()).toBe('67.76')
  })

  it('rejeita item sem dimensao', () => {
    expect(() =>
      calcularMetroLinear({ unidade: 'metro_linear', valorUnitario: 28, quantidade: 1 }),
    ).toThrow('altura e largura sao obrigatorias para cobranca por metro linear')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- formulas.metrolinear`
Expected: FAIL — `calcularMetroLinear is not a function`

- [ ] **Step 3: Acrescentar a função em `formulas.ts`**

```ts
export function calcularMetroLinear(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new Error('altura e largura sao obrigatorias para cobranca por metro linear')
  }
  if (item.altura <= 0 || item.largura <= 0) {
    throw new Error('altura e largura precisam ser maiores que zero')
  }
  const medida = dinheiro(item.altura).plus(dinheiro(item.largura)).times(2)
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'metro_linear', medida, total }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- formulas.metrolinear`
Expected: PASS — 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/domain/precificacao/formulas.ts src/domain/precificacao/formulas.metrolinear.test.ts
git commit -m "feat: formula de cobranca por metro linear como perimetro"
```

---

### Task 7: Seletor de fórmula e validação contra o gabarito completo

Escolhe a fórmula pela unidade declarada e roda as 772 linhas do legado como teste de regressão.

**Files:**
- Modify: `src/domain/precificacao/formulas.ts`
- Test: `src/domain/precificacao/formulas.gabarito.test.ts`

**Interfaces:**
- Consumes: `calcularArea`, `calcularUnidade`, `calcularMetroLinear`
- Produces: `calcularItem(item: ItemCobranca): ResultadoItem`

- [ ] **Step 1: Escrever o teste do seletor e da regressão**

`src/domain/precificacao/formulas.gabarito.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcularItem } from './formulas'
import gabarito from './__fixtures__/ordem2-gabarito.json'

/** OS 28 e a unica linha MTL dimensionada que nao fecha: o legado gravou 6,00
 *  onde a formula da 1,62. Fica registrada como divergencia conhecida. */
const DIVERGENCIAS_CONHECIDAS = new Set([28])

describe('calcularItem — seletor', () => {
  it('escolhe a formula de area', () => {
    const r = calcularItem({ unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 281, quantidade: 1 })
    expect(r.unidade).toBe('m2')
    expect(r.total.toString()).toBe('134.88')
  })

  it('escolhe a formula de unidade', () => {
    const r = calcularItem({ unidade: 'unidade', valorUnitario: 20, quantidade: 3 })
    expect(r.total.toString()).toBe('60')
  })

  it('escolhe a formula de metro linear', () => {
    const r = calcularItem({ unidade: 'metro_linear', altura: 0.33, largura: 0.27, valorUnitario: 34, quantidade: 1 })
    expect(r.total.toString()).toBe('40.8')
  })
})

describe('regressao contra o gabarito do legado', () => {
  const porArea = gabarito.filter((l) => l.totmt > 0 && l.unidadeLegado === 'MT2' && l.altura > 0 && l.largura > 0)
  const porUnidade = gabarito.filter((l) => l.totmt === 0 && l.valor > 0 && l.quantidade > 0)
  const porPerimetro = gabarito.filter(
    (l) => ['MTL', 'MT', 'ML'].includes(l.unidadeLegado) && l.altura > 0 && l.largura > 0 && l.totmt > 0,
  )

  it('reproduz ao menos 90% das linhas de area', () => {
    let ok = 0
    for (const l of porArea) {
      const r = calcularItem({
        unidade: 'm2', altura: l.altura, largura: l.largura,
        valorUnitario: l.valor, quantidade: l.quantidade,
      })
      if (r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)) ok++
    }
    expect(ok / porArea.length).toBeGreaterThanOrEqual(0.9)
  })

  it('reproduz 100% das linhas por unidade', () => {
    for (const l of porUnidade) {
      const r = calcularItem({ unidade: 'unidade', valorUnitario: l.valor, quantidade: l.quantidade })
      expect(r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)).toBe(true)
    }
  })

  it('reproduz todas as linhas de perimetro, exceto as divergencias conhecidas', () => {
    for (const l of porPerimetro) {
      if (DIVERGENCIAS_CONHECIDAS.has(l.os)) continue
      const r = calcularItem({
        unidade: 'metro_linear', altura: l.altura, largura: l.largura,
        valorUnitario: l.valor, quantidade: l.quantidade,
      })
      expect(r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- formulas.gabarito`
Expected: FAIL — `calcularItem is not a function`

- [ ] **Step 3: Acrescentar o seletor em `formulas.ts`**

```ts
export function calcularItem(item: ItemCobranca): ResultadoItem {
  switch (item.unidade) {
    case 'm2':
      return calcularArea(item)
    case 'unidade':
      return calcularUnidade(item)
    case 'metro_linear':
      return calcularMetroLinear(item)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- formulas.gabarito`
Expected: PASS — 6 passed

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os testes verdes

- [ ] **Step 6: Commit**

```bash
git add src/domain/precificacao/formulas.ts src/domain/precificacao/formulas.gabarito.test.ts
git commit -m "feat: seletor de formula e regressao contra as 772 linhas do legado"
```

---

### Task 8: Parser da entrada assistida

Converte a linha que o operador digita em um item estruturado. É o risco número um do projeto: a tela de itens do legado foi abandonada em oito meses porque digitar estruturado era mais lento que digitar texto.

**Files:**
- Create: `src/domain/precificacao/parser.ts`
- Test: `src/domain/precificacao/parser.test.ts`

**Interfaces:**
- Consumes: `UnidadeCobranca` da Task 3
- Produces:
  - `interface LinhaInterpretada { quantidade: number; descricao: string; altura?: number; largura?: number; valorUnitario?: number; unidadeSugerida: UnidadeCobranca; confianca: 'alta' | 'parcial' }`
  - `interpretarLinha(texto: string): LinhaInterpretada`
  - `normalizarDimensao(token: string): number` — converte para metros

- [ ] **Step 1: Escrever o teste do normalizador de dimensão**

`src/domain/precificacao/parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { interpretarLinha, normalizarDimensao } from './parser'

describe('normalizarDimensao', () => {
  // Regra: token com separador decimal e valor < 10 ja esta em metros;
  // caso contrario esta em centimetros.
  it.each([
    ['0,61', 0.61],
    ['0.61', 0.61],
    ['1,35', 1.35],
    ['61', 0.61],
    ['40', 0.4],
    ['150', 1.5],
    ['8', 0.08],
  ])('%s vira %s metros', (entrada, esperado) => {
    expect(normalizarDimensao(entrada)).toBeCloseTo(esperado, 4)
  })
})

describe('interpretarLinha', () => {
  it('interpreta o caso canonico com dimensao em centimetros', () => {
    const r = interpretarLinha('12 placas ACM 61x40 61,00')
    expect(r.quantidade).toBe(12)
    expect(r.descricao).toBe('placas ACM')
    expect(r.altura).toBeCloseTo(0.61, 4)
    expect(r.largura).toBeCloseTo(0.4, 4)
    expect(r.valorUnitario).toBe(61)
    expect(r.unidadeSugerida).toBe('m2')
    expect(r.confianca).toBe('alta')
  })

  it('aceita dimensao em metros', () => {
    const r = interpretarLinha('2 adesivo impresso 1,35 x 0,75 100,00')
    expect(r.quantidade).toBe(2)
    expect(r.altura).toBeCloseTo(1.35, 4)
    expect(r.largura).toBeCloseTo(0.75, 4)
    expect(r.valorUnitario).toBe(100)
  })

  it('aceita o separador com espacos e x maiusculo', () => {
    const r = interpretarLinha('6 placa ACM 60 X 80 120,50')
    expect(r.altura).toBeCloseTo(0.6, 4)
    expect(r.largura).toBeCloseTo(0.8, 4)
    expect(r.valorUnitario).toBe(120.5)
  })

  it('sugere unidade quando nao ha dimensao', () => {
    const r = interpretarLinha('18 letra caixa PVC 34,00')
    expect(r.quantidade).toBe(18)
    expect(r.descricao).toBe('letra caixa PVC')
    expect(r.altura).toBeUndefined()
    expect(r.unidadeSugerida).toBe('unidade')
    expect(r.valorUnitario).toBe(34)
  })

  it('assume quantidade 1 quando a linha nao comeca com numero', () => {
    const r = interpretarLinha('placa ACM 50x50 62,00')
    expect(r.quantidade).toBe(1)
    expect(r.descricao).toBe('placa ACM')
  })

  it('marca confianca parcial quando nao acha o valor', () => {
    const r = interpretarLinha('3 banner lona 200x100')
    expect(r.quantidade).toBe(3)
    expect(r.valorUnitario).toBeUndefined()
    expect(r.confianca).toBe('parcial')
  })

  it('nao confunde o preco com dimensao', () => {
    const r = interpretarLinha('1 lona 300x150 450,00')
    expect(r.altura).toBeCloseTo(3, 4)
    expect(r.largura).toBeCloseTo(1.5, 4)
    expect(r.valorUnitario).toBe(450)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- parser`
Expected: FAIL — não consegue resolver `./parser`

- [ ] **Step 3: Criar `src/domain/precificacao/parser.ts`**

```ts
import type { UnidadeCobranca } from './tipos'

export interface LinhaInterpretada {
  quantidade: number
  descricao: string
  altura?: number
  largura?: number
  valorUnitario?: number
  unidadeSugerida: UnidadeCobranca
  confianca: 'alta' | 'parcial'
}

const RE_DIMENSAO = /(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX]\s*(\d{1,4}(?:[.,]\d{1,3})?)/
const RE_QUANTIDADE = /^\s*(\d{1,4})\s+(?=\D)/
const RE_VALOR = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}|\d+,\d{2})\s*$/

export function normalizarDimensao(token: string): number {
  const temSeparador = token.includes(',') || token.includes('.')
  const v = Number(token.replace(',', '.'))
  if (Number.isNaN(v)) throw new Error(`dimensao invalida: ${token}`)
  return temSeparador && v < 10 ? v : v / 100
}

function paraNumero(token: string): number {
  return Number(token.replace(/\./g, '').replace(',', '.'))
}

export function interpretarLinha(texto: string): LinhaInterpretada {
  let resto = texto.trim()

  const mQtd = resto.match(RE_QUANTIDADE)
  const quantidade = mQtd?.[1] ? Number(mQtd[1]) : 1
  if (mQtd) resto = resto.slice(mQtd[0].length)

  let valorUnitario: number | undefined
  const mVal = resto.match(RE_VALOR)
  if (mVal?.[1]) {
    valorUnitario = paraNumero(mVal[1])
    resto = resto.slice(0, resto.length - mVal[0].length)
  }

  let altura: number | undefined
  let largura: number | undefined
  const mDim = resto.match(RE_DIMENSAO)
  if (mDim?.[1] && mDim[2]) {
    altura = normalizarDimensao(mDim[1])
    largura = normalizarDimensao(mDim[2])
    resto = resto.replace(mDim[0], ' ')
  }

  const descricao = resto.replace(/\s+/g, ' ').trim()
  const unidadeSugerida: UnidadeCobranca = altura !== undefined ? 'm2' : 'unidade'
  const confianca = valorUnitario !== undefined ? 'alta' : 'parcial'

  return { quantidade, descricao, altura, largura, valorUnitario, unidadeSugerida, confianca }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- parser`
Expected: PASS — 14 passed

- [ ] **Step 5: Commit**

```bash
git add src/domain/precificacao/parser.ts src/domain/precificacao/parser.test.ts
git commit -m "feat: parser da entrada assistida de item"
```

---

### Task 9: Composição do preço da ordem

Soma itens e acréscimos, produz o preço calculado, e aplica o ajuste manual que gera o preço final.

**Files:**
- Create: `src/domain/precificacao/ordem.ts`
- Test: `src/domain/precificacao/ordem.test.ts`

**Interfaces:**
- Consumes: `calcularItem`, `dinheiro`, `arredondarCentavos`
- Produces:
  - `interface Acrescimo { tipo: string; descricao: string; valor: number }`
  - `interface ComposicaoOrdem { subtotalItens: Decimal; subtotalAcrescimos: Decimal; precoCalculado: Decimal; precoFinal: Decimal; ajuste: Decimal; temAjuste: boolean }`
  - `comporOrdem(itens: ItemCobranca[], acrescimos: Acrescimo[], precoFinalManual?: number): ComposicaoOrdem`

- [ ] **Step 1: Escrever o teste com a ordem real 18449**

`src/domain/precificacao/ordem.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { comporOrdem } from './ordem'
import type { ItemCobranca } from './tipos'

describe('comporOrdem', () => {
  it('soma itens e acrescimos', () => {
    const itens: ItemCobranca[] = [
      { unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 120.5, quantidade: 6 },
      { unidade: 'm2', altura: 0.51, largura: 0.61, valorUnitario: 76, quantidade: 3 },
      { unidade: 'unidade', valorUnitario: 34, quantidade: 18 },
      { unidade: 'metro_linear', altura: 0.61, largura: 0.6, valorUnitario: 28, quantidade: 1 },
    ]
    const acrescimos = [
      { tipo: 'instalacao', descricao: 'Instalacao', valor: 280 },
      { tipo: 'deslocamento', descricao: '34 km', valor: 102 },
    ]
    // 347,04 + 70,93 + 612,00 + 67,76 = 1.097,73
    const c = comporOrdem(itens, acrescimos)
    expect(c.subtotalItens.toString()).toBe('1097.73')
    expect(c.subtotalAcrescimos.toString()).toBe('382')
    expect(c.precoCalculado.toString()).toBe('1479.73')
    expect(c.precoFinal.toString()).toBe('1479.73')
    expect(c.temAjuste).toBe(false)
  })

  it('aplica desconto como ajuste manual', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 1000, quantidade: 2 }]
    const c = comporOrdem(itens, [], 1950)
    expect(c.precoCalculado.toString()).toBe('2000')
    expect(c.precoFinal.toString()).toBe('1950')
    expect(c.ajuste.toString()).toBe('-50')
    expect(c.temAjuste).toBe(true)
  })

  it('aceita ajuste para cima', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    const c = comporOrdem(itens, [], 130)
    expect(c.ajuste.toString()).toBe('30')
    expect(c.temAjuste).toBe(true)
  })

  it('nao marca ajuste quando o valor manual iguala o calculado', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    const c = comporOrdem(itens, [], 100)
    expect(c.temAjuste).toBe(false)
    expect(c.ajuste.toString()).toBe('0')
  })

  it('ordem vazia vale zero', () => {
    const c = comporOrdem([], [])
    expect(c.precoCalculado.toString()).toBe('0')
    expect(c.precoFinal.toString()).toBe('0')
  })

  it('rejeita preco final negativo', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    expect(() => comporOrdem(itens, [], -10)).toThrow('preco final nao pode ser negativo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- ordem`
Expected: FAIL — não consegue resolver `./ordem`

- [ ] **Step 3: Criar `src/domain/precificacao/ordem.ts`**

```ts
import { calcularItem } from './formulas'
import { dinheiro, arredondarCentavos, type Decimal } from './dinheiro'
import type { ItemCobranca } from './tipos'

export interface Acrescimo {
  tipo: string
  descricao: string
  valor: number
}

export interface ComposicaoOrdem {
  subtotalItens: Decimal
  subtotalAcrescimos: Decimal
  precoCalculado: Decimal
  precoFinal: Decimal
  ajuste: Decimal
  temAjuste: boolean
}

export function comporOrdem(
  itens: ItemCobranca[],
  acrescimos: Acrescimo[],
  precoFinalManual?: number,
): ComposicaoOrdem {
  const subtotalItens = arredondarCentavos(
    itens.reduce((soma, i) => soma.plus(calcularItem(i).total), dinheiro(0)),
  )
  const subtotalAcrescimos = arredondarCentavos(
    acrescimos.reduce((soma, a) => soma.plus(dinheiro(a.valor)), dinheiro(0)),
  )
  const precoCalculado = arredondarCentavos(subtotalItens.plus(subtotalAcrescimos))

  if (precoFinalManual === undefined) {
    return {
      subtotalItens, subtotalAcrescimos, precoCalculado,
      precoFinal: precoCalculado, ajuste: dinheiro(0), temAjuste: false,
    }
  }

  if (precoFinalManual < 0) {
    throw new Error('preco final nao pode ser negativo')
  }

  const precoFinal = arredondarCentavos(dinheiro(precoFinalManual))
  const ajuste = arredondarCentavos(precoFinal.minus(precoCalculado))

  return {
    subtotalItens, subtotalAcrescimos, precoCalculado,
    precoFinal, ajuste, temAjuste: !ajuste.isZero(),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- ordem`
Expected: PASS — 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/domain/precificacao/ordem.ts src/domain/precificacao/ordem.test.ts
git commit -m "feat: composicao do preco da ordem com ajuste manual"
```

---

### Task 10: Máquina de estados e a trava de pureza do domínio

Dois eixos independentes: produção é explícito, pagamento é derivado dos recebimentos. Fecha com um teste que impede o domínio de importar framework.

**Files:**
- Create: `src/domain/ordem/estados.ts`
- Test: `src/domain/ordem/estados.test.ts`
- Test: `src/domain/pureza.test.ts`

**Interfaces:**
- Consumes: `dinheiro` da Task 3
- Produces:
  - `type EstadoProducao = 'orcamento' | 'aberta' | 'concluida' | 'cancelada'`
  - `type EstadoPagamento = 'nao_pago' | 'parcial' | 'pago'`
  - `podeTransicionar(de: EstadoProducao, para: EstadoProducao): boolean`
  - `transicionar(de: EstadoProducao, para: EstadoProducao): EstadoProducao` — lança se inválida
  - `calcularEstadoPagamento(precoFinal: number, recebimentos: number[]): EstadoPagamento`

- [ ] **Step 1: Escrever o teste dos estados**

`src/domain/ordem/estados.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { podeTransicionar, transicionar, calcularEstadoPagamento } from './estados'

describe('transicoes de producao', () => {
  it.each([
    ['orcamento', 'aberta', true],
    ['orcamento', 'cancelada', true],
    ['aberta', 'concluida', true],
    ['aberta', 'cancelada', true],
    ['concluida', 'cancelada', true],
  ] as const)('%s -> %s permitida', (de, para) => {
    expect(podeTransicionar(de, para)).toBe(true)
  })

  it.each([
    ['orcamento', 'concluida'],
    ['concluida', 'aberta'],
    ['cancelada', 'aberta'],
    ['cancelada', 'concluida'],
    ['aberta', 'orcamento'],
  ] as const)('%s -> %s proibida', (de, para) => {
    expect(podeTransicionar(de, para)).toBe(false)
  })

  it('transicionar devolve o novo estado', () => {
    expect(transicionar('aberta', 'concluida')).toBe('concluida')
  })

  it('transicionar lanca em transicao invalida', () => {
    expect(() => transicionar('concluida', 'aberta')).toThrow(
      'transicao invalida: concluida -> aberta',
    )
  })

  it('nao permite transicao para o mesmo estado', () => {
    expect(podeTransicionar('aberta', 'aberta')).toBe(false)
  })
})

describe('estado de pagamento derivado', () => {
  it('sem recebimento e nao pago', () => {
    expect(calcularEstadoPagamento(1000, [])).toBe('nao_pago')
  })

  it('recebimento parcial', () => {
    expect(calcularEstadoPagamento(1000, [400])).toBe('parcial')
  })

  it('soma de varios recebimentos quita', () => {
    expect(calcularEstadoPagamento(1000, [400, 300, 300])).toBe('pago')
  })

  it('recebimento acima do total conta como pago', () => {
    expect(calcularEstadoPagamento(1000, [1200])).toBe('pago')
  })

  it('tolera diferenca de um centavo por arredondamento', () => {
    expect(calcularEstadoPagamento(100, [33.33, 33.33, 33.33])).toBe('pago')
  })

  it('ordem de valor zero ja nasce paga', () => {
    expect(calcularEstadoPagamento(0, [])).toBe('pago')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- estados`
Expected: FAIL — não consegue resolver `./estados`

- [ ] **Step 3: Criar `src/domain/ordem/estados.ts`**

```ts
import { dinheiro } from '../precificacao/dinheiro'

export type EstadoProducao = 'orcamento' | 'aberta' | 'concluida' | 'cancelada'
export type EstadoPagamento = 'nao_pago' | 'parcial' | 'pago'

const TRANSICOES: Record<EstadoProducao, readonly EstadoProducao[]> = {
  orcamento: ['aberta', 'cancelada'],
  aberta: ['concluida', 'cancelada'],
  concluida: ['cancelada'],
  cancelada: [],
}

export function podeTransicionar(de: EstadoProducao, para: EstadoProducao): boolean {
  return TRANSICOES[de].includes(para)
}

export function transicionar(de: EstadoProducao, para: EstadoProducao): EstadoProducao {
  if (!podeTransicionar(de, para)) {
    throw new Error(`transicao invalida: ${de} -> ${para}`)
  }
  return para
}

/** Tolerancia de um centavo, para nao deixar ordem eternamente "parcial"
 *  por diferenca de arredondamento em pagamento dividido. */
const TOLERANCIA = dinheiro('0.01')

export function calcularEstadoPagamento(
  precoFinal: number,
  recebimentos: number[],
): EstadoPagamento {
  const total = dinheiro(precoFinal)
  const recebido = recebimentos.reduce((s, r) => s.plus(dinheiro(r)), dinheiro(0))

  if (total.lessThanOrEqualTo(0)) return 'pago'
  if (recebido.lessThanOrEqualTo(0)) return 'nao_pago'
  if (recebido.greaterThanOrEqualTo(total.minus(TOLERANCIA))) return 'pago'
  return 'parcial'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- estados`
Expected: PASS — 17 passed

- [ ] **Step 5: Escrever a trava de pureza do domínio**

`src/domain/pureza.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PROIBIDOS = ['next', 'react', '@prisma/client', 'node:fs', 'node:http']

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivosDe(p)
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : []
  })
}

describe('pureza do dominio', () => {
  it('nenhum modulo de dominio importa framework ou I/O', () => {
    const violacoes: string[] = []
    for (const arq of arquivosDe(join(process.cwd(), 'src', 'domain'))) {
      const src = readFileSync(arq, 'utf-8')
      for (const p of PROIBIDOS) {
        if (new RegExp(`from\\s+['"]${p.replace('/', '\\/')}`).test(src)) {
          violacoes.push(`${arq} importa ${p}`)
        }
      }
    }
    expect(violacoes).toEqual([])
  })
})
```

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos verdes, incluindo a trava de pureza

- [ ] **Step 7: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros

- [ ] **Step 8: Commit**

```bash
git add src/domain/ordem/ src/domain/pureza.test.ts
git commit -m "feat: maquina de estados da ordem e trava de pureza do dominio"
```

---

## Critério de conclusão da Fase 1A

- [ ] `npm test` passa inteiro
- [ ] `npm run typecheck` sem erros
- [ ] As três fórmulas reproduzem o gabarito do legado dentro das tolerâncias declaradas
- [ ] Nenhum arquivo em `src/domain/` importa framework — verificado por teste, não por disciplina

Feito isso, a Fase 1B (Prisma, autenticação e layout com Tabler) ganha seu próprio plano.
