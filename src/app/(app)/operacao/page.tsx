import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { BlocoVazio } from '@/componentes/estado-vazio'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { emPercentual } from '@/componentes/percentual'
import { carregarOperacao } from '@/infra/operacao/indicadores'
import { ErroDeValidacao } from '@/domain/precificacao/erros'

export const metadata: Metadata = { title: 'Indicadores' }

/**
 * O prazo em palavras.
 *
 * "0 dias" e tecnicamente certo e comunica mal: parece campo vazio ou conta que
 * deu errado. Se a ordem sai no dia em que entra, e isso que se diz.
 */
function prazoLegivel(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return 'no mesmo dia'
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export default async function PaginaOperacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { de = '', ate = '' } = await searchParams
  let erro: string | null = null
  let dados
  try {
    dados = await carregarOperacao(usuario.empresaId, de && ate ? { de, ate } : undefined)
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    dados = await carregarOperacao(usuario.empresaId)
  }
  const { indicadores: i, anos } = dados

  return (
    <>
      <CabecalhoPagina pretitulo="Configuração" titulo="Indicadores" />
      <CorpoPagina>
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="de">Aberta de</label>
              <input id="de" type="date" name="de" className="form-control" defaultValue={dados.de ?? ''} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="ate">até</label>
              <input id="ate" type="date" name="ate" className="form-control" defaultValue={dados.ate ?? ''} />
            </div>
            <div className="col-auto"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            <div className="col-12 form-hint">
              {dados.de ? `Período de ${dados.de} a ${dados.ate}.` : 'Sem período: tudo o que existe no sistema.'}
            </div>
            {erro ? <div className="col-12 text-danger-emphasis small" role="alert">{erro} Mostrando tudo.</div> : null}
          </div>
        </form>

        {/*
          Todo indicador que tem alvo declarado na spec passa a se colorir contra
          ele. Antes so dois dos seis coloriam, e o resto ficava preto neutro --
          inclusive "valor parado", que e o numero que mais dói neste negocio:
          R$ 207.795 presos foi o que motivou trocar o sistema.
        */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Ordens que ainda não foram finalizadas"
              valor={emPercentual(i.naoFinalizadasPct)}
              tom={Number(i.naoFinalizadasPct) > 5 ? 'ruim' : 'bom'}
              nota="Alvo: abaixo de 5%. No legado, 29,4% em 2025."
              testId="nao-finalizadas"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Valor parado em ordens não cobradas"
              valor={<Dinheiro valor={i.valorParado} />}
              tom={Number(i.valorParado) > 0 ? 'ruim' : 'bom'}
              nota="Alvo: perto de zero. No legado, R$ 207.795."
              testId="valor-parado"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Ordens com item estruturado"
              valor={emPercentual(i.comItemPct)}
              tom={Number(i.comItemPct) >= 90 ? 'bom' : 'ruim'}
              nota="Alvo: acima de 90%. No legado, 0%."
              testId="com-item"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Prazo de entrega"
              valor={prazoLegivel(i.prazoMedianoDias)}
              nota={i.prazoP90Dias === null ? 'Sem ordem finalizada ainda.' : `9 de 10 saem ${prazoLegivel(i.prazoP90Dias) === 'no mesmo dia' ? 'no mesmo dia' : `em até ${prazoLegivel(i.prazoP90Dias)}`}. No legado: 13 e 78 dias.`}
              testId="prazo"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Pessoas usando o sistema"
              valor={i.pessoas}
              tom={i.pessoas >= 2 ? 'bom' : 'ruim'}
              nota="Alvo: 2 ou mais. No legado, uma pessoa fazia 84,6% das ordens."
              testId="pessoas"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Recebido"
              valor={<Dinheiro valor={i.recebido} />}
              nota={`De ${valorEmReais(i.faturado)} faturados.`}
              testId="recebido"
            />
          </div>
        </div>

        <CartaoTabela
          rotulo="Ano a ano"
          titulo="Ano a ano"
          vazio={anos.length === 0 ? <BlocoVazio titulo="Nenhuma ordem ainda" descricao="Os números aparecem quando a primeira ordem for aberta." /> : null}
          rodape={anos.length === 1 ? 'Só existe um ano porque o histórico do sistema antigo ainda não foi importado.' : null}
          colunas={
            <>
              <th>Ano</th>
              <th className="text-end">Ordens</th>
              <th className="text-end">Finalizadas</th>
              <th className="text-end">Faturado</th>
              <th className="text-end">Recebido</th>
              <th className="text-end">Ticket médio</th>
            </>
          }
        >
          {anos.map((a) => (
            <tr key={a.ano}>
              <td className="numero">{a.ano}</td>
              <td className="numero">{a.ordens}</td>
              <td className="numero">{a.concluidas}</td>
              <td className="numero"><Dinheiro valor={a.faturado} /></td>
              <td className="numero"><Dinheiro valor={a.recebido} /></td>
              <td className="numero"><Dinheiro valor={a.ticketMedio} /></td>
            </tr>
          ))}
        </CartaoTabela>
      </CorpoPagina>
    </>
  )
}
