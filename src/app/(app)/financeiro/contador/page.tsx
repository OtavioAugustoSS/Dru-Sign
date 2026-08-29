import type { Metadata } from 'next'
import Link from 'next/link'
import { IconDownload } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { BlocoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { montarRelatorio } from '@/infra/caixa/relatorio'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { mesCalendario } from '@/domain/ordem/datas'
import type { ContaDoRelatorio } from '@/domain/caixa/relatorio'

export const metadata: Metadata = { title: 'Relatório para o contador' }

function Tabela({ titulo, contas, total, rotulo }: { titulo: string; contas: ContaDoRelatorio[]; total: string; rotulo: string }) {
  return (
    <CartaoTabela
      className="mb-3"
      rotulo={titulo}
      titulo={titulo}
      aoLado={
        <span className="numero fw-bold" data-testid={rotulo}>
          <Dinheiro valor={total} />
        </span>
      }
      vazio={contas.length === 0 ? <BlocoVazio titulo="Nenhum lançamento no período" descricao="Escolha outro período acima." /> : null}
      colunas={
        <>
          <th className="w-1">Código</th>
          <th>Conta</th>
          <th className="text-end">Lançamentos</th>
          <th className="text-end">Total</th>
        </>
      }
    >
      {contas.map((c) => (
        <tr key={c.codigo}>
          <td className="numero">{c.codigo}</td>
          <td>{c.nome}</td>
          <td className="numero">{c.lancamentos}</td>
          <td className="numero"><Dinheiro valor={c.total} /></td>
        </tr>
      ))}
    </CartaoTabela>
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
      <CabecalhoPagina
        pretitulo="Financeiro"
        titulo="Relatório para o contador"
        acoes={
          <>
            {/* "Ver o livro-caixa" estava dentro do cartao de filtro, junto dos
                campos de data: navegacao no meio de um formulario. Lugar de ir
                para outra tela e aqui, ao lado da outra acao do cabecalho. */}
            <Link href="/financeiro" className="btn">Ver o livro-caixa</Link>
            <a className="btn btn-primary" href={`/financeiro/contador/csv?de=${periodo.de}&ate=${periodo.ate}`}>
              <IconDownload className="icon" /> Baixar CSV
            </a>
          </>
        }
      />
      <CorpoPagina>
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="de">De</label>
              <input id="de" type="date" name="de" className="form-control" defaultValue={periodo.de} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="ate">Até</label>
              <input id="ate" type="date" name="ate" className="form-control" defaultValue={periodo.ate} />
            </div>
            <div className="col-auto"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            {erro ? (
              <div className="col-12 text-danger-emphasis small" role="alert">{erro} — mostrando o mês atual.</div>
            ) : null}
          </div>
        </form>

        <Tabela titulo="Entradas por conta" contas={relatorio.entradas} total={relatorio.totalEntradas} rotulo="total-entradas" />
        <Tabela titulo="Saídas por conta" contas={relatorio.saidas} total={relatorio.totalSaidas} rotulo="total-saidas" />

        <CartaoIndicador
          rotulo="Saldo do período"
          valor={<Dinheiro valor={relatorio.saldo} />}
          tom={Number(relatorio.saldo) < 0 ? 'ruim' : 'bom'}
          nota="Lançamento estornado não aparece: para o contador ele nunca foi movimento."
          testId="saldo"
        />
      </CorpoPagina>
    </>
  )
}
