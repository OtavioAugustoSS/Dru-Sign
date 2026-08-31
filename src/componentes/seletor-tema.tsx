'use client'

import { useEffect, useState, useTransition } from 'react'
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import { ROTULO_TEMA, TEMAS, type Tema } from '@/infra/tema/preferencia'

const ICONE = {
  sistema: IconDeviceDesktop,
  claro: IconSun,
  escuro: IconMoon,
} as const

interface Props {
  inicial: Tema
  escolherAction: (valor: string) => Promise<void>
}

/**
 * Troca o tema na hora e so depois avisa o servidor. A tela nao espera a ida e
 * volta: quem clica ve o resultado no mesmo quadro, e o cookie serve para a
 * PROXIMA visita ja nascer certa.
 */
export function SeletorTema({ inicial, escolherAction }: Props) {
  const [tema, setTema] = useState<Tema>(inicial)
  const [gravando, iniciar] = useTransition()

  /*
   * `gravando` entra nas dependencias por um defeito medido, nao por precaucao.
   *
   * Toda server action faz o Next re-renderizar a rota a partir da raiz, mesmo
   * sem `revalidatePath`. Nessa re-renderizacao o layout devolve
   * `data-bs-theme={undefined}` -- porque quem escolheu "Sistema" nao tem
   * atributo no servidor -- e o React APAGA o atributo que este efeito tinha
   * acabado de escrever. Sem uma dependencia que mude, o efeito nao roda de
   * novo, e o sistema ficava presto no tema claro ate a pessoa recarregar a
   * pagina. Escolher "Sistema" simplesmente nao funcionava.
   *
   * `gravando` vira `true` no clique e `false` quando a action termina, que e
   * exatamente depois da re-renderizacao: o efeito reescreve o atributo.
   */
  useEffect(() => {
    const raiz = document.documentElement

    if (tema !== 'sistema') {
      raiz.setAttribute('data-bs-theme', tema === 'escuro' ? 'dark' : 'light')
      return
    }

    // "Sistema" nao e um valor fixo: acompanha o Windows enquanto a tela estiver
    // aberta. Sem o listener, quem troca o tema do sistema as 18h fica na tela
    // clara ate recarregar.
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => raiz.setAttribute('data-bs-theme', consulta.matches ? 'dark' : 'light')
    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [tema, gravando])

  return (
    <>
      <div className="dropdown-header">Tema</div>
      {TEMAS.map((t) => {
        const Icone = ICONE[t]
        const atual = t === tema
        return (
          <button
            key={t}
            type="button"
            className="dropdown-item d-flex align-items-center"
            aria-pressed={atual}
            onClick={() => {
              setTema(t)
              iniciar(() => {
                void escolherAction(t)
              })
            }}
          >
            <Icone className="icon dropdown-item-icon" />
            {ROTULO_TEMA[t]}
            {atual ? <IconCheck className="icon ms-auto" aria-hidden="true" /> : null}
          </button>
        )
      })}
    </>
  )
}
