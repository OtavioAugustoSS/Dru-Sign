'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useActionState, useState } from 'react'
import { salvarMaterial, type EstadoMaterial } from './actions'
import { UNIDADES_COBRANCA } from '@/infra/materiais/unidades'
import { calcularVenda } from '@/domain/precificacao/familia'
import { valorEmReais } from '@/componentes/dinheiro'

const ESTADO_INICIAL: EstadoMaterial = {}

export interface FamiliaParaEscolha {
  id: string
  nome: string
  unidadePadrao: string
  /** Strings exatas: Decimal nao atravessa a fronteira servidor -> cliente. */
  margem: string
  arredondamento: string
}

interface Props {
  id?: string
  inicial?: {
    nome: string
    categoria: string
    preco: string
    custo: string
    familiaPrecoId: string
    precoTravado: boolean
    unidadeCobranca: string
  }
  familias: FamiliaParaEscolha[]
  /** Qual campo a tela deve abrir em foco, quando se chega clicando numa celula da tabela. */
  foco?: 'preco' | 'custo'
}

const VAZIO = { nome: '', categoria: '', preco: '', custo: '', familiaPrecoId: '', precoTravado: false, unidadeCobranca: '' }

/** "38,00" -> "38.00". Null quando nao da para ler como numero. */
function numero(texto: string): string | null {
  const t = texto.trim().replace(',', '.')
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null
  return t
}

export function FormMaterial({ id, inicial, familias, foco }: Props) {
  const [estado, acao, pendente] = useActionState(salvarMaterial, ESTADO_INICIAL)
  const v = estado.campos ?? inicial ?? VAZIO

  const [custo, setCusto] = useState(v.custo)
  const [familiaId, setFamiliaId] = useState(v.familiaPrecoId)
  const [travado, setTravado] = useState(v.precoTravado)
  // Controlado desde a montagem: o campo alterna entre digitavel e calculado, e trocar
  // `defaultValue` por `value` no meio da vida do input e o que o React reclama como
  // "changing an uncontrolled input to be controlled".
  const [preco, setPreco] = useState(v.preco)

  const familia = familias.find((f) => f.id === familiaId) ?? null
  const custoLido = numero(custo)
  // A familia so calcula quando ha custo e o preco nao esta travado -- mesma
  // precedencia de `precoEfetivo`, para a tela nao prometer o que o servidor nao faz.
  const calculado =
    familia !== null && custoLido !== null && !travado
      ? calcularVenda({ custo: custoLido, margem: familia.margem, arredondamento: familia.arredondamento }).toFixed(2)
      : null

  return (
    <form action={acao} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {estado.erro ? <div className="alert alert-danger" role="alert">{estado.erro}</div> : null}

      <div className="row g-3">
        <div className="col-md-5">
          <label className="form-label required" htmlFor="nome">Material</label>
          <input id="nome" name="nome" className="form-control" defaultValue={v.nome}
            placeholder="Adesivo vinil fosco" required autoFocus={foco === undefined} />
          {/* O nome carrega a variacao inteira de proposito. E por ele que a
              entrada assistida acha o material quando a pessoa digita a linha da
              ordem: se o nome fosse so "Fosco", digitar "adesivo vinil fosco"
              nao chegaria nele. */}
          <div className="form-hint">Uma linha por variação: fosco, transparente, brilhoso.</div>
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="categoria">Categoria</label>
          <input id="categoria" name="categoria" className="form-control" defaultValue={v.categoria}
            placeholder="Adesivo vinil" />
          <div className="form-hint">A família que junta as variações.</div>
        </div>
        <div className="col-md-3">
          <label className="form-label required" htmlFor="unidadeCobranca">Cobrado</label>
          {/* key: o React 19 reseta o form apos a action, e defaultValue de <select> so vale na montagem. */}
          <select key={v.unidadeCobranca} id="unidadeCobranca" name="unidadeCobranca" className="form-select" defaultValue={v.unidadeCobranca} required>
            <option value="">Escolha</option>
            {UNIDADES_COBRANCA.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
          </select>
        </div>
      </div>

      <hr className="my-3" />

      <div className="row g-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label" htmlFor="familiaPrecoId">Família de preço</label>
          <select id="familiaPrecoId" name="familiaPrecoId" className="form-select"
            value={familiaId} onChange={(e) => setFamiliaId(e.target.value)}>
            <option value="">Nenhuma — preço digitado</option>
            {familias.map((f) => (
              <option key={f.id} value={f.id}>{f.nome} (margem {Number(f.margem).toFixed(0)}%)</option>
            ))}
          </select>
          <div className="form-hint">Quem decide a margem deste material.</div>
        </div>

        <div className="col-md-3">
          <label className="form-label" htmlFor="custo">Custo</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            <input id="custo" name="custo" className="form-control numero" inputMode="decimal"
              value={custo} onChange={(e) => setCusto(e.target.value)}
              placeholder="não informado" autoFocus={foco === 'custo'} />
          </div>
          <div className="form-hint">Quanto a empresa paga.</div>
        </div>

        <div className="col-md-3">
          <label className="form-label required" htmlFor="preco">Preço de venda</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            {/* Calculado pela familia, o campo fica so de leitura: deixar editavel seria
                mentira, porque o servidor ignora o que for digitado e refaz a conta.
                Para digitar o preco, trave. */}
            <input
              id="preco" name={calculado === null ? 'preco' : undefined}
              className="form-control numero" inputMode="decimal"
              value={calculado === null ? preco : valorEmReais(calculado)}
              onChange={(e) => setPreco(e.target.value)}
              readOnly={calculado !== null}
              required={calculado === null}
              autoFocus={foco === 'preco'}
            />
            {/* Campo `readOnly` E enviado (ao contrario de `disabled`), e o visivel mostra
                "R$ 83,60". O servidor recalcula neste caso e ignora o valor -- mas se algum
                dia cair no ramo do preco digitado, receberia o texto formatado. O `name` sai
                do visivel e vai para este, que carrega o numero cru. */}
            {calculado !== null ? <input type="hidden" name="preco" value={calculado} /> : null}
          </div>
          <div className="form-hint">
            {calculado !== null && familia !== null ? (
              <span className="text-success">
                {valorEmReais(custoLido!)} + {Number(familia.margem).toFixed(0)}% = <strong>{valorEmReais(calculado)}</strong>
              </span>
            ) : travado ? (
              'Travado: a família não mexe neste preço.'
            ) : familia === null ? (
              'Sem família, o preço é o que você digitar.'
            ) : (
              'Informe o custo para a família calcular.'
            )}
          </div>
        </div>

        <div className="col-md-2">
          <label className="form-check">
            <input className="form-check-input" type="checkbox" name="precoTravado" value="1"
              checked={travado} onChange={(e) => setTravado(e.target.checked)} />
            <span className="form-check-label">Travar preço</span>
          </label>
          <div className="form-hint">Ignora a família.</div>
        </div>
      </div>

      <div className="mt-3">
        <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? SALVANDO : 'Salvar'}</button>
      </div>
    </form>
  )
}
