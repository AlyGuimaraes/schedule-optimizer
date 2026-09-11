import "server-only"

import { cache } from "react"

import { registrar } from "@/lib/log"

import { clienteAdmin } from "./admin"
import { aplicarPlano, mapearMundo, type DadosMundo, type MundoBanco, type PlanoBanco } from "./mapeador"

export type ResultadoCarga =
  | { dados: DadosMundo; erro: null }
  | { dados: null; erro: string }

/**
 * Carrega o mundo vigente (`carregar_mundo()`) e o plano publicado com as âncoras
 * (`carregar_plano()`), em paralelo. O `cache` do React deduplica dentro da requisição.
 */
export const carregarMundo = cache(async (): Promise<ResultadoCarga> => {
  try {
    const sb = clienteAdmin()
    const [mundo, plano] = await Promise.all([sb.rpc("carregar_mundo"), sb.rpc("carregar_plano")])
    if (mundo.error) throw new Error(mundo.error.message)
    let dados = mapearMundo(mundo.data as unknown as MundoBanco)
    // sem o plano o app funciona igual, só sem estabilidade e âncoras
    if (plano.error) registrar("aviso", "plano_indisponivel", { erro: plano.error.message })
    else if (plano.data) dados = aplicarPlano(dados, plano.data as unknown as PlanoBanco)
    return { dados, erro: null }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    registrar("erro", "mundo_carga_falhou", { erro: mensagem })
    return { dados: null, erro: mensagem }
  }
})
