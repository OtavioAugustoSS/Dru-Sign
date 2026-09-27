'use client'

import { useActionState } from 'react'
import { SALVANDO } from '@/componentes/rotulos'
import { UNIDADES_COBRANCA } from '@/infra/materiais/unidades'
import { novaFamilia, type EstadoNovaFamilia } from './actions'

const ESTADO_INICIAL: EstadoNovaFamilia = {}

export function FormFamilia() {
  const [estado, acao, pendente] = useActionState(novaFamilia, ESTADO_INICIAL)
  const v = estado.campos ?? { nome: '', unidadePadrao: '', margem: '' }

  return (
    <form action={acao} noValidate>
      {estado.erro ? <div className="alert alert-danger" role="alert">{estado.erro}</div> : null}
      <div className="row g-3 align-items-end">
        <div className="col-md-5">
          <label className="form-label required" htmlFor="nomeFamilia">Família</label>
          <input id="nomeFamilia" name="nome" className="form-control" defaultValue={v.nome}
            placeholder="Chapa rígida" required />
          <div className="form-hint">O grupo que compartilha a mesma política de preço.</div>
        </div>
        <div className="col-md-3">
          <label className="form-label required" htmlFor="unidadePadrao">Cobrado</label>
          {/* key: o React 19 reseta o form apos a action, e defaultValue de <select> so vale na montagem. */}
          <select key={v.unidadePadrao} id="unidadePadrao" name="unidadePadrao" className="form-select" defaultValue={v.unidadePadrao} required>
            <option value="">Escolha</option>
            {UNIDADES_COBRANCA.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label required" htmlFor="margemNova">Margem</label>
          <div className="input-group">
            <input id="margemNova" name="margem" className="form-control numero" inputMode="decimal"
              defaultValue={v.margem} placeholder="120" required />
            <span className="input-group-text">%</span>
          </div>
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary w-100" disabled={pendente}>{pendente ? SALVANDO : 'Criar família'}</button>
        </div>
      </div>
    </form>
  )
}
