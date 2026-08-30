import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Paginacao, PaginacaoCompacta, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Anotacao, Apelido } from '@/componentes/situacao'
import { contar } from '@/componentes/plural'
import { buscarClientes, contarClientes, contagensDeClientes, type OrigemCliente } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'

export const metadata: Metadata = { title: 'Clientes' }

const ORIGENS: { valor: OrigemCliente; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'novos', rotulo: 'Cadastrados aqui' },
  { valor: 'legado', rotulo: 'Do sistema antigo' },
]

function lerOrigem(valor: string | undefined): OrigemCliente {
  return valor === 'novos' || valor === 'legado' ? valor : 'todos'
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string; origem?: string; pagina?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', arquivados, origem: origemCrua, pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const origem = lerOrigem(origemCrua)
  const opcoes = { incluirArquivados: arquivados === '1', origem }
  const filtrando = q !== '' || origem !== 'todos' || arquivados === '1'

  const [clientes, total, contagens] = await Promise.all([
    buscarClientes(usuario.empresaId, q, { ...opcoes, limite: POR_PAGINA, pagina }),
    contarClientes(usuario.empresaId, q, opcoes),
    contagensDeClientes(usuario.empresaId),
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
        {/* Cada numero e tambem a porta da lista que ele conta: clicar em "Do
            sistema antigo" filtra a lista para eles. Numero que so informa exige
            que a pessoa descubra sozinha como chegar naquele recorte. */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Cadastros ativos" valor={contagens.total} href="/clientes" nota="tudo o que a busca alcança" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Cadastrados aqui" valor={contagens.cadastradosAqui} href="/clientes?origem=novos" nota="nasceram no sistema novo" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Do sistema antigo" valor={contagens.doLegado} href="/clientes?origem=legado" nota="vieram na importação" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Arquivados" valor={contagens.arquivados} href="/clientes?arquivados=1" nota="fora da busca do dia a dia" />
          </div>
        </div>

        {/* O mesmo cartao de filtro da tela de ordens: as duas telas se usam do
            mesmo jeito, e antes uma tinha campo solto e a outra cartao. */}
        <form method="get" className="card mb-3" role="search">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="q">Buscar</label>
              <input
                id="q" type="search" name="q" className="form-control" defaultValue={q}
                placeholder="Nome, apelido, telefone ou CPF/CNPJ" autoFocus
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="origem">Origem do cadastro</label>
              <select id="origem" name="origem" className="form-select" defaultValue={origem}>
                {ORIGENS.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-check">
                <input className="form-check-input" type="checkbox" name="arquivados" value="1" defaultChecked={arquivados === '1'} />
                <span className="form-check-label">Incluir arquivados</span>
              </label>
            </div>
            <div className="col-md-2 d-flex gap-2">
              <button type="submit" className="btn btn-primary">Filtrar</button>
              <Link href="/clientes" className="btn">Limpar</Link>
            </div>
          </div>
        </form>

        {clientes.length === 0 ? (
          <EstadoVazio
            titulo={filtrando ? 'Nenhum cliente com esse filtro' : 'Nenhum cliente cadastrado'}
            descricao={
              filtrando
                ? 'A busca olha nome, apelido, telefone e documento. Se é cliente novo, cadastre.'
                : 'Os cadastros do sistema antigo entram na importação. Enquanto isso, cadastre o primeiro aqui.'
            }
            acoes={
              <>
                <Link href="/clientes/novo" className="btn btn-primary">Novo cliente</Link>
                {filtrando ? <Link href="/clientes" className="btn">Limpar o filtro</Link> : null}
              </>
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Clientes"
            /* Quantos a busca achou, ao lado do titulo da tabela. Sem isto a
               pessoa via 50 linhas e nao sabia se eram 50 ou os primeiros 50
               de tres mil. */
            aoLado={<span className="text-secondary">{contar(total, 'cliente', 'clientes')}</span>}
            colunas={
              <>
                <th>Cliente</th>
                <th>Telefones</th>
                <th>Documento</th>
                <th>Cidade</th>
              </>
            }
            paginacao={
              <PaginacaoCompacta
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/clientes"
                parametros={{ q, arquivados, origem: origem === 'todos' ? undefined : origem }}
              />
            }
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/clientes"
                parametros={{ q, arquivados, origem: origem === 'todos' ? undefined : origem }}
              />
            }
          >
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  {/* A linha inteira ja levava a ficha pelo nome; a coluna
                      "Ficha" na ponta direita era uma segunda porta para o
                      mesmo lugar -- e, na tela larga, a 1.400px do nome. */}
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
                <td className="text-secondary">{c.cidade ?? ''}</td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
