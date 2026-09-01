'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useActionState } from 'react'
import { salvarCliente, type EstadoCliente } from './actions'
import type { ClienteParecido, DadosCliente, MotivoDuplicidade } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'

const ESTADO_INICIAL: EstadoCliente = {}

const MOTIVO = { telefone: 'mesmo telefone', nome: 'mesmo nome' } as const

/**
 * O titulo diz o que bateu, quando so uma coisa bateu.
 *
 * "Ja existe cadastro parecido" e verdadeiro e inutil: a pessoa tem que ler a
 * lista inteira para descobrir o que o sistema viu. Quando o motivo e um so --
 * que e o caso comum -- o titulo ja resolve.
 */
function tituloDuplicidade(duplicados: ClienteParecido[]): string {
  const motivos = new Set<MotivoDuplicidade>(duplicados.flatMap((d) => d.motivos))
  if (motivos.size === 1) {
    const [unico] = [...motivos]
    return unico === 'telefone'
      ? 'Já existe cadastro com este telefone'
      : 'Já existe cadastro com este nome'
  }
  return 'Já existe cadastro parecido'
}

const VAZIO: DadosCliente = {
  nome: '', apelido: '', documento: '', email: '', contato: '',
  endereco: '', bairro: '', cidade: 'Unaí', uf: 'MG', cep: '', observacoes: '', telefones: [],
}

interface Props {
  id?: string
  inicial?: DadosCliente
}

export function FormCliente({ id, inicial }: Props) {
  const [estado, acao, pendente] = useActionState(salvarCliente, ESTADO_INICIAL)
  const v = estado.campos ?? inicial ?? VAZIO
  const tel = (i: number) => v.telefones[i] ?? ''

  return (
    <form action={acao} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {estado.erro ? (
        <div className="alert alert-danger" role="alert">{estado.erro}</div>
      ) : null}

      {/* O `div` extra dentro do alerta nao e enfeite: o `.alert` do Tabler e
          `display: flex; flex-direction: row`, entao titulo, lista e caixa de
          confirmacao viravam TRES COLUNAS lado a lado -- a confirmacao
          "cadastrar mesmo assim" ficava colada no nome do cliente, como se
          fosse dele. Os outros alertas do sistema tem um filho so e por isso
          nunca mostraram isto. Com um filho unico, o conteudo empilha. */}
      {estado.duplicados && estado.duplicados.length > 0 ? (
        <div className="alert alert-warning" role="alert">
          <div>
          <h4 className="alert-title">{tituloDuplicidade(estado.duplicados)}</h4>
          <ul className="mb-2">
            {estado.duplicados.map(({ cliente: c, motivos }) => (
              <li key={c.id}>
                <a href={`/clientes/${c.id}`}>{c.nome}</a>
                {c.apelido ? ` (${c.apelido})` : ''}
                {' — '}
                {motivos.map((m) => MOTIVO[m]).join(' e ')}
                {/* O telefone so aparece quando foi ele que bateu: em cadastro
                    trazido pelo nome, listar telefone que ninguem digitou faz a
                    pessoa procurar semelhanca onde nao ha. */}
                {motivos.includes('telefone')
                  ? `: ${c.telefones.map((t) => (t.normalizado ? formatarTelefone(t.normalizado) : t.original)).join(', ')}`
                  : ''}
              </li>
            ))}
          </ul>
          <label className="form-check">
            <input className="form-check-input" type="checkbox" name="confirmarDuplicidade" value="1" />
            <span className="form-check-label">É outra pessoa. Cadastrar mesmo assim.</span>
          </label>
          </div>
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label required" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" className="form-control" defaultValue={v.nome} autoFocus required />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="apelido">Apelido</label>
          <input id="apelido" name="apelido" className="form-control" defaultValue={v.apelido ?? ''} placeholder="Como a loja chama" />
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone1">Telefone</label>
          <input id="telefone1" name="telefone1" className="form-control" inputMode="tel" defaultValue={tel(0)} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone2">Telefone 2</label>
          <input id="telefone2" name="telefone2" className="form-control" inputMode="tel" defaultValue={tel(1)} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="telefone3">Telefone 3</label>
          <input id="telefone3" name="telefone3" className="form-control" inputMode="tel" defaultValue={tel(2)} />
        </div>

        <div className="col-md-4">
          <label className="form-label" htmlFor="documento">CPF ou CNPJ</label>
          <input id="documento" name="documento" className="form-control" inputMode="numeric" defaultValue={v.documento ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="form-control" defaultValue={v.email ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="contato">Contato</label>
          <input id="contato" name="contato" className="form-control" defaultValue={v.contato ?? ''} placeholder="Com quem falar" />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="endereco">Endereço</label>
          <input id="endereco" name="endereco" className="form-control" defaultValue={v.endereco ?? ''} />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="bairro">Bairro</label>
          <input id="bairro" name="bairro" className="form-control" defaultValue={v.bairro ?? ''} />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="cep">CEP</label>
          <input id="cep" name="cep" className="form-control" inputMode="numeric" defaultValue={v.cep ?? ''} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" className="form-control" defaultValue={v.cidade ?? ''} />
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="uf">UF</label>
          <input id="uf" name="uf" className="form-control" maxLength={2} defaultValue={v.uf ?? ''} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="observacoes">Observações</label>
          <textarea id="observacoes" name="observacoes" className="form-control" rows={3} defaultValue={v.observacoes ?? ''} />
        </div>
      </div>

      <div className="form-footer d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>
          {pendente ? SALVANDO : 'Salvar'}
        </button>
        <a href={id ? `/clientes/${id}` : '/clientes'} className="btn btn-link">Cancelar</a>
      </div>
    </form>
  )
}
