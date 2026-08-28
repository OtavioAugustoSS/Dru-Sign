// Uso: npm run db:migrar -- <nome_da_migracao>
//
// Substitui `prisma migrate dev` no Postgres local do `prisma dev` (PGlite): ali nao existe
// shadow database de verdade (todos os "bancos" compartilham o mesmo armazenamento), entao o
// replay das migracoes que o migrate dev faz falha a partir da segunda migracao.
// Caminho documentado pelo Prisma para ambientes sem shadow: `migrate diff` do banco vivo para
// o schema gera o SQL; o arquivo entra em prisma/migrations; `migrate deploy` aplica.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const nome = process.argv[2]
if (!nome || !/^[a-z0-9_]+$/.test(nome)) {
  console.error('informe o nome da migracao em snake_case: npm run db:migrar -- clientes_materiais')
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const sql = execFileSync(
  npx,
  ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: true },
)

if (/^-- This is an empty migration\.?\s*$/m.test(sql) || sql.trim() === '') {
  console.log('nada a migrar: o banco ja esta igual ao schema')
  process.exit(0)
}

const agora = new Date()
const carimbo = agora.toISOString().replace(/[-:T]/g, '').slice(0, 14)
const pasta = join('prisma', 'migrations', `${carimbo}_${nome}`)
if (existsSync(pasta)) {
  console.error(`ja existe: ${pasta}`)
  process.exit(1)
}
mkdirSync(pasta, { recursive: true })
writeFileSync(join(pasta, 'migration.sql'), sql, 'utf8')
console.log(`migracao escrita em ${pasta}`)

execFileSync(npx, ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: true })
execFileSync(npx, ['prisma', 'generate'], { stdio: 'inherit', shell: true })
