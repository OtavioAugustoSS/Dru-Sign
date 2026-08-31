'use client'

import { useEffect, useState } from 'react'
import { Apelido } from '@/componentes/situacao'
import { formatarTelefone } from '@/domain/clientes/telefone'
import type { ClienteResumo } from '@/infra/clientes/repositorio'
import { buscarClientesAction } from '@/app/(app)/ordens/[id]/actions'

/**
 * O campo de cliente da ordem nova.
 *
 * É o único pedaço desta tela que precisa de JavaScript, e precisa por natureza:
 * buscar entre 3.219 cadastros enquanto a pessoa digita não se faz com HTML. O
 * resto do formulário -- data, responsável, o botão -- é `<form action=...>` de
 * server action, que o Next faz funcionar mesmo antes de hidratar.
 *
 * O id escolhido vai num `<input type="hidden">`, e não em estado que o servidor
 * precise ler: assim o formulário continua sendo um formulário, e quem grava é o
 * mesmo caminho de sempre.
 *
 * Sem cliente é venda de balcão, e isso é dito na tela em vez de ficar
 * subentendido -- foi assim que ordem saiu para a bancada sem nome de dono.
 */
export function BuscaCliente() {
  const [termo, setTermo] = useState('')
  const [escolhido, setEscolhido] = useState<ClienteResumo | null>(null)
  const [sugestoes, setSugestoes] = useState<ClienteResumo[]>([])

  useEffect(() => {
    if (escolhido || termo.trim().length < 2) { setSugestoes([]); return }
    const t = setTimeout(() => { buscarClientesAction(termo).then(setSugestoes) }, 150)
    return () => clearTimeout(t)
  }, [termo, escolhido])

  const rotulo = escolhido ? `${escolhido.nome}${escolhido.apelido ? ` (${escolhido.apelido})` : ''}` : termo

  return (
    <div className="position-relative">
      <label className="form-label" htmlFor="cliente">Cliente</label>
      <input
        id="cliente"
        name="clienteBusca"
        className="form-control"
        autoComplete="off"
        placeholder="Nome, apelido ou telefone"
        role="combobox"
        aria-expanded={sugestoes.length > 0}
        aria-controls="sugestoes-nova"
        aria-autocomplete="list"
        value={rotulo}
        onChange={(e) => { setEscolhido(null); setTermo(e.target.value) }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setTermo(''); setSugestoes([]) } }}
      />
      <input type="hidden" name="clienteId" value={escolhido?.id ?? ''} />

      {sugestoes.length > 0 ? (
        <ul className="list-group position-absolute w-100 shadow lista-sugestoes" id="sugestoes-nova" role="listbox" aria-label="Clientes encontrados">
          {sugestoes.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="list-group-item list-group-item-action"
                onClick={() => { setEscolhido(c); setTermo(''); setSugestoes([]) }}
              >
                {c.nome}<Apelido apelido={c.apelido} />
                <span className="text-secondary ms-2">
                  {c.telefones[0]?.normalizado ? formatarTelefone(c.telefones[0].normalizado) : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* A dica some enquanto a lista esta aberta: a lista flutua sobre o que vem
          depois, e as duas ocupavam o mesmo lugar -- o texto da dica aparecia
          POR CIMA dos nomes, e nao dava para ler nem um nem outro. */}
      {sugestoes.length > 0 ? null : (
        <div className="form-hint">
          {escolhido ? 'A ordem já nasce no nome dele.' : 'Deixe em branco e a ordem entra como venda de balcão.'}
        </div>
      )}
    </div>
  )
}
