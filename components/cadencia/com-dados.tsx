"use client"

import type { ReactNode } from "react"
import { useShallow } from "zustand/react/shallow"

import type { Config, Mundo, Simulacao } from "@/lib/dominio"
import type { Indices } from "@/lib/dados/mapeador"
import { useCadencia, type Cenario } from "@/lib/estado/cadencia"

import { EsqueletoTela, VazioTela } from "./primitivas"

export interface Contexto {
  mundo: Mundo
  config: Config
  indices: Indices
  simulacao: Simulacao
  cenario: Cenario
  ms: number
}

/**
 * Entrega às telas o mundo, a configuração e a simulação prontos. Enquanto o motor calcula,
 * mostra o esqueleto com a forma da tela; sem banco, explica o problema.
 */
export function ComDados({ children }: { children: (ctx: Contexto) => ReactNode }) {
  const d = useCadencia(
    useShallow((s) => ({
      mundo: s.mundo,
      config: s.config,
      indices: s.indices,
      simulacao: s.simulacao,
      cenario: s.cenario,
      ms: s.ms,
      erro: s.erro,
    }))
  )

  if (!d.mundo || !d.config || !d.indices || !d.simulacao) {
    if (d.erro)
      return (
        <VazioTela titulo="Não foi possível carregar a operação">
          O banco não respondeu: {d.erro}. Confira as variáveis do Supabase e recarregue a página.
        </VazioTela>
      )
    return <EsqueletoTela />
  }

  return children({
    mundo: d.mundo,
    config: d.config,
    indices: d.indices,
    simulacao: d.simulacao,
    cenario: d.cenario,
    ms: d.ms ?? 0,
  })
}
