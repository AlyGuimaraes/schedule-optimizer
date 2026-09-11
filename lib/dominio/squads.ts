import { papeisModificadores } from "./modificadores"
import { membrosDoTime } from "./times"
import type { Config, Mundo, Papel, Projeto } from "./tipos"

/** Cargos que a fase exige, vindos do playbook da etapa. */
export function papeisNecessarios(mundo: Mundo, fase: string): Papel[] {
  return [...new Set((mundo.playbook[fase] ?? []).flatMap((c) => c.papeis))]
}

/**
 * Cargos que o projeto exige: os da fase e, com os modificadores automáticos ligados (§3.3),
 * os da sala de guerra nos projetos em vermelho e o do checkpoint nos de cliente prioritário.
 */
export function papeisDoProjeto(mundo: Mundo, pr: Projeto, cfg?: Partial<Config>): Papel[] {
  const base = papeisNecessarios(mundo, pr.fase)
  if (!cfg?.modificadores) return base
  return [...new Set([...base, ...papeisModificadores(mundo, pr)])]
}

export function cargaDeProjetos(mundo: Mundo): Record<number, number> {
  const c: Record<number, number> = {}
  mundo.pessoas.forEach((p) => {
    c[p.id] = 0
  })
  mundo.projetos.forEach((pr) =>
    Object.values(pr.squad).forEach((id) => {
      if (id !== undefined && c[id] !== undefined) c[id]++
    })
  )
  return c
}

export function menosCarregado(
  mundo: Mundo,
  papel: Papel,
  excluir: (number | undefined)[],
  carga?: Record<number, number>,
  elegiveis?: number[]
): number | undefined {
  const c = carga ?? cargaDeProjetos(mundo)
  let cand = mundo.pessoas.filter(
    (p) => p.papel === papel && (excluir ?? []).indexOf(p.id) < 0
  )
  if (elegiveis) cand = cand.filter((p) => elegiveis.indexOf(p.id) >= 0)
  if (!cand.length) return undefined
  return cand.sort((a, b) => c[a.id] - c[b.id])[0].id
}

/** Garante que o squad cobre exatamente os cargos exigidos pela fase, só com gente do time. */
export function montarSquad(mundo: Mundo, pr: Projeto, cfg?: Partial<Config>): Projeto {
  const nec = papeisDoProjeto(mundo, pr, cfg)
  const squad: Record<Papel, number | undefined> = {}
  const carga = cargaDeProjetos(mundo)
  const elegiveis = membrosDoTime(mundo, pr.timeId)
  nec.forEach((pp) => {
    const atual = pr.squad ? pr.squad[pp] : undefined
    const valido =
      atual !== undefined &&
      atual !== null &&
      mundo.pessoas[atual] &&
      mundo.pessoas[atual].papel === pp &&
      elegiveis.indexOf(atual) >= 0
    squad[pp] = valido
      ? atual
      : menosCarregado(
          mundo,
          pp,
          Object.values(squad).filter((v) => v !== undefined),
          carga,
          elegiveis
        )
  })
  pr.squad = squad
  return pr
}

/** Cargos obrigatórios sem cadeira: a cerimônia não acontece, por falta de quórum (§3.2). */
export function squadIncompleto(mundo: Mundo, pr: Projeto, cfg?: Partial<Config>): Papel[] {
  return papeisDoProjeto(mundo, pr, cfg).filter(
    (pp) => pr.squad[pp] === undefined || pr.squad[pp] === null
  )
}

/** Redistribui todas as cadeiras pela menor carga. Ação explícita de gestão (R21). */
export function rebalancearAlocacao(mundo: Mundo, cfg?: Partial<Config>): void {
  const carga: Record<number, number> = {}
  mundo.pessoas.forEach((p) => {
    carga[p.id] = 0
  })
  mundo.projetos.forEach((pr) => {
    const nec = papeisDoProjeto(mundo, pr, cfg)
    const squad: Record<Papel, number | undefined> = {}
    nec.forEach((pp) => {
      const usados = Object.values(squad)
      const elegiveis = membrosDoTime(mundo, pr.timeId)
      const cand = mundo.pessoas.filter(
        (x) => x.papel === pp && usados.indexOf(x.id) < 0 && elegiveis.indexOf(x.id) >= 0
      )
      if (!cand.length) {
        squad[pp] = undefined
        return
      }
      cand.sort((a, b) => carga[a.id] - carga[b.id] || a.id - b.id)
      squad[pp] = cand[0].id
      carga[cand[0].id]++
    })
    pr.squad = squad
  })
}

export function cargoEmUso(mundo: Mundo, papel: Papel): { pessoas: number; cerimonias: number } {
  const pessoas = mundo.pessoas.filter((p) => p.papel === papel).length
  const cerimonias = Object.values(mundo.playbook)
    .flat()
    .filter((c) => c.papeis.indexOf(papel) >= 0).length
  return { pessoas, cerimonias }
}
