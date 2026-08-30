import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { BlocoVazio, EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { Percentual } from '@/componentes/percentual'
import { Apelido, SituacaoRecencia } from '@/componentes/situacao'
import { carregarCarteira } from '@/infra/clientes/carteira'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { GrupoCarteira } from '@/domain/clientes/carteira'

export const metadata: Metadata = { title: 'Carteira de clientes' }

function Nome({ g }: { g: GrupoCarteira }) {
  return (
    <>
      {g.clienteIds.length === 1 && g.clienteIds[0] ? (
        <Link href={`/clientes/${g.clienteIds[0]}`} className="text-reset fw-medium">{g.nome}</Link>
      ) : (
        <span className="fw-medium">{g.nome}</span>
      )}
      <Apelido apelido={g.apelido} />
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
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Carteira de clientes"
        acoes={<Link href="/clientes" className="btn">Todos os cadastros</Link>}
      />
      <CorpoPagina>
        {carteira.grupos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente comprou ainda"
            descricao="A carteira nasce das ordens. Venda de balcão não entra: ela não tem nome."
          />
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <CartaoIndicador rotulo="Faturado" valor={<Dinheiro valor={carteira.faturadoTotal} />} testId="faturado-total" nota="Soma de tudo o que os clientes já compraram" />
              </div>
              <div className="col-md-3">
                <CartaoIndicador rotulo="Ativos" valor={carteira.contagem.ativo} nota="compraram nos últimos 6 meses" />
              </div>
              <div className="col-md-3">
                <CartaoIndicador rotulo="Adormecidos" valor={carteira.contagem.adormecido} testId="adormecidos" nota="de 6 a 24 meses — é a lista de reativação" />
              </div>
              <div className="col-md-3">
                <CartaoIndicador rotulo="Perdidos" valor={carteira.contagem.perdido} nota="mais de 2 anos sem comprar" />
              </div>
            </div>

            {/* O cartao fica mesmo quando a lista esta vazia: sem ele, a tela
                perdia um bloco inteiro e a pessoa nao sabia se a lista nao
                existia ou se estava sem ninguem. */}
            <CartaoTabela
              className="mb-3"
              rotulo="Para reativar"
              titulo="Para reativar"
              aoLado={
                carteira.paraReativar.length > 0 ? (
                  <span className="text-secondary">{carteira.paraReativar.length} nomes, do maior faturamento para o menor</span>
                ) : null
              }
              vazio={
                carteira.paraReativar.length === 0 ? (
                  <BlocoVazio
                    titulo="Ninguém para reativar"
                    descricao="Nenhum cliente está entre 6 e 24 meses sem comprar. Quem some por mais de dois anos passa para “perdidos”."
                  />
                ) : null
              }
              colunas={
                <>
                  <th>Cliente</th>
                  <th>Última ordem</th>
                  <th className="text-end">Já faturou</th>
                </>
              }
            >
              {carteira.paraReativar.map((g) => (
                <tr key={g.documento ?? g.clienteIds[0]}>
                  <td><Nome g={g} /></td>
                  <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                  <td className="numero"><Dinheiro valor={g.faturado} /></td>
                </tr>
              ))}
            </CartaoTabela>

            <CartaoTabela
              rotulo="Concentração de receita"
              titulo="Concentração de receita"
              colunas={
                <>
                  <th>Cliente</th>
                  <th>Situação</th>
                  <th className="text-end">Ordens</th>
                  <th className="text-end">Faturado</th>
                  <th className="text-end">Fatia</th>
                </>
              }
            >
              {carteira.grupos.map((g) => (
                <tr key={g.documento ?? g.clienteIds[0]}>
                  <td><Nome g={g} /></td>
                  <td><SituacaoRecencia recencia={g.recencia} /></td>
                  <td className="numero">{g.ordens}</td>
                  <td className="numero"><Dinheiro valor={g.faturado} /></td>
                  <td className="numero"><Percentual valor={g.fatiaPct} /></td>
                </tr>
              ))}
            </CartaoTabela>
          </>
        )}
      </CorpoPagina>
    </>
  )
}
