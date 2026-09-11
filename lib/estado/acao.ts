"use client"

import { useCallback, useState, useTransition } from "react"

import type { Resultado } from "@/lib/dados/tipos-acoes"

import { useCadencia } from "./cadencia"

/**
 * Executa uma server action com os estados do §14.8: "salvando" na linha de estado, erro inline
 * no rodapé do editor e aviso de sucesso. O layout revalida e o mundo volta do banco sozinho.
 */
export function useAcao() {
  const avisar = useCadencia((s) => s.avisar)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const executar = useCallback(
    <T,>(acao: () => Promise<Resultado<T>>, sucesso: string, aoConcluir?: (dados: T) => void) => {
      setErro(null)
      avisar("salvando", 10000)
      iniciar(async () => {
        const r = await acao()
        if (r.ok) {
          avisar(sucesso)
          aoConcluir?.(r.dados)
        } else {
          setErro(r.erro)
          avisar("não foi possível salvar", 3000)
        }
      })
    },
    [avisar]
  )

  return { executar, erro, setErro, pendente }
}
