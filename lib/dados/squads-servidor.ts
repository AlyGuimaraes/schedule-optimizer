import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { montarSquad, rebalancearAlocacao } from "@/lib/dominio"

import { mapearMundo, type MundoBanco } from "./mapeador"
import type { Database } from "./tipos-banco"

type Cadeira = { projeto_id: string; cargo_id: string; pessoa_id: string | null }

/**
 * Depois de qualquer mudança estrutural (projeto, pessoa, time, cargo, etapa, playbook), os
 * squads são remontados no servidor com as mesmas regras do domínio: `montarSquad` mantém as
 * cadeiras válidas e preenche as vagas pela menor carga, só com gente do time (§2.0).
 * `rebalancear` refaz todas as cadeiras, a ação explícita de gestão (R21).
 * Grava só o que mudou.
 */
export async function remontarSquads(
  sb: SupabaseClient<Database>,
  opcoes: { rebalancear?: boolean } = {}
): Promise<number> {
  const { data, error } = await sb.rpc("carregar_mundo")
  if (error) throw new Error(error.message)
  const { mundo, indices } = mapearMundo(data as unknown as MundoBanco)

  const antes = mundo.projetos.map((p) => ({ ...p.squad }))
  if (opcoes.rebalancear) rebalancearAlocacao(mundo)
  else mundo.projetos.forEach((pr) => montarSquad(mundo, pr))

  const cadeiras: Cadeira[] = []
  mundo.projetos.forEach((pr, i) => {
    const velho = antes[i]
    const novo = pr.squad
    new Set([...Object.keys(velho), ...Object.keys(novo)]).forEach((papel) => {
      const a = velho[papel]
      const b = novo[papel]
      if (a === b) return
      const cargo = indices.cargos[papel]
      if (!cargo) return
      cadeiras.push({
        projeto_id: indices.projetos[i],
        cargo_id: cargo,
        pessoa_id: b === undefined ? null : indices.pessoas[b],
      })
    })
  })

  if (cadeiras.length) {
    const { error: e2 } = await sb.rpc("salvar_squads", { p_cadeiras: cadeiras })
    if (e2) throw new Error(e2.message)
  }
  return cadeiras.length
}
