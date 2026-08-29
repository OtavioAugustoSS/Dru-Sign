'use client'

import { IconPrinter } from '@tabler/icons-react'

export function BotaoImprimir() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()} autoFocus>
      <IconPrinter className="icon" /> Imprimir
    </button>
  )
}
