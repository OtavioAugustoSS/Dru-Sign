import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { BlocoVazio, EstadoVazio } from '@/componentes/estado-vazio'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Dinheiro } from '@/componentes/dinheiro'
import { contar } from '@/componentes/plural'
import { Percentual } from '@/componentes/percentual'
import { Apelido, SituacaoRecencia } from '@/componentes/situacao'
import { carregarCarteira, telefonesDeClientes } from '@/infra/clientes/carteira'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import type { GrupoCarteira } from '@/domain/clientes/carteira'

export const metadata: Metadata = { title: 'Carteira de clientes' }

/** Concentracao e pergunta de topo: quem sao os maiores. A cauda nao informa. */
const MAIORES = 30

/**
 * O nome do grupo, sempre clicavel.
 *
 * Um cadastro so leva a ficha dele. Varios cadastros sob o mesmo documento --
 * a Prefeitura de Unai sao 18, uma por secretaria -- levam a lista de clientes
 * filtrada por aquele documento, que e onde os 18 aparecem juntos. Antes esses
 * nomes eram texto morto: o grupo maior da carteira era justamente o que nao
 * tinha para onde ir.
 */
function Nome({ g }: { g: GrupoCarteira }) {
  const destino = g.clienteIds.length === 1 && g.clienteIds[0]
    ? `/clientes/${g.clienteIds[0]}`
    : g.documento
      ? `/clientes?q=${g.documento}`
      : null
  return (
    <>
      {destino ? (
        <Link href={destino} className="text-reset fw-medium">{g.nome}</Link>
      ) : (
        <span className="fw-medium">{g.nome}</span>
      )}
      <Apelido apelido={g.apelido} />
      {g.cadastros > 1 ? <div className="small text-secondary">{g.cadastros} cadastros com o mesmo documento</div> : null}
      {g.documento ? <div className="small text-secondary">{formatarDocumento(g.documento)}</div> : null}
    </>
  )
}

export default async function PaginaCarteira({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const carteira = await carregarCarteira(usuario.empresaId)

  const maiores = carteira.grupos.slice(0, MAIORES)
  const somaMaiores = maiores.reduce((s, g) => s.plus(dinheiro(g.faturado)), dinheiro(0))
  const total = dinheiro(carteira.faturadoTotal)
  const fatiaDosMaiores = total.isZero() ? '0.0' : somaMaiores.dividedBy(total).times(100).toFixed(1)
  const reativarNaPagina = carteira.paraReativar.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const telefones = await telefonesDeClientes(usuario.empresaId, reativarNaPagina.flatMap((g) => g.clienteIds))

  return (
    <>
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Carteira de clientes"
        /* A tela responde duas perguntas e nada mais. Antes a descricao contava
           como ela funciona por dentro (agrupamento por CNPJ) antes de dizer
           para que ela serve. */
        descricao="Quem sumiu e vale a pena ligar, e quem carrega o faturamento da loja. Conta os 14 anos inteiros: as ordens do sistema antigo e as daqui."
        acoes={<Link href="/clientes" className="btn">Todos os cadastros</Link>}
      />
      <CorpoPagina>
        {carteira.grupos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente comprou ainda"
            descricao="A carteira nasce das ordens, do sistema antigo e deste. Venda de balcão não entra: ela não tem nome."
          />
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Faturado" valor={<Dinheiro valor={carteira.faturadoTotal} />} testId="faturado-total" nota="tudo o que estes clientes já compraram, desde 2012" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Ativos" valor={carteira.contagem.ativo} tom="bom" nota="compraram nos últimos 6 meses" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Adormecidos" valor={carteira.contagem.adormecido} tom="atencao" testId="adormecidos" nota="de 6 a 24 meses sem aparecer" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Perdidos" valor={carteira.contagem.perdido} nota="mais de 2 anos sem comprar" />
              </div>
            </div>

            <CartaoTabela
              className="mb-3"
              rotulo="Para reativar"
              titulo="Para reativar"
              aoLado={
                carteira.paraReativar.length > 0 ? (
                  <span className="text-secondary">{contar(carteira.paraReativar.length, 'nome', 'nomes')}, do maior faturamento para o menor</span>
                ) : null
              }
              vazio={
                carteira.paraReativar.length === 0 ? (
                  <BlocoVazio
                    titulo="Ninguém para reativar"
                    descricao="Nenhum cliente está entre 6 e 24 meses sem comprar. Quem some por mais de dois anos passa para “perdidos”: campanha de reativação raramente traz de volta quem sumiu há tanto tempo."
                  />
                ) : null
              }
              rodape={
                carteira.paraReativar.length > POR_PAGINA ? (
                  <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={carteira.paraReativar.length} base="/clientes/carteira" parametros={{}} />
                ) : null
              }
              colunas={
                <>
                  <th>Cliente</th>
                  <th style={{ width: '13rem' }}>Telefone</th>
                  <th style={{ width: '10rem' }}>Última compra</th>
                  <th className="text-end" style={{ width: '10rem' }}>Já faturou</th>
                </>
              }
            >
              {reativarNaPagina.map((g) => {
                // Do grupo inteiro, sem repetir: cinco cadastros da mesma
                // fazenda costumam ter o mesmo numero.
                const numeros = [...new Set(g.clienteIds.flatMap((id) => telefones.get(id) ?? []))].slice(0, 2)
                return (
                  <tr key={g.documento ?? g.clienteIds[0]}>
                    <td><Nome g={g} /></td>
                    <td className="text-secondary">
                      {numeros.length === 0
                        ? <span className="anotacao-solta">sem telefone no cadastro</span>
                        : numeros.map((n) => <div key={n}>{formatarTelefone(n)}</div>)}
                    </td>
                    <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                    <td className="numero"><Dinheiro valor={g.faturado} /></td>
                  </tr>
                )
              })}
            </CartaoTabela>

            {/* Os maiores, e nao a lista inteira: concentracao e pergunta de
                topo. Com quase tres mil grupos, a tabela completa era uma
                rolagem de vinte telas em que so as primeiras linhas diziam
                alguma coisa. */}
            <CartaoTabela
              rotulo="Concentração de receita"
              titulo="Quem carrega o faturamento"
              aoLado={
                <span className="text-secondary">
                  os {maiores.length} maiores de {carteira.grupos.length.toLocaleString('pt-BR')} · juntos, <Percentual valor={fatiaDosMaiores} /> de tudo
                </span>
              }
              colunas={
                <>
                  <th>Cliente</th>
                  <th style={{ width: '9rem' }}>Situação</th>
                  <th className="text-end" style={{ width: '7rem' }}>Ordens</th>
                  <th className="text-end" style={{ width: '10rem' }}>Faturado</th>
                  <th className="text-end" style={{ width: '7rem' }}>Fatia</th>
                </>
              }
            >
              {maiores.map((g) => (
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
