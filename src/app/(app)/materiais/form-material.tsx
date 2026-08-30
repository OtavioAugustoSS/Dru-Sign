'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useActionState } from 'react'
import { salvarMaterial, type EstadoMaterial } from './actions'
import { UNIDADES_COBRANCA } from '@/infra/materiais/unidades'

const ESTADO_INICIAL: EstadoMaterial = {}

interface Props {
  id?: string
  inicial?: { nome: string; categoria: string; preco: string; unidadeCobranca: string }
}

export function FormMaterial({ id, inicial }: Props) {
  const [estado, acao, pendente] = useActionState(salvarMaterial, ESTADO_INICIAL)
  const v = estado.campos ?? inicial ?? { nome: '', categoria: '', preco: '', unidadeCobranca: '' }

  return (
    <form action={acao} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {estado.erro ? <div className="alert alert-danger" role="alert">{estado.erro}</div> : null}
      <div className="row g-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label required" htmlFor="nome">Material</label>
          <input id="nome" name="nome" className="form-control" defaultValue={v.nome}
            placeholder="Adesivo vinil fosco" required autoFocus />
          {/* O nome carrega a variacao inteira de proposito. E por ele que a
              entrada assistida acha o material quando a pessoa digita a linha da
              ordem: se o nome fosse so "Fosco", digitar "adesivo vinil fosco"
              nao chegaria nele. */}
          <div className="form-hint">Uma linha por variação: fosco, transparente, brilhoso.</div>
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="categoria">Categoria</label>
          <input id="categoria" name="categoria" className="form-control" defaultValue={v.categoria}
            placeholder="Adesivo vinil" />
          <div className="form-hint">A família que junta as variações.</div>
        </div>
        <div className="col-md-2">
          <label className="form-label required" htmlFor="preco">Preço</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            <input id="preco" name="preco" className="form-control numero" inputMode="decimal" defaultValue={v.preco} required />
          </div>
        </div>
        <div className="col-md-2">
          <label className="form-label required" htmlFor="unidadeCobranca">Cobrado</label>
          {/* key: o React 19 reseta o form apos a action, e defaultValue de <select> so vale na montagem. */}
          <select key={v.unidadeCobranca} id="unidadeCobranca" name="unidadeCobranca" className="form-select" defaultValue={v.unidadeCobranca} required>
            <option value="">Escolha</option>
            {UNIDADES_COBRANCA.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
          </select>
        </div>
        <div className="col-md-1 d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? SALVANDO : 'Salvar'}</button>
        </div>
      </div>
    </form>
  )
}
