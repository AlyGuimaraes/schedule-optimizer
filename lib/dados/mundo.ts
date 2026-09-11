import "server-only"

import { cache } from "react"

import { clienteAdmin } from "./admin"
import { mapearMundo, type DadosMundo, type MundoBanco } from "./mapeador"

export type ResultadoCarga =
  | { dados: DadosMundo; erro: null }
  | { dados: null; erro: string }

/**
 * Carrega o mundo vigente numa chamada só (`carregar_mundo()`).
 * O `cache` do React deduplica chamadas dentro da mesma requisição.
 */
export const carregarMundo = cache(async (): Promise<ResultadoCarga> => {
  try {
    const { data, error } = await clienteAdmin().rpc("carregar_mundo")
    if (error) throw new Error(error.message)
    return { dados: mapearMundo(data as unknown as MundoBanco), erro: null }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    console.error("[cadência] falha ao carregar o mundo:", mensagem)
    return { dados: null, erro: mensagem }
  }
})
