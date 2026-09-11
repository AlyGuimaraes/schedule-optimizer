"use client"

import type { Resultado } from "@/lib/dados/tipos-acoes"

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Grava uma edição em linha depois de uma pausa na digitação. Edições seguidas no mesmo campo
 * viram uma gravação só, e cada gravação vira uma versão de premissa com vigência.
 */
export function persistirAdiado(
  chave: string,
  gravar: () => Promise<Resultado<unknown>>,
  aoErro: (erro: string) => void,
  espera = 700
) {
  clearTimeout(timers.get(chave))
  timers.set(
    chave,
    setTimeout(async () => {
      timers.delete(chave)
      const r = await gravar()
      if (!r.ok) aoErro(r.erro)
    }, espera)
  )
}
