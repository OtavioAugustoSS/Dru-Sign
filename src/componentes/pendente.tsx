'use client'

import { useLinkStatus } from 'next/link'

/**
 * Diz ao CSS que o link em volta está esperando o servidor.
 *
 * Existe por um problema medido: navegar trocando só o parâmetro do endereço --
 * virar página, trocar de aba -- deixa a tela IDÊNTICA por 325 a 990ms e o
 * esqueleto de `(app)/loading.tsx` nunca aparece. Não é defeito do esqueleto:
 * `loading.tsx` é limite de SEGMENTO de rota, e mudar `?pagina=` não cria
 * segmento novo. O Next atualiza dentro de uma transition e segura a tela antiga
 * de propósito, para não piscar. O resultado é meio segundo de silêncio depois
 * do clique.
 *
 * `useLinkStatus` é a resposta que o Next 16 dá para isso: só funciona dentro de
 * um `<Link>`, e diz se AQUELE link está pendente. Daqui em diante quem decide o
 * que mostrar é o CSS, através do atributo -- nenhum estilo mora no JavaScript.
 *
 * É o único JavaScript de navegador que esta fase acrescenta.
 */
export function MarcaPendente({ classe }: { classe: string }) {
  const { pending } = useLinkStatus()
  // `undefined` e não `false`: atributo ausente é o que o seletor [data-pendente]
  // espera, e um `data-pendente="false"` casaria com ele.
  return <span className={classe} data-pendente={pending || undefined} aria-hidden="true" />
}
