'use client'
import { CONFLITO_ORDEM, SALVANDO } from '@/componentes/rotulos'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finalizarServicoAction } from './actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

/**
 * Alvo de toque grande: a producao usa isto de pe, as vezes de luva (spec, tela 8).
 *
 * Contorno, nao verde cheio. O alvo continua com 56px de altura e a largura toda
 * do cartao -- isso nao muda, e o que faz ele ser acertavel de luva. O que muda e
 * a MASSA de cor: numa fila de dez cartoes, dez barras de verde saturado viravam
 * uma parede, e o botao pesava mais na tela do que o servico que ele conclui. O
 * contorno preenche ao passar o mouse e ao apertar, entao a resposta continua
 * inequivoca na hora de usar.
 */
export function BotaoFinalizado({ ordemId, versao }: { ordemId: string; versao: number }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())

  return (
    <>
      <button type="button" className="btn btn-outline-success w-100 botao-producao" disabled={pendente}
        onClick={() => {
          if (pendente) return
          iniciar(async () => {
            const r = await finalizarServicoAction(ordemId, versao, chave.current)
            if (r.ok) { chave.current = gerarChave(); setErro(null); iniciar(() => router.refresh()) }
            else if (r.conflito) { setErro(CONFLITO_ORDEM); router.refresh() }
            else { chave.current = gerarChave(); setErro(r.erro) }
          })
        }}>
        {pendente ? SALVANDO : 'Serviço finalizado'}
      </button>
      {erro ? <div className="text-danger-emphasis mt-2" role="alert">{erro}</div> : null}
    </>
  )
}
