'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { SALVANDO } from '@/componentes/rotulos'
import { calcularVenda, PASSOS } from '@/domain/precificacao/familia'
import { valorEmReais } from '@/componentes/dinheiro'
import { salvarFamilia, type EstadoFamilia } from './actions'

const ESTADO_INICIAL: EstadoFamilia = {}

export interface LinhaMaterial {
  id: string
  nome: string
  /** String do Decimal, ou null quando o custo nao foi informado. */
  custo: string | null
  precoAtual: string
  travado: boolean
}

interface Props {
  id: string
  nome: string
  margem: string
  arredondamento: string
  minimoCobranca: string
  linhas: LinhaMaterial[]
}

/** "120,5" -> "120.5". Devolve null quando nao da para ler como numero. */
function numero(texto: string): string | null {
  const t = texto.trim().replace(',', '.')
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return t
}

/**
 * O simulador.
 *
 * A conta roda no navegador, com a mesma funcao do dominio que o servidor usa --
 * `calcularVenda` e pura, entao nao ha duas versoes da verdade. Mexer na margem nao grava
 * nada: so o botao Aplicar grava, e ele diz de antemao quantos precos vai mudar. E a
 * defesa contra uma virgula errada virar 82 precos errados sem ninguem ver.
 */
export function EditorFamilia({ id, nome, margem, arredondamento, minimoCobranca, linhas }: Props) {
  const [estado, acao, pendente] = useActionState(salvarFamilia, ESTADO_INICIAL)
  const [margemTexto, setMargemTexto] = useState(estado.campos?.margem ?? margem)
  const [passo, setPasso] = useState(estado.campos?.arredondamento ?? arredondamento)

  const margemLida = numero(margemTexto)
  const passoLido = numero(passo)

  const previa = useMemo(() => {
    if (margemLida === null || passoLido === null || Number(passoLido) <= 0) return null
    return linhas.map((l) => {
      if (l.travado) return { ...l, precoNovo: null, motivo: 'travado' as const, muda: false }
      if (l.custo === null) return { ...l, precoNovo: null, motivo: 'sem custo' as const, muda: false }
      const precoNovo = calcularVenda({ custo: l.custo, margem: margemLida, arredondamento: passoLido }).toFixed(2)
      return { ...l, precoNovo, motivo: 'calculado' as const, muda: precoNovo !== Number(l.precoAtual).toFixed(2) }
    })
  }, [linhas, margemLida, passoLido])

  const afetados = previa?.filter((l) => l.muda).length ?? 0
  const mudouDoSalvo = margemTexto !== margem || passo !== arredondamento

  /*
   * O QUE ENTRA NA CONTA VEM PRIMEIRO, E SOZINHO.
   *
   * Na Bobina do catalogo real sao 3 materiais com custo contra 39 sem. Listados juntos,
   * as 39 linhas de "R$ 0,00 — sem custo" enterravam as 3 que mudavam de preco: a tela
   * respondia "o que muda?" com uma parede onde nada muda. Agora as que entram ficam na
   * tabela, e as que ficam de fora vao para um bloco que se abre quando alguem perguntar.
   */
  const entram = (previa ?? []).filter((l) => l.motivo === 'calculado')
  const foraDaConta = (previa ?? []).filter((l) => l.motivo !== 'calculado')

  return (
    <form action={acao} noValidate>
      <input type="hidden" name="id" value={id} />

      {estado.erro ? <div className="alert alert-danger" role="alert">{estado.erro}</div> : null}
      {estado.aplicados ? (
        <div className="alert alert-success" role="status">
          Pronto: {estado.aplicados.afetados === 0 ? 'nenhum preço mudou' : `${estado.aplicados.afetados} preços atualizados`}
          {estado.aplicados.pulados > 0 ? `, ${estado.aplicados.pulados} pulados por estarem travados ou sem custo` : ''}.
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header"><h3 className="card-title">Como {nome} calcula</h3></div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label required" htmlFor="margem">Margem sobre o custo</label>
                <div className="input-group">
                  <input
                    id="margem" name="margem" className="form-control numero" inputMode="decimal"
                    value={margemTexto} onChange={(e) => setMargemTexto(e.target.value)} required
                  />
                  <span className="input-group-text">%</span>
                </div>
                {margemLida === null ? (
                  <div className="form-hint text-danger">Não consegui ler como número.</div>
                ) : Number(margemLida) < 0 ? (
                  <div className="form-hint text-warning">Margem negativa: a venda sai abaixo do custo.</div>
                ) : (
                  <div className="form-hint">
                    Custo de {valorEmReais('100')} vira{' '}
                    {valorEmReais(calcularVenda({ custo: '100', margem: margemLida, arredondamento: passoLido ?? '0.01' }).toFixed(2))}.
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label required" htmlFor="arredondamento">Arredondar para</label>
                <select
                  id="arredondamento" name="arredondamento" className="form-select"
                  value={passo} onChange={(e) => setPasso(e.target.value)}
                >
                  {PASSOS.map((p) => (
                    <option key={p.valor} value={p.valor}>{p.rotulo} ({valorEmReais(p.valor)})</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="minimoCobranca">Mínimo de cobrança</label>
                <input
                  id="minimoCobranca" name="minimoCobranca" className="form-control numero" inputMode="decimal"
                  defaultValue={estado.campos?.minimoCobranca ?? minimoCobranca}
                  placeholder="sem mínimo"
                />
                <div className="form-hint">
                  Em m² ou metros lineares. Peça menor que isso é cobrada como se tivesse o mínimo. Deixe vazio para não ter piso.
                </div>
              </div>
            </div>
            <div className="card-footer d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={pendente || margemLida === null || passoLido === null}>
                {pendente ? SALVANDO : afetados > 0 ? `Aplicar a ${afetados}` : 'Salvar'}
              </button>
              <Link href="/precificacao" className="btn">Voltar</Link>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex align-items-baseline justify-content-between">
              <h3 className="card-title mb-0">O que muda</h3>
              <span className="text-secondary small">
                {mudouDoSalvo
                  ? afetados === 0
                    ? 'nenhum preço mudaria'
                    : `${afetados} de ${entram.length} preços mudariam`
                  : `${entram.length} ${entram.length === 1 ? 'preço calculado' : 'preços calculados'} por esta família`}
              </span>
            </div>
            {linhas.length === 0 ? (
              <div className="card-body text-secondary">
                Nenhum material usa esta família ainda. Vincule materiais em{' '}
                <Link href="/materiais">Materiais e preços</Link>.
              </div>
            ) : entram.length === 0 ? (
              <div className="card-body text-secondary">
                Nenhum material desta família tem custo informado, então não há o que calcular.
                Informe o custo de um material em <Link href="/materiais">Materiais e preços</Link> e
                a fórmula passa a valer para ele.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table card-table table-vcenter">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-end">Custo</th>
                      <th className="text-end">Hoje</th>
                      <th className="text-end">{mudouDoSalvo ? 'Ficaria' : 'Calculado'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entram.map((l) => (
                      <tr key={l.id}>
                        <td><Link href={`/materiais/${l.id}`} className="text-reset">{l.nome}</Link></td>
                        <td className="numero">{l.custo === null ? '—' : valorEmReais(l.custo)}</td>
                        <td className="numero">{valorEmReais(l.precoAtual)}</td>
                        <td className="numero">
                          {l.precoNovo === null ? (
                            '—'
                          ) : l.muda ? (
                            <span className="fw-bold">{valorEmReais(l.precoNovo)}</span>
                          ) : (
                            <span className="text-secondary">{valorEmReais(l.precoNovo)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {foraDaConta.length > 0 ? (
              <details className="card-footer">
                <summary className="text-secondary small" style={{ cursor: 'pointer' }}>
                  {foraDaConta.length} {foraDaConta.length === 1 ? 'material fica' : 'materiais ficam'} de fora: preço travado ou custo não informado
                </summary>
                <div className="table-responsive mt-2">
                  <table className="table table-sm table-vcenter">
                    <tbody>
                      {foraDaConta.map((l) => (
                        <tr key={l.id} className="text-secondary">
                          <td>
                            <Link href={`/materiais/${l.id}?foco=custo`} className="text-reset">{l.nome}</Link>
                          </td>
                          <td className="numero w-1"><span className="badge bg-secondary-lt">{l.motivo}</span></td>
                          <td className="numero w-1">{valorEmReais(l.precoAtual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  )
}
