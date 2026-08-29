import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterImpresso } from '@/infra/ordens/impresso'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { TEXTOS_IMPRESSO, descreverCobranca, formatarDimensao, tituloDocumento, type DadosEmpresaImpresso, type OrdemImpressa } from '@/domain/ordem/impresso'
import { BotaoImprimir } from './botao-imprimir'

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ vias?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const usuario = await exigirUsuario()
  const { id } = await params
  const dados = await obterImpresso(usuario.empresaId, id)
  return { title: dados ? `OS ${String(dados.ordem.numero).padStart(6, '0')}` : 'Impresso' }
}

export default async function PaginaImpresso({ params, searchParams }: Props) {
  const usuario = await exigirUsuario()
  const [{ id }, { vias }] = await Promise.all([params, searchParams])
  const dados = await obterImpresso(usuario.empresaId, id)
  if (!dados) notFound()
  const rotulos = vias === '2' ? ['Via do cliente', 'Via da loja'] : ['Via do cliente']
  return (
    <>
      <div className="impresso-acoes">
        <Link href={`/ordens/${id}`} className="btn">Voltar à ordem</Link>
        <BotaoImprimir />
        <Link href={`/ordens/${id}/impresso?vias=2`} className="btn btn-ghost-secondary">2 vias</Link>
      </div>
      {rotulos.map((rotulo) => <Via key={rotulo} rotulo={rotulo} empresa={dados.empresa} ordem={dados.ordem} />)}
    </>
  )
}

function Via({ rotulo, empresa, ordem }: { rotulo: string; empresa: DadosEmpresaImpresso; ordem: OrdemImpressa }) {
  const numero = String(ordem.numero).padStart(6, '0')
  const eOrcamento = ordem.estadoProducao === 'orcamento'
  const temAjuste = !ordem.ajuste.isZero()
  return (
    <article className="via" aria-label={`${tituloDocumento(ordem.estadoProducao)} ${numero} — ${rotulo}`}>
      <header className="bloco cabecalho-empresa">
        <div><div className="nome">{empresa.nomeFantasia}</div><div className="razao">{empresa.razaoSocial}{empresa.cnpj ? ` · CNPJ ${formatarDocumento(empresa.cnpj)}` : ''}</div></div>
        <div className="contato">{empresa.endereco ? <div>{empresa.endereco}</div> : null}{empresa.cidadeUf ? <div>{empresa.cidadeUf}</div> : null}{(empresa.telefones ?? []).map((t) => <div key={t}>{formatarTelefone(t)}</div>)}</div>
      </header>
      <section className="bloco identificacao">
        <div><div className="via-rotulo">{rotulo}</div><div className="titulo">{tituloDocumento(ordem.estadoProducao)}</div><div className="numero-os">Nº {numero}</div></div>
        <dl className="datas">
          <div><dt>Aberta em</dt><dd>{formatarDataHora(ordem.abertaEm)}</dd></div>
          <div><dt>Entrega prometida</dt><dd>{ordem.prometidaPara ? formatarDataCalendario(ordem.prometidaPara) : 'a combinar'}</dd></div>
          <div><dt>Responsável</dt><dd>{ordem.responsavel}</dd></div>
        </dl>
      </section>
      <section className="bloco cliente">
        <dl>
          <dt>Cliente</dt><dd>{ordem.cliente ? ordem.cliente.nome : 'Venda de balcão'}{ordem.cliente?.apelido ? ` (${ordem.cliente.apelido})` : ''}</dd>
          {ordem.cliente?.telefone ? <><dt>Telefone</dt><dd>{ordem.cliente.telefone}</dd></> : null}
          {ordem.cliente?.documento ? <><dt>CPF/CNPJ</dt><dd>{formatarDocumento(ordem.cliente.documento)}</dd></> : null}
        </dl>
      </section>
      <section className="bloco">
        <table className="itens">
          <thead><tr><th className="numero">Qtd</th><th>Descrição</th><th>Medida</th><th className="numero">Unitário</th><th className="numero">Total</th></tr></thead>
          <tbody>
            {ordem.itens.map((item, i) => (
              <tr key={i}>
                <td className="numero">{item.quantidade}</td>
                <td>{item.descricao}<span className="cobranca">{descreverCobranca(item)}</span></td>
                <td>{formatarDimensao(item.altura, item.largura)}</td>
                <td className="numero">{formatarMoeda(item.valorUnitario)}</td>
                <td className="numero">{formatarMoeda(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordem.observacoes ? <p className="observacoes">{ordem.observacoes}</p> : null}
      </section>
      <section className="bloco rodape">
        <div className="assinatura">
          <p className="garantia">{eOrcamento ? TEXTOS_IMPRESSO.orcamentoValidade : TEXTOS_IMPRESSO.garantia}</p>
          <div className="linha">Visto do cliente</div>
        </div>
        <table className="valores"><tbody>
          <tr><td>Materiais e serviços</td><td className="numero">{formatarMoeda(ordem.subtotalItens)}</td></tr>
          {ordem.acrescimos.map((a, i) => <tr key={i}><td>{a.descricao}</td><td className="numero">{formatarMoeda(a.valor)}</td></tr>)}
          {temAjuste ? (
            <>
              <tr><td>Calculado</td><td className="numero">{formatarMoeda(ordem.precoCalculado)}</td></tr>
              <tr><td>{ordem.ajuste.isNegative() ? 'Desconto' : 'Acréscimo'}{ordem.motivoAjuste ? <span className="motivo"> · {ordem.motivoAjuste}</span> : null}</td><td className="numero">{formatarMoeda(ordem.ajuste.abs())}</td></tr>
            </>
          ) : null}
          <tr className="total"><td>Total</td><td className="numero">{formatarMoeda(ordem.precoFinal)}</td></tr>
        </tbody></table>
      </section>
      <p className="agradecimento">*** {TEXTOS_IMPRESSO.agradecimento} ***</p>
    </article>
  )
}
