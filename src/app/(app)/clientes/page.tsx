import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Anotacao, Apelido } from '@/componentes/situacao'
import { buscarClientes, contarClientes } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'

export const metadata: Metadata = { title: 'Clientes' }

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string; pagina?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', arquivados, pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const opcoes = { incluirArquivados: arquivados === '1' }

  const [clientes, total] = await Promise.all([
    buscarClientes(usuario.empresaId, q, { ...opcoes, limite: POR_PAGINA, pagina }),
    contarClientes(usuario.empresaId, q, opcoes),
  ])

  return (
    <>
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Clientes"
        acoes={
          <>
            <Link href="/clientes/carteira" className="btn">Carteira</Link>
            <Link href="/clientes/novo" className="btn btn-primary">
              <IconPlus className="icon" /> Novo cliente
            </Link>
          </>
        }
      />
      <CorpoPagina>
        <form method="get" className="row mb-3" role="search">
          <div className="col-12 col-lg-6">
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
          </div>
        </form>

        {clientes.length === 0 ? (
          <EstadoVazio
            titulo={q ? `Nenhum cliente com “${q}”` : 'Nenhum cliente cadastrado'}
            descricao={
              q
                ? 'A busca olha nome, apelido, telefone e documento. Se é cliente novo, cadastre.'
                : 'Os 3.219 clientes do sistema antigo ainda não foram importados. Enquanto isso, cadastre o primeiro aqui.'
            }
            acoes={
              // O mesmo rotulo do botao do cabecalho: eram "Novo cliente" e
              // "Cadastrar cliente" para a mesma acao, na mesma tela.
              <Link href="/clientes/novo" className="btn btn-primary">Novo cliente</Link>
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Clientes"
            colunas={
              <>
                <th>Cliente</th>
                <th>Telefones</th>
                <th>Documento</th>
                <th className="w-1"></th>
              </>
            }
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/clientes"
                parametros={{ q, arquivados }}
              />
            }
          >
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="text-reset fw-medium">{c.nome}</Link>
                  <Apelido apelido={c.apelido} />
                  {c.arquivadoEm ? <Anotacao>arquivado</Anotacao> : null}
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
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
