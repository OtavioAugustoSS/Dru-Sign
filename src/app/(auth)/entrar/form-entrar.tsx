'use client'

import { useActionState } from 'react'
import { entrar, type EstadoEntrar } from './actions'

const ESTADO_INICIAL: EstadoEntrar = {}

export function FormEntrar({ proximo }: { proximo: string }) {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL)

  return (
    <form action={acao} noValidate>
      <input type="hidden" name="proximo" value={proximo} />

      {estado.erro ? (
        <div className="alert alert-danger" role="alert">
          {estado.erro}
        </div>
      ) : null}

      <div className="mb-3">
        <label className="form-label" htmlFor="login">
          Login
        </label>
        <input
          id="login"
          name="login"
          className="form-control"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={estado.login ?? ''}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          className="form-control"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn-primary w-100" disabled={pendente}>
          {pendente ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
