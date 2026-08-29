# Fase 6 — Histórico e complementos: as 18.443 ordens legadas, relatório do contador, anexo de arte e estados vazios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A última fase. As 18.443 ordens de 14 anos entram como arquivo consultável — texto preservado como veio, sem tentar estruturar —, o contador ganha o relatório que hoje ele pede por telefone, o anexo de arte encosta na ordem, e os estados vazios param de dizer "nenhum registro" e passam a ensinar o que fazer.

**Architecture:** `OrdemLegado` é tabela **somente leitura**: nasce da importação e nenhuma action do sistema escreve nela. Ela não é `OrdemServico` com um sinalizador — misturar as duas obrigaria toda query do sistema novo a lembrar de filtrar o passado, e a primeira que esquecesse mostraria uma ordem de 2013 na fila de produção. O texto de `OBS1..OBS7` entra num campo só, como veio; a ligação com o cliente é pelo `codigoLegado` que a Fase 2 já guardou. O relatório do contador é uma leitura sobre `lancamento_caixa`, agrupada por conta, sem tabela nova. O anexo é a única parte que precisa de serviço externo (Cloudflare R2) e está isolada numa tarefa própria, que **para** se a credencial não existir.

**Tech Stack:** o mesmo da Fase 5. O anexo acrescenta `@aws-sdk/client-s3` (o R2 fala o protocolo S3) — e só ele.

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 4 — Anexo —, 8 — R2 —, 10 — migração —, 12 — o contador emite, o sistema exporta — e 13)

## Global Constraints

- Dinheiro em `Decimal` no domínio, `numeric(12,4)` no banco, **string decimal** na fronteira; nunca `Number(prismaDecimal)`.
- Nada em `src/domain/` importa framework, banco ou infra (trava `src/domain/pureza.test.ts`).
- **Nada de `DELETE`** em dado de negócio.
- `OrdemLegado` é **somente leitura** depois da importação: nenhuma action escreve nela, e ela não aparece em nenhuma lista, fila ou indicador do sistema novo.
- **Não estruturar o texto antigo** (spec, seção 10): a extração varia até 2,2× conforme a regra de centímetro versus metro, e histórico estruturado errado é pior que texto honesto.
- Toda tabela carrega `empresa_id`; toda leitura filtra por `empresa_id` do usuário logado.
- Importação **idempotente**: rodar duas vezes não duplica nem apaga.
- TypeScript 7 (sem `baseUrl`; `it.each` declara todos os elementos; **nunca repetir chave antes do spread** — TS2783); Postgres local sem shadow: `npm run db:migrar -- <nome>`; `rtk` intercepta `ls`, `grep` e `npx prisma` — use `find`, o Grep tool, `node node_modules/prisma/build/index.js` e `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=<arquivo>`.
- `DATABASE_POOL_MAX=2` no `.env.local`; se o `prisma dev` recusar conexão, `dev stop drusign` e `dev -n drusign --detach`.

## O que este plano decide (29/08/2026)

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde o histórico mora | tabela **`ordem_legado`**, separada de `ordem_servico` | um sinalizador em `ordem_servico` obrigaria toda query do sistema a lembrar de excluir o passado; a primeira que esquecesse poria uma ordem de 2013 na fila de produção. Separado, o esquecimento é impossível |
| O texto das observações | `OBS1..OBS7` concatenados num campo `texto`, com as linhas na ordem original e as vazias descartadas; `OBS8` fora | `OBS8` é o texto fixo de garantia do impresso, igual em todas as ordens — já vive em `TEXTOS_IMPRESSO`. Os outros sete são o que a Odete digitou |
| Estruturar o texto | **não** | spec, seção 10, em letras claras. A mesma linha rende 2,2× de diferença conforme cm ou m; o gabarito da Fase 1A só fechou 96,1% com as regras conhecidas, e ali havia colunas separadas |
| Datas impossíveis | `dataEntrada` é obrigatória (nenhuma das 18.443 falha); `dataSaida` vira **null** quando não é data válida ou cai fora de 2000–2027, e o texto original fica em `dataSaidaTexto` | são 21 campos em ~8 ordens, com pérolas como `07060607` e `60180524`. Guardar o bruto ao lado do null é o que deixa conferir depois sem inventar |
| Saída antes da entrada | entra como está, marcada em `dataSaidaSuspeita` | 271 ordens. Corrigir seria inventar um dado que ninguém sabe; esconder seria mentir. A tela mostra a marca |
| Nome do cliente destruído | entra como está: `C A N C E L A D O`, com um aviso na tela | são 3.152 ordens (17,1%), destruídas pelo cancelamento do legado. O cliente ainda pode ser recuperado pelo `CODCLI`, que sobreviveu — e é o que a ligação por `codigoLegado` faz |
| Ligação com o cliente | por `cliente.codigoLegado` = `ORDEM.CODCLI`, resolvida **na importação**; sem correspondente, `clienteId` fica null e o nome do legado permanece | a Fase 2 já guardou o `codigoLegado`. Resolver na importação e não na leitura evita 18.443 joins por consulta |
| Numeração | o legado vai de 1 a 18.460 e o sistema novo começa em 18.461: **não colidem** | medido; nenhum `@@unique` precisa mudar |
| Onde se consulta | `/historico` com busca por número, cliente e texto; e a ficha do cliente ganha as ordens antigas dele | o valor do arquivo é achar "o que a gente fez para esse cliente em 2019" na frente do cliente |
| Relatório do contador | leitura sobre `lancamento_caixa` por período, agrupada por conta, com entradas, saídas e saldo, mais o detalhe; botão de baixar **CSV** | spec, seção 12: "o contador emite tudo; o sistema exporta relatório". CSV abre no Excel do escritório dele sem plugin |
| Anexo de arte | `Anexo` (ordem_id, tipo, chave_r2, nome_original, versao, enviado_por, enviado_em) no R2, por URL assinada | spec, seção 4. **Depende de credencial do R2** — se ela não existir, esta tarefa para e o resto da fase segue |
| Estados vazios | cada lista vazia diz o que é, por que está vazia e qual é o próximo passo | spec, tela 17: "ensinam o que fazer" |

**Fatos do legado medidos para este plano** (`ORDEM.DBF`, 29/08/2026): 18.443 ordens vivas, `NUMERO` de 1 a 18.460, todas com data de entrada válida e algum texto em `OBS1..OBS7`; soma de `TOTAL` = R$ 5.654.432,03; 271 com data de saída anterior à entrada; 21 campos de data absurdos em `DATASAI`/`DTAPROVA`/`DTENTREGA` (`07060607`, `60180524`, `19170804`); `CADASTRO` = `C A N C E L A D O` em 3.152 ordens e `CLIENTE DIVERSOS` em 1.192; 3.099 nomes distintos; `SITUACAO` = "Entrega direto para o cliente" em 12.218 e "Aguardando Aprovação" em 5.954 — inclusive em ordens já entregues, que é por que a spec não migra situação como estado.

---

### Task 1: Domínio e schema do arquivo legado

**Files:**
- Create: `src/domain/legado/ordem.ts`, `src/domain/legado/ordem.test.ts`
- Modify: `prisma/schema.prisma` (model `OrdemLegado`)
- Create: `prisma/migrations/<timestamp>_ordem_legado/migration.sql` (gerada)

**Interfaces:**
- Consumes: `dinheiro`, `arredondarCentavos`; `ErroDeValidacao`.
- Produces: `interface OrdemLegadaConvertida`, `converterOrdemLegado(v: Record<string, string>): OrdemLegadaConvertida`, `juntarObservacoes(v): string`, `lerDataDbf(texto: string): Date | null`, `ANO_MINIMO`/`ANO_MAXIMO`; tabela `ordem_legado`.

- [ ] **Step 1: A conversão (teste)**

`src/domain/legado/ordem.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { converterOrdemLegado, juntarObservacoes, lerDataDbf } from './ordem'

const vazio: Record<string, string> = {
  NUMERO: '', DATAENT: '', DATASAI: '', CODCLI: '', CADASTRO: '', TELEFONE: '', SITUACAO: '',
  OBS1: '', OBS2: '', OBS3: '', OBS4: '', OBS5: '', OBS6: '', OBS7: '', OBS8: '',
  VLRPROD: '', VLRSERV: '', MAO_OBRA: '', DESLOCA: '', DESCONTO: '', TOTAL: '',
  FORMA: '', RESPONSA: '', USUARIO: '',
}
const linha = (p: Partial<Record<string, string>>): Record<string, string> => ({ ...vazio, ...p })

describe('lerDataDbf', () => {
  it.each([
    ['20260829', '2026-08-29T00:00:00.000Z'],
    ['20120507', '2012-05-07T00:00:00.000Z'],
  ])('%s vira %s', (bruto: string, iso: string) => {
    expect(lerDataDbf(bruto)?.toISOString()).toBe(iso)
  })

  it.each([
    ['07060607'], // a data absurda que a spec cita, da OS 9905
    ['60180524'],
    ['19170804'],
    ['02000305'],
    [''],
    ['        '],
    ['2026082'],
    ['20261332'],
  ])('recusa %s', (bruto: string) => {
    expect(lerDataDbf(bruto)).toBeNull()
  })
})

describe('juntarObservacoes', () => {
  it('junta OBS1..OBS7 na ordem, descarta vazias e nao inclui OBS8', () => {
    expect(juntarObservacoes(linha({ OBS1: '06 PLACAS ACM', OBS3: '60 X 80', OBS7: 'entregar na fazenda', OBS8: 'Sempre guarde esse comprovante' })))
      .toBe('06 PLACAS ACM\n60 X 80\nentregar na fazenda')
  })
  it('sem observacao nenhuma da string vazia', () => {
    expect(juntarObservacoes(vazio)).toBe('')
  })
  it('preserva o texto como veio, inclusive espacos internos e acentuacao do CP1252', () => {
    expect(juntarObservacoes(linha({ OBS1: '  IMPRESSÃO  ADESIVO   4x0  ' }))).toBe('IMPRESSÃO  ADESIVO   4x0')
  })
})

describe('converterOrdemLegado', () => {
  it('le a OS inteira, com dinheiro em string decimal', () => {
    const o = converterOrdemLegado(linha({
      NUMERO: '18449', DATAENT: '20260820', DATASAI: '20260827', CODCLI: '1462',
      CADASTRO: 'SANDRA HOFIG DE BARROS', TELEFONE: '(38)9874-3013', SITUACAO: 'Entrega direto para o cliente',
      OBS1: '06 PLACAS ACM 60X 80', OBS2: '01 PLACA ACM 50 X 50',
      VLRPROD: '2528.00', TOTAL: '2528.00', DESCONTO: '0.00',
      FORMA: 'Avista', RESPONSA: 'ODETE', USUARIO: 'ODETE',
    }))
    expect(o).toMatchObject({
      numero: 18449, codigoClienteLegado: 1462, clienteNome: 'SANDRA HOFIG DE BARROS',
      telefone: '(38)9874-3013', situacao: 'Entrega direto para o cliente',
      texto: '06 PLACAS ACM 60X 80\n01 PLACA ACM 50 X 50',
      total: '2528.00', valorProdutos: '2528.00', desconto: '0.00',
      forma: 'Avista', responsavel: 'ODETE', usuario: 'ODETE',
      dataSaidaTexto: null, dataSaidaSuspeita: false, nomeDestruido: false,
    })
    expect(o.dataEntrada.toISOString()).toBe('2026-08-20T00:00:00.000Z')
    expect(o.dataSaida?.toISOString()).toBe('2026-08-27T00:00:00.000Z')
  })

  it('data de saida impossivel vira null e o bruto fica guardado ao lado', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '9905', DATAENT: '20130411', DATASAI: '07060607', TOTAL: '10.00' }))
    expect(o.dataSaida).toBeNull()
    expect(o.dataSaidaTexto).toBe('07060607')
  })

  it('saida antes da entrada entra como esta, marcada — sao 271 ordens', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '100', DATAENT: '20200510', DATASAI: '20200409', TOTAL: '10.00' }))
    expect(o.dataSaida?.toISOString()).toBe('2020-04-09T00:00:00.000Z')
    expect(o.dataSaidaSuspeita).toBe(true)
  })

  it('o nome destruido pelo cancelamento do legado entra como esta, marcado — sao 3.152', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '5', DATAENT: '20130101', CADASTRO: 'C A N C E L A D O', TOTAL: '0.00' }))
    expect(o).toMatchObject({ clienteNome: 'C A N C E L A D O', nomeDestruido: true })
  })

  it('venda de balcao do legado nao vira nome de cliente', () => {
    expect(converterOrdemLegado(linha({ NUMERO: '6', DATAENT: '20130101', CADASTRO: 'CLIENTE DIVERSOS', TOTAL: '0.00' })).clienteNome).toBe('CLIENTE DIVERSOS')
  })

  it('valores vazios ou com virgula viram string decimal de duas casas', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '7', DATAENT: '20130101', VLRSERV: '1.358,81', MAO_OBRA: '', DESLOCA: '102,00', TOTAL: '1460,81' }))
    expect(o).toMatchObject({ valorServicos: '1358.81', maoDeObra: '0.00', deslocamento: '102.00', total: '1460.81' })
  })

  it('codigo de cliente ausente ou zero vira null', () => {
    expect(converterOrdemLegado(linha({ NUMERO: '8', DATAENT: '20130101', CODCLI: '0' })).codigoClienteLegado).toBeNull()
    expect(converterOrdemLegado(linha({ NUMERO: '9', DATAENT: '20130101', CODCLI: '' })).codigoClienteLegado).toBeNull()
  })

  it('recusa a linha sem numero ou sem data de entrada, que nao existe na base', () => {
    expect(() => converterOrdemLegado(linha({ NUMERO: '', DATAENT: '20130101' }))).toThrow(/numero/)
    expect(() => converterOrdemLegado(linha({ NUMERO: '10', DATAENT: '' }))).toThrow(/data de entrada/)
  })
})
```

Run: `npm test -- src/domain/legado` → vermelho.

- [ ] **Step 2: A conversão (implementação)**

`src/domain/legado/ordem.ts`:
```ts
import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'
import { ErroDeValidacao } from '../precificacao/erros'

/** O legado comecou em 2012 e o sistema novo entra em 2026: fora disso e lixo de digitacao. */
export const ANO_MINIMO = 2000
export const ANO_MAXIMO = 2027

/** Nome que o cancelamento do legado destruiu, em 3.152 ordens (spec, secao 4). */
const NOME_DESTRUIDO = 'C A N C E L A D O'

/** 'AAAAMMDD' do DBF. Devolve null para vazio, malformado ou data impossivel. */
export function lerDataDbf(texto: string): Date | null {
  const t = texto.trim()
  if (!/^\d{8}$/.test(t)) return null
  const ano = Number(t.slice(0, 4))
  const mes = Number(t.slice(4, 6))
  const dia = Number(t.slice(6))
  if (ano < ANO_MINIMO || ano > ANO_MAXIMO) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null
}

/** OBS8 fica de fora: e o texto fixo de garantia do impresso, igual nas 18.443. */
export function juntarObservacoes(v: Record<string, string>): string {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((n) => (v[`OBS${n}`] ?? '').trim())
    .filter((l) => l !== '')
    .join('\n')
}

function decimal(texto: string): string {
  const t = (texto ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (t === '') return '0.00'
  const d = dinheiro(/^-?\d+(\.\d+)?$/.test(t) ? t : '0')
  return arredondarCentavos(d).toFixed(2)
}

export interface OrdemLegadaConvertida {
  numero: number
  dataEntrada: Date
  dataSaida: Date | null
  /** O bruto do DBF quando a data nao converteu — para conferir sem inventar. */
  dataSaidaTexto: string | null
  /** Saida anterior a entrada: 271 ordens. Entra como esta, marcada. */
  dataSaidaSuspeita: boolean
  codigoClienteLegado: number | null
  clienteNome: string
  nomeDestruido: boolean
  telefone: string
  situacao: string
  /** OBS1..OBS7 como vieram. Nunca estruturado (spec, secao 10). */
  texto: string
  valorProdutos: string
  valorServicos: string
  maoDeObra: string
  deslocamento: string
  desconto: string
  total: string
  forma: string
  responsavel: string
  usuario: string
}

export function converterOrdemLegado(v: Record<string, string>): OrdemLegadaConvertida {
  const numero = Number((v.NUMERO ?? '').trim())
  if (!Number.isInteger(numero) || numero <= 0) throw new ErroDeValidacao(`ordem sem numero: ${JSON.stringify(v.NUMERO)}`)
  const dataEntrada = lerDataDbf(v.DATAENT ?? '')
  if (!dataEntrada) throw new ErroDeValidacao(`ordem ${numero} sem data de entrada valida: ${JSON.stringify(v.DATAENT)}`)

  const brutoSaida = (v.DATASAI ?? '').trim()
  const dataSaida = lerDataDbf(brutoSaida)
  const codigo = Number((v.CODCLI ?? '').trim())
  const clienteNome = (v.CADASTRO ?? '').trim()
  const texto = (s: string | undefined, tamanho: number) => (s ?? '').trim().slice(0, tamanho)

  return {
    numero,
    dataEntrada,
    dataSaida,
    dataSaidaTexto: dataSaida === null && brutoSaida !== '' ? brutoSaida : null,
    dataSaidaSuspeita: dataSaida !== null && dataSaida.getTime() < dataEntrada.getTime(),
    codigoClienteLegado: Number.isInteger(codigo) && codigo > 0 ? codigo : null,
    clienteNome,
    nomeDestruido: clienteNome.toUpperCase() === NOME_DESTRUIDO,
    telefone: texto(v.TELEFONE, 20),
    situacao: texto(v.SITUACAO, 40),
    texto: juntarObservacoes(v),
    valorProdutos: decimal(v.VLRPROD ?? ''),
    valorServicos: decimal(v.VLRSERV ?? ''),
    maoDeObra: decimal(v.MAO_OBRA ?? ''),
    deslocamento: decimal(v.DESLOCA ?? ''),
    desconto: decimal(v.DESCONTO ?? ''),
    total: decimal(v.TOTAL ?? ''),
    forma: texto(v.FORMA, 20),
    responsavel: texto(v.RESPONSA, 40),
    usuario: texto(v.USUARIO, 20),
  }
}
```

Run: `npm test -- src/domain/legado` → PASS.

- [ ] **Step 3: A tabela**

Em `prisma/schema.prisma`, no fim:
```prisma
/// As 18.443 ordens de 14 anos, somente leitura (spec, secao 10). Separada de OrdemServico de
/// proposito: um sinalizador obrigaria toda query do sistema a lembrar de excluir o passado.
model OrdemLegado {
  id        String   @id @default(uuid(7)) @db.Uuid
  empresaId String   @map("empresa_id") @db.Uuid
  empresa   Empresa  @relation(fields: [empresaId], references: [id])
  numero    Int

  dataEntrada       DateTime  @map("data_entrada") @db.Date
  dataSaida         DateTime? @map("data_saida") @db.Date
  /// O bruto do DBF quando a data nao converteu: '07060607', '60180524'.
  dataSaidaTexto    String?   @map("data_saida_texto") @db.VarChar(8)
  /// Saida anterior a entrada: 271 ordens entram assim mesmo, marcadas.
  dataSaidaSuspeita Boolean   @default(false) @map("data_saida_suspeita")

  /// CODCLI do legado, resolvido para cliente na importacao. Sem correspondente, clienteId fica null.
  codigoClienteLegado Int?     @map("codigo_cliente_legado")
  clienteId           String?  @map("cliente_id") @db.Uuid
  cliente             Cliente? @relation(fields: [clienteId], references: [id])
  /// Como estava no DBF, inclusive "C A N C E L A D O" (3.152 ordens).
  clienteNome         String   @map("cliente_nome") @db.VarChar(60)
  nomeDestruido       Boolean  @default(false) @map("nome_destruido")
  telefone            String   @db.VarChar(20)

  situacao String @db.VarChar(40)
  /// OBS1..OBS7 como vieram. Nunca estruturado.
  texto    String

  valorProdutos Decimal @map("valor_produtos") @db.Decimal(12, 4)
  valorServicos Decimal @map("valor_servicos") @db.Decimal(12, 4)
  maoDeObra     Decimal @map("mao_de_obra") @db.Decimal(12, 4)
  deslocamento  Decimal @db.Decimal(12, 4)
  desconto      Decimal @db.Decimal(12, 4)
  total         Decimal @db.Decimal(12, 4)

  forma       String @db.VarChar(20)
  responsavel String @db.VarChar(40)
  usuario     String @db.VarChar(20)

  importadoEm DateTime @default(now()) @map("importado_em") @db.Timestamptz(3)

  @@unique([empresaId, numero])
  @@index([empresaId, dataEntrada])
  @@index([empresaId, clienteId])
  @@map("ordem_legado")
}
```
Em `Empresa`, acrescentar às relações: `ordensLegadas OrdemLegado[]`. Em `Cliente`, acrescentar: `ordensLegadas OrdemLegado[]`.

Run: `npm run db:migrar -- ordem_legado`
Expected: `CREATE TABLE "ordem_legado"` com as colunas acima, `ordem_legado_empresa_id_numero_key` e os dois índices. Conferir o SQL antes de seguir — se houver `DROP`, parar. Run: `npm run typecheck` → sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/domain/legado prisma/schema.prisma prisma/migrations
git commit -m "feat: tabela e conversao do arquivo de ordens legadas, com o texto preservado como veio"
```

---

### Task 2: Importação das 18.443 ordens

**Files:**
- Create: `src/infra/importacao/ordens-legado.ts`, `scripts/importar-ordens.ts`
- Modify: `package.json` (script `importar:ordens`)
- Test: `src/infra/importacao/ordens-legado.int.test.ts`

**Interfaces:**
- Consumes: `lerDbf`, `converterOrdemLegado`, `prisma`, `paraBanco`.
- Produces: `importarOrdensLegado(caminhoDbf, empresaId): Promise<ResultadoImportacaoOrdens>` com `{ total, importadas, jaExistiam, ligadasACliente, semCliente, comDataSaidaImpossivel, comSaidaAntesDaEntrada, comNomeDestruido, somaTotal }`; `npm run importar:ordens`.

- [ ] **Step 1: O teste de integração**

`src/infra/importacao/ordens-legado.int.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { importarOrdensLegado } from './ordens-legado'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/ORDEM.DBF'

// O harness trunca antes de cada `it`: tudo num teste so, e a importacao inteira demora.
describe.skipIf(!existsSync(DBF))('importacao das ordens legadas', () => {
  it('importa as 18.443 como estao, liga ao cliente pelo codigo e nao repete', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    // Um cliente com o codigo legado da OS 18449, para provar a ligacao.
    const sandra = await prisma.cliente.create({ data: { empresaId: empresa.id, nome: 'Sandra Hofig de Barros', codigoLegado: 1462 } })

    const r = await importarOrdensLegado(DBF, empresa.id)
    expect(r).toMatchObject({ total: 18_443, importadas: 18_443, jaExistiam: 0 })
    expect(r.comSaidaAntesDaEntrada).toBe(271)
    expect(r.comNomeDestruido).toBe(3152)
    expect(r.somaTotal).toBe('5654432.03')
    expect(r.ligadasACliente).toBeGreaterThan(0)

    expect(await prisma.ordemLegado.count({ where: { empresaId: empresa.id } })).toBe(18_443)

    const os = await prisma.ordemLegado.findFirstOrThrow({ where: { empresaId: empresa.id, numero: 18449 } })
    expect(os.dataEntrada).not.toBeNull()
    expect(os.texto.length).toBeGreaterThan(0)
    expect(paraDominio(os.total).toFixed(2)).toBe('2528.00')
    expect(os.clienteId).toBe(sandra.id)

    // As ordens do cliente ligado aparecem por ele.
    expect(await prisma.ordemLegado.count({ where: { clienteId: sandra.id } })).toBeGreaterThan(0)

    // Data impossivel: null com o bruto guardado.
    const impossivel = await prisma.ordemLegado.findFirst({ where: { empresaId: empresa.id, dataSaidaTexto: { not: null } } })
    expect(impossivel?.dataSaida).toBeNull()
    expect(impossivel?.dataSaidaTexto).toMatch(/^\d{8}$/)

    const deNovo = await importarOrdensLegado(DBF, empresa.id)
    expect(deNovo).toMatchObject({ total: 0, importadas: 0, jaExistiam: 18_443 })
    expect(await prisma.ordemLegado.count({ where: { empresaId: empresa.id } })).toBe(18_443)
  }, 300_000)
})
```

Run: `npm run test:int -- ordens-legado` → vermelho.

- [ ] **Step 2: A importação (implementação)**

`src/infra/importacao/ordens-legado.ts`:
```ts
import { lerDbf } from './dbf'
import { prisma } from '@/infra/db/prisma'
import { paraBanco } from '@/infra/db/decimal'
import { dinheiro, arredondarCentavos } from '@/domain/precificacao/dinheiro'
import { converterOrdemLegado } from '@/domain/legado/ordem'

export interface ResultadoImportacaoOrdens {
  total: number
  importadas: number
  jaExistiam: number
  ligadasACliente: number
  semCliente: number
  comDataSaidaImpossivel: number
  comSaidaAntesDaEntrada: number
  comNomeDestruido: number
  /** Soma de TOTAL, para conferir contra o legado: R$ 5.654.432,03. */
  somaTotal: string
}

/** 18.443 linhas de uma vez estouram o parametro maximo do Postgres; em lotes, nao. */
const LOTE = 500

/** Idempotente por cobertura: se a empresa ja tem ordem legada, nao importa de novo. */
export async function importarOrdensLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacaoOrdens> {
  const jaExistiam = await prisma.ordemLegado.count({ where: { empresaId } })
  const vazio = { total: 0, importadas: 0, ligadasACliente: 0, semCliente: 0, comDataSaidaImpossivel: 0, comSaidaAntesDaEntrada: 0, comNomeDestruido: 0, somaTotal: '0.00' }
  if (jaExistiam > 0) return { ...vazio, jaExistiam }

  const linhas = lerDbf(caminhoDbf).registros.filter((r) => !r.apagado)
  const ordens = linhas.map((r) => converterOrdemLegado(r.valores as Record<string, string>))

  // Uma consulta so para resolver os 3.219 codigos, em vez de 18.443 joins.
  const clientes = await prisma.cliente.findMany({
    where: { empresaId, codigoLegado: { not: null } },
    select: { id: true, codigoLegado: true },
  })
  const porCodigo = new Map(clientes.map((c) => [c.codigoLegado as number, c.id]))

  let soma = dinheiro(0)
  const dados = ordens.map((o) => {
    soma = soma.plus(dinheiro(o.total))
    return {
      empresaId,
      numero: o.numero,
      dataEntrada: o.dataEntrada,
      dataSaida: o.dataSaida,
      dataSaidaTexto: o.dataSaidaTexto,
      dataSaidaSuspeita: o.dataSaidaSuspeita,
      codigoClienteLegado: o.codigoClienteLegado,
      clienteId: o.codigoClienteLegado === null ? null : porCodigo.get(o.codigoClienteLegado) ?? null,
      clienteNome: o.clienteNome.slice(0, 60),
      nomeDestruido: o.nomeDestruido,
      telefone: o.telefone,
      situacao: o.situacao,
      texto: o.texto,
      valorProdutos: paraBanco(dinheiro(o.valorProdutos)),
      valorServicos: paraBanco(dinheiro(o.valorServicos)),
      maoDeObra: paraBanco(dinheiro(o.maoDeObra)),
      deslocamento: paraBanco(dinheiro(o.deslocamento)),
      desconto: paraBanco(dinheiro(o.desconto)),
      total: paraBanco(dinheiro(o.total)),
      forma: o.forma,
      responsavel: o.responsavel,
      usuario: o.usuario,
    }
  })

  for (let i = 0; i < dados.length; i += LOTE) {
    await prisma.ordemLegado.createMany({ data: dados.slice(i, i + LOTE) })
  }

  return {
    total: ordens.length,
    importadas: dados.length,
    jaExistiam: 0,
    ligadasACliente: dados.filter((d) => d.clienteId !== null).length,
    semCliente: dados.filter((d) => d.clienteId === null).length,
    comDataSaidaImpossivel: ordens.filter((o) => o.dataSaidaTexto !== null).length,
    comSaidaAntesDaEntrada: ordens.filter((o) => o.dataSaidaSuspeita).length,
    comNomeDestruido: ordens.filter((o) => o.nomeDestruido).length,
    somaTotal: arredondarCentavos(soma).toFixed(2),
  }
}
```

`scripts/importar-ordens.ts`:
```ts
// Uso: npm run importar:ordens [caminho-do-ORDEM.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarOrdensLegado } from '../src/infra/importacao/ordens-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/ORDEM.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const r = await importarOrdensLegado(caminho, empresa.id)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: "${empresa.razaoSocial}" ja tem ${r.jaExistiam} ordens legadas`)
    return
  }
  console.log(`${r.importadas} ordens legadas importadas para "${empresa.razaoSocial}" (soma R$ ${r.somaTotal})`)
  console.log(`  ligadas a um cliente do cadastro: ${r.ligadasACliente} · sem cliente: ${r.semCliente}`)
  console.log(`  nome destruido pelo legado: ${r.comNomeDestruido} · saida antes da entrada: ${r.comSaidaAntesDaEntrada} · data de saida impossivel: ${r.comDataSaidaImpossivel}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

Em `package.json`, ao lado de `importar:plano`: `"importar:ordens": "tsx scripts/importar-ordens.ts"`.

Run: `npm run test:int -- ordens-legado` → PASS (1). Run: `npm run importar:ordens` no banco de desenvolvimento → `18443 ordens legadas importadas … (soma R$ 5654432.03)`.

- [ ] **Step 3: Commit**

```bash
git add src/infra/importacao/ordens-legado.ts src/infra/importacao/ordens-legado.int.test.ts scripts/importar-ordens.ts package.json
git commit -m "feat: importacao das 18.443 ordens legadas, ligadas ao cliente pelo codigo do legado"
```

---
### Task 3: A consulta do histórico

**Files:**
- Create: `src/infra/legado/consulta.ts`, `src/app/(app)/historico/page.tsx`
- Modify: `src/app/(app)/navegacao.ts`, `src/app/(app)/layout.tsx` (ícone), `src/app/(app)/clientes/[id]/page.tsx` (as ordens antigas do cliente)
- Test: `src/infra/legado/consulta.int.test.ts`

**Interfaces:**
- Consumes: `prisma`, `paraDominio`, `limitesDoDia`, `ErroDeValidacao`.
- Produces: `interface LinhaHistorico`, `interface Historico`, `buscarHistorico(empresaId, filtros: FiltrosHistorico): Promise<Historico>`, `historicoDoCliente(empresaId, clienteId, limite?): Promise<LinhaHistorico[]>`.

- [ ] **Step 1: A consulta (teste de integração)**

`src/infra/legado/consulta.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { buscarHistorico, historicoDoCliente } from './consulta'

let empresaId = ''
let clienteId = ''

const ordem = (numero: number, p: Record<string, unknown> = {}) => ({
  empresaId, numero, dataEntrada: new Date('2019-06-15T00:00:00.000Z'), clienteNome: 'CLIENTE DIVERSOS',
  telefone: '', situacao: 'Entrega Normal', texto: 'PLACA ACM 60X80',
  valorProdutos: '0.0000', valorServicos: '0.0000', maoDeObra: '0.0000', deslocamento: '0.0000',
  desconto: '0.0000', total: '100.0000', forma: 'Avista', responsavel: 'ODETE', usuario: 'ODETE', ...p,
})

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  empresaId = empresa.id
  const cliente = await prisma.cliente.create({ data: { empresaId, nome: 'FAZENDA HJ', apelido: 'HJ', codigoLegado: 42 } })
  clienteId = cliente.id
  await prisma.ordemLegado.createMany({
    data: [
      ordem(1001, { clienteId, clienteNome: 'SANDRA HOFIG DE BARROS', texto: 'PLACA ACM 60X80\nADESIVO IMPRESSO', total: '723.0000', dataEntrada: new Date('2019-06-15T00:00:00.000Z') }),
      ordem(1002, { clienteId, texto: 'BANNER 200X100', total: '150.0000', dataEntrada: new Date('2021-03-10T00:00:00.000Z') }),
      ordem(1003, { clienteNome: 'C A N C E L A D O', nomeDestruido: true, texto: 'FAIXA', total: '80.0000', dataEntrada: new Date('2015-01-20T00:00:00.000Z') }),
      ordem(1004, { texto: 'LETRA CAIXA EM PVC', total: '2500.0000', dataEntrada: new Date('2024-11-05T00:00:00.000Z'), dataSaidaSuspeita: true }),
    ],
  })
})

describe('consulta do historico (banco real)', () => {
  it('sem filtro, traz da mais recente para a mais antiga, com o total somado', async () => {
    const h = await buscarHistorico(empresaId, {})
    expect(h.linhas.map((l) => l.numero)).toEqual([1004, 1002, 1001, 1003])
    expect(h).toMatchObject({ encontradas: 4, somaTotal: '3453.00' })
  })

  it('busca por numero exato, por nome e por trecho do texto, sem diferenciar maiuscula', async () => {
    expect((await buscarHistorico(empresaId, { q: '1002' })).linhas.map((l) => l.numero)).toEqual([1002])
    expect((await buscarHistorico(empresaId, { q: 'sandra' })).linhas.map((l) => l.numero)).toEqual([1001])
    expect((await buscarHistorico(empresaId, { q: 'letra caixa' })).linhas.map((l) => l.numero)).toEqual([1004])
    expect((await buscarHistorico(empresaId, { q: 'adesivo' })).linhas.map((l) => l.numero)).toEqual([1001])
    expect((await buscarHistorico(empresaId, { q: 'nao existe nada assim' })).linhas).toEqual([])
  })

  it('filtra por periodo da data de entrada; periodo invertido e recusado', async () => {
    expect((await buscarHistorico(empresaId, { de: '2019-01-01', ate: '2021-12-31' })).linhas.map((l) => l.numero)).toEqual([1002, 1001])
    await expect(buscarHistorico(empresaId, { de: '2021-12-31', ate: '2019-01-01' })).rejects.toThrow(/período/)
  })

  it('traz as marcas que a importacao gravou, para a tela nao mentir', async () => {
    const h = await buscarHistorico(empresaId, { q: '1003' })
    expect(h.linhas[0]).toMatchObject({ clienteNome: 'C A N C E L A D O', nomeDestruido: true })
    expect((await buscarHistorico(empresaId, { q: '1004' })).linhas[0]).toMatchObject({ dataSaidaSuspeita: true })
  })

  it('o limite corta a lista mas a contagem diz quantas existem', async () => {
    const h = await buscarHistorico(empresaId, { limite: 2 })
    expect(h.linhas).toHaveLength(2)
    expect(h.encontradas).toBe(4)
  })

  it('as ordens antigas do cliente vem pelo id, da mais recente para a mais antiga', async () => {
    expect((await historicoDoCliente(empresaId, clienteId)).map((l) => l.numero)).toEqual([1002, 1001])
  })

  it('nao enxerga o historico de outra empresa', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    expect((await buscarHistorico(outra.id, {})).linhas).toEqual([])
    expect(await historicoDoCliente(outra.id, clienteId)).toEqual([])
  })
})
```

Run: `npm run test:int -- consulta` → vermelho.

- [ ] **Step 2: A consulta (implementação)**

`src/infra/legado/consulta.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { dinheiro, arredondarCentavos } from '@/domain/precificacao/dinheiro'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { lerDataCalendario } from '@/domain/ordem/datas'

export interface LinhaHistorico {
  id: string
  numero: number
  /** ISO da @db.Date. */
  dataEntrada: string
  dataSaida: string | null
  dataSaidaTexto: string | null
  dataSaidaSuspeita: boolean
  clienteId: string | null
  clienteNome: string
  nomeDestruido: boolean
  telefone: string
  situacao: string
  texto: string
  total: string
  forma: string
  responsavel: string
}

export interface FiltrosHistorico {
  /** Numero exato, ou trecho do nome do cliente ou do texto da ordem. */
  q?: string
  de?: string
  ate?: string
  limite?: number
}

export interface Historico {
  linhas: LinhaHistorico[]
  /** Quantas atendem ao filtro, mesmo quando o limite corta a lista. */
  encontradas: number
  somaTotal: string
}

const LIMITE_PADRAO = 100

function paraLinha(o: {
  id: string; numero: number; dataEntrada: Date; dataSaida: Date | null; dataSaidaTexto: string | null
  dataSaidaSuspeita: boolean; clienteId: string | null; clienteNome: string; nomeDestruido: boolean
  telefone: string; situacao: string; texto: string; total: unknown; forma: string; responsavel: string
}): LinhaHistorico {
  return {
    id: o.id, numero: o.numero,
    dataEntrada: o.dataEntrada.toISOString(),
    dataSaida: o.dataSaida?.toISOString() ?? null,
    dataSaidaTexto: o.dataSaidaTexto,
    dataSaidaSuspeita: o.dataSaidaSuspeita,
    clienteId: o.clienteId, clienteNome: o.clienteNome, nomeDestruido: o.nomeDestruido,
    telefone: o.telefone, situacao: o.situacao, texto: o.texto,
    total: paraDominio(o.total as Parameters<typeof paraDominio>[0]).toFixed(2),
    forma: o.forma, responsavel: o.responsavel,
  }
}

const COLUNAS = {
  id: true, numero: true, dataEntrada: true, dataSaida: true, dataSaidaTexto: true, dataSaidaSuspeita: true,
  clienteId: true, clienteNome: true, nomeDestruido: true, telefone: true, situacao: true, texto: true,
  total: true, forma: true, responsavel: true,
} as const

/** O arquivo e so leitura: nenhuma action escreve aqui, e nada daqui entra em fila ou indicador. */
export async function buscarHistorico(empresaId: string, filtros: FiltrosHistorico): Promise<Historico> {
  const q = filtros.q?.trim() ?? ''
  let periodo = {}
  if (filtros.de && filtros.ate) {
    const d = lerDataCalendario(filtros.de)
    const a = lerDataCalendario(filtros.ate)
    if (!d || !a || d.getTime() > a.getTime()) throw new ErroDeValidacao('período inválido')
    periodo = { dataEntrada: { gte: d, lte: a } }
  }
  const where = {
    empresaId,
    ...periodo,
    ...(q === '' ? {} : /^\d+$/.test(q)
      ? { numero: Number(q) }
      : { OR: [{ clienteNome: { contains: q, mode: 'insensitive' as const } }, { texto: { contains: q, mode: 'insensitive' as const } }] }),
  }
  const [linhas, encontradas, soma] = await Promise.all([
    prisma.ordemLegado.findMany({ where, orderBy: [{ dataEntrada: 'desc' }, { numero: 'desc' }], take: filtros.limite ?? LIMITE_PADRAO, select: COLUNAS }),
    prisma.ordemLegado.count({ where }),
    prisma.ordemLegado.aggregate({ where, _sum: { total: true } }),
  ])
  const somaTotal = soma._sum.total ? arredondarCentavos(paraDominio(soma._sum.total)).toFixed(2) : '0.00'
  return { linhas: linhas.map(paraLinha), encontradas, somaTotal: dinheiro(somaTotal).toFixed(2) }
}

/** "O que a gente ja fez para esse cliente" — a pergunta que se faz na frente dele. */
export async function historicoDoCliente(empresaId: string, clienteId: string, limite = 50): Promise<LinhaHistorico[]> {
  const linhas = await prisma.ordemLegado.findMany({
    where: { empresaId, clienteId },
    orderBy: [{ dataEntrada: 'desc' }, { numero: 'desc' }],
    take: limite,
    select: COLUNAS,
  })
  return linhas.map(paraLinha)
}
```

Run: `npm run test:int -- consulta` → PASS (7).

- [ ] **Step 3: A tela do histórico**

Em `navegacao.ts`, depois de "Ordens": `{ href: '/historico', titulo: 'Histórico', icone: 'historico' }`, e `'historico'` no tipo `icone`. Em `layout.tsx`, importar `IconArchive` e acrescentar `historico: <IconArchive className="icon" />`.

`src/app/(app)/historico/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { buscarHistorico } from '@/infra/legado/consulta'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'

export const metadata: Metadata = { title: 'Histórico' }

const R$ = (v: string) => formatarMoeda(dinheiro(v))

export default async function PaginaHistorico({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string }> }) {
  const usuario = await exigirUsuario()
  const { q = '', de = '', ate = '' } = await searchParams
  let erro: string | null = null
  let historico
  try {
    historico = await buscarHistorico(usuario.empresaId, { q, de: de || undefined, ate: ate || undefined })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    historico = await buscarHistorico(usuario.empresaId, { q })
  }

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Arquivo</div>
        <h2 className="page-title">Histórico do sistema antigo</h2>
        <div className="text-secondary">Somente leitura. É o que a loja fez de 2012 a 2026, com o texto exatamente como foi digitado.</div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3" role="search">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="q">Buscar</label>
              <div className="input-icon">
                <span className="input-icon-addon"><IconSearch className="icon" /></span>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou o que estava escrito" autoFocus />
              </div>
            </div>
            <div className="col-md-2"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={de} /></div>
            <div className="col-md-2"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} /></div>
            <div className="col-md-3 d-flex gap-2"><button type="submit" className="btn btn-primary">Buscar</button><Link href="/historico" className="btn">Limpar</Link></div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — ignorando o período.</div> : null}
          </div>
        </form>

        {historico.linhas.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty">
            <p className="empty-title">{q || de ? 'Nada no arquivo com esse filtro' : 'O arquivo está vazio'}</p>
            <p className="empty-subtitle text-secondary">
              {q || de
                ? 'A busca olha o número, o nome do cliente e o texto da ordem. Tente um pedaço menor.'
                : 'As 18.443 ordens do sistema antigo entram com npm run importar:ordens. Enquanto não rodar, só existe o que foi feito aqui.'}
            </p>
          </div></div></div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <div className="text-secondary">{historico.encontradas} ordens{historico.linhas.length < historico.encontradas ? ` · mostrando as ${historico.linhas.length} mais recentes` : ''}</div>
              <div className="numero fw-bold" data-testid="soma-historico">{R$(historico.somaTotal)}</div>
            </div>
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table" aria-label="Ordens do sistema antigo">
                <thead><tr><th>Nº</th><th>Entrada</th><th>Cliente</th><th>O que foi feito</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {historico.linhas.map((l) => (
                    <tr key={l.id}>
                      <td className="numero">{formatarNumeroOs(l.numero)}</td>
                      <td className="text-secondary">
                        {formatarDataCalendario(new Date(l.dataEntrada))}
                        {l.dataSaida ? <div className="small">saiu {formatarDataCalendario(new Date(l.dataSaida))}{l.dataSaidaSuspeita ? ' ⚠' : ''}</div> : null}
                        {l.dataSaidaTexto ? <div className="small text-danger">saída ilegível: {l.dataSaidaTexto}</div> : null}
                      </td>
                      <td>
                        {l.clienteId ? <Link href={`/clientes/${l.clienteId}`} className="text-reset">{l.clienteNome}</Link> : l.clienteNome}
                        {l.nomeDestruido ? <div className="small text-secondary">o sistema antigo apagou o nome ao cancelar</div> : null}
                      </td>
                      <td><div style={{ whiteSpace: 'pre-line' }}>{l.texto}</div>{l.situacao ? <div className="small text-secondary">{l.situacao}</div> : null}</td>
                      <td className="numero">{R$(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          </>
        )}
      </div></div>
    </>
  )
}
```

- [ ] **Step 4: As ordens antigas na ficha do cliente**

Em `src/app/(app)/clientes/[id]/page.tsx`: importar `historicoDoCliente`, `formatarDataCalendario`, `formatarNumeroOs`, `formatarMoeda` e `dinheiro` (o que já não estiver lá), carregar `const antigas = await historicoDoCliente(usuario.empresaId, id)` junto com o cliente, e antes do fechamento do `container-xl` acrescentar:
```tsx
          {antigas.length > 0 ? (
            <div className="card mt-3">
              <div className="card-header"><h3 className="card-title">No sistema antigo</h3><span className="ms-auto text-secondary">{antigas.length} ordens até 2026</span></div>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens antigas do cliente">
                <thead><tr><th>Nº</th><th>Entrada</th><th>O que foi feito</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {antigas.map((l) => (
                    <tr key={l.id}>
                      <td className="numero">{formatarNumeroOs(l.numero)}</td>
                      <td className="text-secondary">{formatarDataCalendario(new Date(l.dataEntrada))}</td>
                      <td><div style={{ whiteSpace: 'pre-line' }}>{l.texto}</div></td>
                      <td className="numero">{formatarMoeda(dinheiro(l.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : null}
```

Run: `npm run typecheck` → sem erros. Run: `npm run build` → `ƒ /historico` na lista.

- [ ] **Step 5: Commit**

```bash
git add src/infra/legado "src/app/(app)/historico" "src/app/(app)/navegacao.ts" "src/app/(app)/layout.tsx" "src/app/(app)/clientes/[id]/page.tsx"
git commit -m "feat: consulta do historico do sistema antigo, por numero, cliente e texto, e as ordens antigas na ficha do cliente"
```

---

### Task 4: Relatório para o contador

**Files:**
- Create: `src/domain/caixa/relatorio.ts`, `src/domain/caixa/relatorio.test.ts`, `src/infra/caixa/relatorio.ts`, `src/app/(app)/financeiro/contador/page.tsx`, `src/app/(app)/financeiro/contador/csv/route.ts`
- Modify: `src/app/(app)/financeiro/page.tsx` (botão para o relatório)

**Interfaces:**
- Consumes: `listarLivro` e `LinhaLivro` (`src/infra/caixa/livro.ts`); `mesCalendario`; `formatarMoeda`; `exigirPapel`.
- Produces: `agruparPorConta(linhas: LinhaLivro[]): RelatorioContador`, `paraCsv(relatorio, periodo): string`; `montarRelatorio(empresaId, periodo): Promise<RelatorioContador>`; rotas `/financeiro/contador?de=&ate=` e `/financeiro/contador/csv?de=&ate=`.

- [ ] **Step 1: O agrupamento e o CSV (teste)**

`src/domain/caixa/relatorio.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { agruparPorConta, paraCsv } from './relatorio'
import type { LinhaLivro } from '@/infra/caixa/livro'

const linha = (p: Partial<LinhaLivro>): LinhaLivro => ({
  id: 'x', data: '2026-08-10T00:00:00.000Z', tipo: 'entrada', valor: '100.00', contaCodigo: 1,
  contaNome: 'VENDAS DIVERSAS', historico: 'OS 018461', ordemId: null, ordemNumero: null,
  fornecedor: null, parcela: null, totalParcelas: null, usuarioNome: 'Odete Silva',
  estornadoEm: null, motivoEstorno: null, ...p,
})

describe('agruparPorConta', () => {
  it('soma por conta, separa entrada de saida e fecha o saldo', () => {
    const r = agruparPorConta([
      linha({ valor: '300.00' }),
      linha({ valor: '150.00' }),
      linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' }),
      linha({ tipo: 'saida', contaCodigo: 5, contaNome: 'ALUGUEL', valor: '1200.00' }),
    ])
    expect(r.entradas.map((c) => [c.codigo, c.nome, c.total, c.lancamentos])).toEqual([[1, 'VENDAS DIVERSAS', '450.00', 2]])
    expect(r.saidas.map((c) => [c.codigo, c.total])).toEqual([[5, '1200.00'], [3, '45.90']])
    expect(r).toMatchObject({ totalEntradas: '450.00', totalSaidas: '1245.90', saldo: '-795.90' })
  })

  it('estornado nao entra em conta nenhuma — e o que o contador nao pode ver como movimento', () => {
    const r = agruparPorConta([
      linha({ valor: '300.00' }),
      linha({ valor: '999.00', estornadoEm: '2026-08-11T12:00:00.000Z', motivoEstorno: 'digitado errado' }),
    ])
    expect(r.totalEntradas).toBe('300.00')
    expect(r.entradas[0]?.lancamentos).toBe(1)
  })

  it('cada grupo ordena pelo maior valor, que e por onde o contador olha', () => {
    const r = agruparPorConta([
      linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' }),
      linha({ tipo: 'saida', contaCodigo: 4, contaNome: 'TELEFONE', valor: '89.00' }),
      linha({ tipo: 'saida', contaCodigo: 5, contaNome: 'ALUGUEL', valor: '1200.00' }),
    ])
    expect(r.saidas.map((c) => c.nome)).toEqual(['ALUGUEL', 'TELEFONE', 'AGUA'])
  })

  it('periodo sem lancamento nenhum da tudo zerado, nao erro', () => {
    expect(agruparPorConta([])).toEqual({ entradas: [], saidas: [], totalEntradas: '0.00', totalSaidas: '0.00', saldo: '0.00' })
  })
})

describe('paraCsv', () => {
  it('sai com cabecalho, ponto e virgula e virgula decimal — o Excel do escritorio abre direto', () => {
    const r = agruparPorConta([linha({ valor: '1.234,56'.replace('.', '').replace(',', '.') }), linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' })])
    const csv = paraCsv(r, { de: '2026-08-01', ate: '2026-08-31' })
    const linhas = csv.split('\r\n')
    expect(linhas[0]).toBe('Periodo;01/08/2026;31/08/2026')
    expect(linhas[2]).toBe('Tipo;Codigo;Conta;Lancamentos;Total')
    expect(linhas[3]).toBe('Entrada;1;VENDAS DIVERSAS;1;1234,56')
    expect(linhas[4]).toBe('Saida;3;AGUA;1;45,90')
    expect(linhas).toContain('Total de entradas;;;;1234,56')
    expect(linhas).toContain('Total de saidas;;;;45,90')
    expect(linhas).toContain('Saldo;;;;1188,66')
  })

  it('nome de conta com ponto e virgula sai entre aspas, senao quebra a coluna', () => {
    const r = agruparPorConta([linha({ contaNome: 'DESPESAS; DIVERSAS' })])
    expect(paraCsv(r, { de: '2026-08-01', ate: '2026-08-31' })).toContain('"DESPESAS; DIVERSAS"')
  })
})
```

Run: `npm test -- src/domain/caixa/relatorio` → vermelho.

- [ ] **Step 2: O agrupamento e o CSV (implementação)**

`src/domain/caixa/relatorio.ts`:
```ts
import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'
import type { LinhaLivro } from '@/infra/caixa/livro'
import type { TipoLancamento } from './lancamento'

export interface ContaDoRelatorio {
  codigo: number
  nome: string
  lancamentos: number
  total: string
}

export interface RelatorioContador {
  entradas: ContaDoRelatorio[]
  saidas: ContaDoRelatorio[]
  totalEntradas: string
  totalSaidas: string
  saldo: string
}

function somarPorConta(linhas: LinhaLivro[], tipo: TipoLancamento): ContaDoRelatorio[] {
  const contas = new Map<number, ContaDoRelatorio>()
  for (const l of linhas) {
    if (l.tipo !== tipo) continue
    const atual = contas.get(l.contaCodigo)
    if (atual) {
      atual.lancamentos += 1
      atual.total = arredondarCentavos(dinheiro(atual.total).plus(dinheiro(l.valor))).toFixed(2)
    } else {
      contas.set(l.contaCodigo, { codigo: l.contaCodigo, nome: l.contaNome, lancamentos: 1, total: dinheiro(l.valor).toFixed(2) })
    }
  }
  return [...contas.values()].sort((a, b) => dinheiro(b.total).comparedTo(dinheiro(a.total)))
}

/** O que o contador pede por telefone todo mes: quanto entrou e saiu, por conta. Estornado nao e movimento. */
export function agruparPorConta(linhas: LinhaLivro[]): RelatorioContador {
  const vivas = linhas.filter((l) => l.estornadoEm === null)
  const entradas = somarPorConta(vivas, 'entrada')
  const saidas = somarPorConta(vivas, 'saida')
  const soma = (contas: ContaDoRelatorio[]) => contas.reduce((s, c) => s.plus(dinheiro(c.total)), dinheiro(0))
  const totalEntradas = arredondarCentavos(soma(entradas))
  const totalSaidas = arredondarCentavos(soma(saidas))
  return {
    entradas,
    saidas,
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    saldo: totalEntradas.minus(totalSaidas).toFixed(2),
  }
}

const brasileiro = (v: string) => v.replace('.', ',')
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
/** Ponto e virgula e o separador que o Excel em portugues espera; nome com `;` vai entre aspas. */
const campo = (v: string) => (v.includes(';') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)

export function paraCsv(r: RelatorioContador, periodo: { de: string; ate: string }): string {
  const linhas: string[] = [
    `Periodo;${dataBr(periodo.de)};${dataBr(periodo.ate)}`,
    '',
    'Tipo;Codigo;Conta;Lancamentos;Total',
    ...r.entradas.map((c) => `Entrada;${c.codigo};${campo(c.nome)};${c.lancamentos};${brasileiro(c.total)}`),
    ...r.saidas.map((c) => `Saida;${c.codigo};${campo(c.nome)};${c.lancamentos};${brasileiro(c.total)}`),
    '',
    `Total de entradas;;;;${brasileiro(r.totalEntradas)}`,
    `Total de saidas;;;;${brasileiro(r.totalSaidas)}`,
    `Saldo;;;;${brasileiro(r.saldo)}`,
  ]
  return linhas.join('\r\n')
}
```
(`relatorio.ts` importa **um tipo** de `@/infra/caixa/livro` — `import type` não é importação de runtime e a trava de pureza continua verde. Se `pureza.test.ts` reclamar mesmo assim, mover `LinhaLivro` para `src/domain/caixa/lancamento.ts` e fazer o `livro.ts` importar de lá.)

Run: `npm test -- src/domain/caixa/relatorio` → PASS. Run: `npm test -- pureza` → PASS.

- [ ] **Step 3: A tela e o CSV**

`src/infra/caixa/relatorio.ts`:
```ts
import { listarLivro } from './livro'
import { agruparPorConta, type RelatorioContador } from '@/domain/caixa/relatorio'

export async function montarRelatorio(empresaId: string, periodo: { de: string; ate: string }): Promise<RelatorioContador> {
  const livro = await listarLivro(empresaId, periodo)
  return agruparPorConta(livro.linhas)
}
```

`src/app/(app)/financeiro/contador/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconDownload } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { montarRelatorio } from '@/infra/caixa/relatorio'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { mesCalendario } from '@/domain/ordem/datas'
import type { ContaDoRelatorio } from '@/domain/caixa/relatorio'

export const metadata: Metadata = { title: 'Relatório para o contador' }

const R$ = (v: string) => formatarMoeda(dinheiro(v))

function Tabela({ titulo, contas, total, rotulo }: { titulo: string; contas: ContaDoRelatorio[]; total: string; rotulo: string }) {
  return (
    <div className="card mb-3">
      <div className="card-header"><h3 className="card-title">{titulo}</h3><span className="ms-auto numero fw-bold" data-testid={rotulo}>{R$(total)}</span></div>
      {contas.length === 0 ? <div className="card-body text-secondary">Nenhum lançamento no período.</div> : (
        <div className="table-responsive"><table className="table table-vcenter card-table" aria-label={titulo}>
          <thead><tr><th className="w-1">Código</th><th>Conta</th><th className="text-end">Lançamentos</th><th className="text-end">Total</th></tr></thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.codigo}><td className="numero">{c.codigo}</td><td>{c.nome}</td><td className="numero">{c.lancamentos}</td><td className="numero">{R$(c.total)}</td></tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

export default async function PaginaContador({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const mes = mesCalendario(new Date())
  const { de = mes.de, ate = mes.ate } = await searchParams
  let erro: string | null = null
  let periodo = { de, ate }
  let relatorio
  try {
    relatorio = await montarRelatorio(usuario.empresaId, periodo)
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    periodo = mes
    relatorio = await montarRelatorio(usuario.empresaId, mes)
  }

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col"><div className="page-pretitle">Financeiro</div><h2 className="page-title">Relatório para o contador</h2></div>
          <div className="col-auto">
            <a className="btn btn-primary" href={`/financeiro/contador/csv?de=${periodo.de}&ate=${periodo.ate}`}><IconDownload className="icon" /> Baixar CSV</a>
          </div>
        </div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-3"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={periodo.de} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={periodo.ate} /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            <div className="col-md-3"><Link href="/financeiro" className="btn btn-link px-0">Ver o livro-caixa</Link></div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando o mês atual.</div> : null}
          </div>
        </form>

        <Tabela titulo="Entradas por conta" contas={relatorio.entradas} total={relatorio.totalEntradas} rotulo="total-entradas" />
        <Tabela titulo="Saídas por conta" contas={relatorio.saidas} total={relatorio.totalSaidas} rotulo="total-saidas" />

        <div className="card"><div className="card-body d-flex justify-content-between align-items-baseline">
          <span className="h3 mb-0">Saldo do período</span>
          <span className="h1 mb-0 numero" data-testid="saldo">{R$(relatorio.saldo)}</span>
        </div></div>
        <p className="text-secondary small mt-2">Lançamento estornado não aparece: para o contador ele nunca foi movimento.</p>
      </div></div>
    </>
  )
}
```

`src/app/(app)/financeiro/contador/csv/route.ts`:
```ts
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { montarRelatorio } from '@/infra/caixa/relatorio'
import { paraCsv } from '@/domain/caixa/relatorio'
import { mesCalendario } from '@/domain/ordem/datas'
import { ErroDeValidacao } from '@/domain/precificacao/erros'

export async function GET(requisicao: Request): Promise<Response> {
  const usuario = await exigirPapel('administracao')
  const url = new URL(requisicao.url)
  const mes = mesCalendario(new Date())
  const periodo = { de: url.searchParams.get('de') ?? mes.de, ate: url.searchParams.get('ate') ?? mes.ate }
  try {
    const relatorio = await montarRelatorio(usuario.empresaId, periodo)
    // BOM: sem ele o Excel em portugues abre "MANUTENÇÃO" como "MANUTENÃÃO".
    const corpo = `﻿${paraCsv(relatorio, periodo)}`
    return new Response(corpo, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="caixa-${periodo.de}-a-${periodo.ate}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof ErroDeValidacao) return new Response(e.message, { status: 400 })
    throw e
  }
}
```

Em `src/app/(app)/financeiro/page.tsx`, no `col-auto` do cabeçalho, antes do botão "Nova saída":
```tsx
              <Link href="/financeiro/contador" className="btn me-2">Relatório do contador</Link>
```

Run: `npm run typecheck` → sem erros. Run: `npm run build` → `ƒ /financeiro/contador` e `ƒ /financeiro/contador/csv`.

- [ ] **Step 4: Commit**

```bash
git add src/domain/caixa/relatorio.ts src/domain/caixa/relatorio.test.ts src/infra/caixa/relatorio.ts "src/app/(app)/financeiro"
git commit -m "feat: relatorio para o contador por conta, com CSV que o Excel do escritorio abre direto"
```

---

### Task 5: Anexo de arte no R2 — **depende de credencial**

> **PARE AQUI SE A CREDENCIAL NÃO EXISTIR.** Esta tarefa precisa de uma conta Cloudflare R2 com bucket criado e um token de API. Sem `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET` no `.env.local`, **não comece**: peça as credenciais ao Otavio e siga para a Task 6. A fase fecha sem esta tarefa — o anexo é o único item que depende de serviço externo, e é por isso que ele está isolado no fim.

**Files:**
- Modify: `prisma/schema.prisma` (model `Anexo`), `src/infra/env.ts`, `.env.example`, `package.json` (`@aws-sdk/client-s3`)
- Create: `prisma/migrations/<timestamp>_anexo/migration.sql`, `src/infra/anexos/r2.ts`, `src/infra/anexos/repositorio.ts`, `src/app/(app)/ordens/[id]/anexos.tsx`, `src/app/(app)/ordens/[id]/anexos-actions.ts`

**Interfaces:**
- Produces: tabela `anexo`; `urlDeEnvio(chave, tipo)`, `urlDeLeitura(chave)`; `registrarAnexo(ctx, ordemId, dados)`, `listarAnexos(empresaId, ordemId)`, `removerAnexo(ctx, anexoId)`.

- [ ] **Step 1: Confirmar a credencial antes de tudo**

Run: `node -e "const e=process.env;console.log(['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'].map(k=>k+'='+(e[k]?'ok':'FALTA')).join(' '))"` com o `.env.local` carregado.
Expected: quatro `ok`. Qualquer `FALTA` → **parar a tarefa**, anotar no plano e seguir para a Task 6.

- [ ] **Step 2: O model, o env e a migração**

Em `prisma/schema.prisma`:
```prisma
/// Arte e arquivo do cliente (spec, secao 4). O binario vive no R2; aqui fica so a chave.
model Anexo {
  id            String       @id @default(uuid(7)) @db.Uuid
  empresaId     String       @map("empresa_id") @db.Uuid
  empresa       Empresa      @relation(fields: [empresaId], references: [id])
  ordemId       String       @map("ordem_id") @db.Uuid
  ordem         OrdemServico @relation(fields: [ordemId], references: [id])
  tipo          String       @db.VarChar(100)
  chaveR2       String       @unique @map("chave_r2") @db.VarChar(200)
  nomeOriginal  String       @map("nome_original") @db.VarChar(160)
  tamanhoBytes  Int          @map("tamanho_bytes")
  versao        Int          @default(1)
  enviadoPorId  String       @map("enviado_por_id") @db.Uuid
  enviadoPor    Usuario      @relation("anexo_enviado_por", fields: [enviadoPorId], references: [id])
  enviadoEm     DateTime     @default(now()) @map("enviado_em") @db.Timestamptz(3)
  removidoEm    DateTime?    @map("removido_em") @db.Timestamptz(3)
  removidoPorId String?      @map("removido_por_id") @db.Uuid

  @@index([empresaId, ordemId])
  @@map("anexo")
}
```
Relações novas: em `Empresa` `anexos Anexo[]`, em `OrdemServico` `anexos Anexo[]`, em `Usuario` `anexosEnviados Anexo[] @relation("anexo_enviado_por")`.

Em `src/infra/env.ts`, acrescentar as quatro variáveis como **opcionais** (o sistema roda sem elas; só a tela de anexo some).

Run: `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`; `npm run db:migrar -- anexo`.

- [ ] **Step 3: O restante**

O envio é por **URL assinada**: o navegador manda o arquivo direto para o R2 e só depois chama a action que grava a linha em `anexo` — assim o arquivo não passa pelo servidor da Vercel e não esbarra no limite de corpo da action. Aceitar `image/*` e `application/pdf` até 20 MB; recusar o resto na action, não só no `<input accept>`. Remover é `removidoEm`, nunca `DELETE` — o objeto no R2 fica, porque a arte é a prova do que foi combinado.

- [ ] **Step 4: Commit**

```bash
git add prisma src/infra/anexos src/infra/env.ts "src/app/(app)/ordens/[id]" package.json package-lock.json .env.example
git commit -m "feat: anexo de arte na ordem, no R2, por URL assinada"
```

---

### Task 6: Estados vazios e verificação final da fase

**Files:**
- Modify: `src/app/(app)/ordens/page.tsx`, `src/app/(app)/clientes/page.tsx`, `src/app/(app)/materiais/page.tsx` (estados vazios que ensinam)
- Create: `e2e/historico.spec.ts`

- [ ] **Step 1: Estados vazios que ensinam**

Cada lista vazia passa a dizer **o que é**, **por que está vazia** e **qual é o próximo passo**, com o botão do passo ao lado (spec, tela 17). As telas da Fase 4 e 5 já nasceram assim; faltam as três da Fase 2 e 3:

- `/ordens` sem filtro: título "Nenhuma ordem ainda", subtítulo "A primeira será a nº 18461, continuando a numeração do sistema antigo. O histórico de 2012 a 2026 fica em Histórico.", ação "Nova ordem" e link "Ver o histórico".
- `/clientes` vazio: "Nenhum cliente cadastrado" / "Os 3.219 clientes do sistema antigo entram com `npm run importar:clientes`. Ou cadastre o primeiro agora." + botão.
- `/materiais` vazio: "Nenhum material cadastrado" / "O catálogo nasce vazio de propósito: ele é tabela de preço, não estoque. Cadastre o que a loja vende com mais frequência." + botão.

- [ ] **Step 2: e2e do histórico**

`e2e/historico.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { entrar } from './apoio'

test.describe('Histórico', () => {
  test('busca no arquivo do sistema antigo por numero, cliente e texto', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Histórico' }).click()
    await expect(page).toHaveURL(/\/historico$/)
    await expect(page.getByRole('heading', { name: 'Histórico do sistema antigo' })).toBeVisible()

    const tabela = page.getByRole('table', { name: 'Ordens do sistema antigo' })
    if (await tabela.count() === 0) {
      // Sem importacao rodada, o estado vazio precisa ensinar o que fazer.
      await expect(page.getByText('npm run importar:ordens')).toBeVisible()
      return
    }
    await expect(page.getByTestId('soma-historico')).toContainText('R$')
    await page.getByLabel('Buscar').fill('18449')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(tabela.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })
    await page.getByRole('link', { name: 'Limpar' }).click()
    await page.getByLabel('Buscar').fill('zzz nao existe zzz')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByText('Nada no arquivo com esse filtro')).toBeVisible({ timeout: 30_000 })
  })

  test('relatorio do contador soma por conta e baixa CSV', async ({ page }) => {
    await entrar(page)
    await page.goto('/financeiro/contador')
    await expect(page.getByRole('heading', { name: 'Relatório para o contador' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Entradas por conta' })).toBeVisible()
    await expect(page.getByTestId('saldo')).toContainText('R$')

    const resposta = await page.request.get('/financeiro/contador/csv?de=2026-08-01&ate=2026-08-31')
    expect(resposta.status()).toBe(200)
    expect(resposta.headers()['content-type']).toContain('text/csv')
    const texto = await resposta.text()
    expect(texto).toContain('Periodo;01/08/2026;31/08/2026')
    expect(texto).toContain('Tipo;Codigo;Conta;Lancamentos;Total')
    expect(texto).toContain('Saldo;;;;')
  })
})
```

- [ ] **Step 3: Tudo verde**

Run: `npm run check` → typecheck, unitários e integração verdes. Run: `npm run build` → verde. Run: `npm run e2e` → verde (30 anteriores + 2 = **32**, ou 34 se a Task 5 tiver rodado).

- [ ] **Step 4: Marcar o plano e a memória**

Marcar todos os passos e os critérios abaixo, anotar os desvios, e atualizar `drusign-sistema-novo.md`: Fase 6 concluída, o que ficou de fora e por quê.

```bash
git add docs/superpowers/plans/2026-08-29-fase6-historico.md
git commit -m "docs: plano da Fase 6 executado"
```

---

## Critério de conclusão da Fase 6

Verificação da spec (seção 13): *"Importação das 18.443 ordens legadas como arquivo, anexo de arte, relatório para o contador, estados vazios refinados."*

- [ ] `ordens-legado.int.test.ts` verde: as 18.443 entram com a soma de R$ 5.654.432,03, 271 com saída antes da entrada e 3.152 com o nome destruído, e rodar duas vezes não duplica
- [ ] o texto de `OBS1..OBS7` está preservado como veio, sem nenhuma tentativa de estruturar
- [ ] `consulta.int.test.ts` verde: busca por número, nome e texto; período; e o histórico do cliente pela ficha dele
- [ ] `/historico` mostra o arquivo e a ficha do cliente mostra as ordens antigas dele
- [ ] `relatorio.test.ts` verde: agrupamento por conta com estornado fora, e o CSV com ponto e vírgula, vírgula decimal e BOM
- [ ] os estados vazios de `/ordens`, `/clientes` e `/materiais` dizem o que fazer
- [ ] `npm run check`, `npm run build` e `npm run e2e` verdes
- [ ] **anexo de arte:** feito, **ou** registrado aqui como pendente por falta da credencial do R2 — com o que exatamente falta

Feito isso, as seis fases da spec estão implementadas. O que vem depois não é fase: é o que a Odete pedir depois de usar.

## Backlog de refinamento (depois de rodar em produção)

Ligar a ordem legada ao cliente por nome quando o `CODCLI` não bate; exportar o histórico em CSV; busca com acento insensível (`unaccent`); relatório do contador por trimestre e por ano; nota de fechamento mensal assinada; `LogAuditoria`; backup testado antes de produção (spec, seção 9); segundo fator; sessão expirando por inatividade.
