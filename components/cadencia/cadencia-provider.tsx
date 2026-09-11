"use client"

import * as React from "react"

import type { DadosMundo } from "@/lib/dados/mapeador"
import { useCadencia } from "@/lib/estado/cadencia"

// Entrega ao estado do cliente o mundo carregado no servidor e dispara a primeira simulação.
export function CadenciaProvider({
  dados,
  erro,
  children,
}: {
  dados: DadosMundo | null
  erro: string | null
  children: React.ReactNode
}) {
  const inicializar = useCadencia((s) => s.inicializar)

  React.useEffect(() => {
    inicializar(dados, erro)
  }, [dados, erro, inicializar])

  return children
}
