import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { Anotacao, Apelido, SituacaoEstado } from '@/componentes/situacao'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { BlocoVazio } from '@/componentes/estado-vazio'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { limparTextoLegado } from '@/componentes/texto-legado'
import { contar } from '@/componentes/plural'
import { obterCliente } from '@/infra/clientes/repositorio'
import { listarOrdens } from '@/infra/ordens/tela'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { historicoDoCliente } from '@/infra/legado/consulta'
import { arquivar, reativar } from '../actions'

export const metadata: Metadata = { title: 'Ficha do cliente' }

function somar(valores: string[]): string {
  return valores.reduce((t, v) => t.plus(dinheiro(v)), dinheiro('0')).toFixed(2)
}

/**
 * Um par rotulo/valor da ficha.
 *
 * Empilhado, nao lado a lado. A versao anterior usava `col-4`/`col-8` dentro de
 * um cartao de meia tela: o rotulo ganhava um terco da largura para escrever
 * "E-mail" e o endereco inteiro se espremia no resto. Empilhado, cada um usa a
 * largura que precisa.
 */
function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </>
  )
}

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const [c, antigas, novas] = await Promise.all([
    obterCliente(usuario.empresaId, id),
    historicoDoCliente(usuario.empresaId, id),
    listarOrdens(usuario.empresaId, { clienteId: id, limite: 50 }),
  ])
  if (!c) notFound()

  const endereco = [c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' · ')
  const totalNovo = somar(novas.map((o) => o.precoFinal))
  const totalAntigo = somar(antigas.map((l) => l.total))
  const totalGeral = somar([totalNovo, totalAntigo])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/clientes', rotulo: 'Clientes' }}
        titulo={
          <>
            {c.nome}
            <Apelido apelido={c.apelido} />
            {c.arquivadoEm ? <Anotacao>arquivado</Anotacao> : null}
          </>
        }
        /* O que a pessoa no balcao quer saber de relance sobre quem esta na sua
           frente: quanto ja comprou aqui. Uma linha resolve, sem gastar tres
           cartoes de indicador numa tela que ja tem tres blocos. */
        descricao={
          novas.length + antigas.length === 0
            ? 'Nenhuma ordem, nem no sistema nem no arquivo.'
            : `${contar(novas.length + antigas.length, 'ordem', 'ordens')} · ${valorEmReais(totalGeral)} no total`
        }
        acoes={
          <>
            <Link href={`/clientes/${c.id}/editar`} className="btn">Editar</Link>
            <form action={c.arquivadoEm ? reativar : arquivar}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="btn btn-ghost-secondary">
                {c.arquivadoEm ? 'Reativar' : 'Arquivar'}
              </button>
            </form>
          </>
        }
      />
      <CorpoPagina>
        <div className="row g-3">
          {/* O contato e uma coluna estreita de pares rotulo/valor; a lista de
              ordens e uma tabela que precisa de largura. Antes as duas dividiam
              a tela meio a meio, e as duas saiam perdendo. */}
          <div className="col-xl-4">
            <div className="card h-100">
              <div className="card-header"><h2 className="card-title">Contato</h2></div>
              <div className="card-body">
                <dl className="ficha-dados mb-0">
                  <Dado rotulo="Telefones">
                    {c.telefones.length === 0 ? <span className="text-secondary">nenhum</span> : null}
                    {c.telefones.map((t) => (
                      <div key={t.original}>
                        {t.normalizado ? formatarTelefone(t.normalizado) : <span className="text-secondary">{t.original} (não discável)</span>}
                        {t.inferido ? <div className="anotacao-solta">nono dígito completado; no legado: {t.original}</div> : null}
                      </div>
                    ))}
                  </Dado>
                  <Dado rotulo="Contato">{c.contato ?? '—'}</Dado>
                  <Dado rotulo="E-mail">{c.email ?? '—'}</Dado>
                  <Dado rotulo="Documento">{c.documento ? formatarDocumento(c.documento) : '—'}</Dado>
                  <Dado rotulo="Endereço">{endereco || '—'}</Dado>
                  <Dado rotulo="Cadastro">
                    {/* Data do legado foi gravada a meia-noite UTC; cadastro novo e no fuso da loja. */}
                    {c.criadoEm.toLocaleDateString('pt-BR', { timeZone: c.codigoLegado !== null ? 'UTC' : 'America/Sao_Paulo' })}
                    {c.codigoLegado !== null ? <div className="anotacao-solta">legado nº {c.codigoLegado}</div> : null}
                  </Dado>
                  {c.observacoes ? (
                    <Dado rotulo="Observações">
                      <div className="texto-original">{c.observacoes}</div>
                    </Dado>
                  ) : null}
                </dl>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <CartaoTabela
              className="h-100"
              rotulo={`Ordens de ${c.nome}`}
              titulo="Ordens"
              aoLado={novas.length > 0 ? <span className="text-secondary">{valorEmReais(totalNovo)}</span> : null}
              vazio={
                novas.length === 0 ? (
                  <BlocoVazio
                    titulo="Nenhuma ordem ainda"
                    descricao="As ordens abertas para este cliente aparecem aqui, da mais recente para a mais antiga."
                  />
                ) : null
              }
              colunas={
                <>
                  <th className="w-1">Nº</th>
                  <th>Situação</th>
                  <th>Aberta em</th>
                  <th className="text-end">Total</th>
                </>
              }
            >
              {novas.map((o) => (
                <tr key={o.id}>
                  <td className="numero">
                    <Link href={`/ordens/${o.id}`} className="text-reset"><NumeroOs numero={o.numero} /></Link>
                  </td>
                  <td><SituacaoEstado estado={o.estadoProducao} /></td>
                  <td className="text-secondary">{formatarDataCalendario(new Date(o.abertaEm))}</td>
                  <td className="numero"><Dinheiro valor={o.precoFinal} /></td>
                </tr>
              ))}
            </CartaoTabela>
          </div>

          {/* Largura inteira: a coluna "O que foi feito" e texto livre digitado
              no sistema antigo, e era o que mais sofria espremido em meia tela. */}
          <div className="col-12">
            <CartaoTabela
              rotulo={`Ordens de ${c.nome} no sistema antigo`}
              titulo="No sistema antigo"
              aoLado={
                antigas.length > 0 ? (
                  <span className="text-secondary">{contar(antigas.length, 'ordem', 'ordens')} até 2026 · {valorEmReais(totalAntigo)}</span>
                ) : null
              }
              vazio={
                antigas.length === 0 ? (
                  <BlocoVazio
                    titulo="Nada no arquivo para este cliente"
                    descricao="As ordens de 2012 a 2026 aparecem aqui quando o código do cadastro antigo bate com o deste cliente."
                  />
                ) : null
              }
              colunas={
                <>
                  <th className="w-1">Nº</th>
                  <th className="w-1">Entrada</th>
                  <th>O que foi feito</th>
                  <th className="text-end">Total</th>
                </>
              }
            >
              {antigas.map((l) => (
                <tr key={l.id}>
                  <td className="numero"><NumeroOs numero={l.numero} /></td>
                  <td className="text-secondary">{formatarDataCalendario(new Date(l.dataEntrada))}</td>
                  <td><div className="texto-original">{limparTextoLegado(l.texto)}</div></td>
                  <td className="numero"><Dinheiro valor={l.total} /></td>
                </tr>
              ))}
            </CartaoTabela>
          </div>
        </div>
      </CorpoPagina>
    </>
  )
}
