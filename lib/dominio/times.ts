import type { Mundo, Papel, Projeto, Time } from "./tipos"

/**
 * O time é a unidade de alocação (§2.0): o squad de um projeto só usa membros do time dele.
 * Cargos escassos circulam por vários times.
 */
export function membrosDoTime(mundo: Mundo, timeId: number): number[] {
  const t = mundo.times.find((x) => x.id === timeId)
  if (!t) return mundo.pessoas.map((p) => p.id)
  return t.membros.filter((id) => mundo.pessoas[id])
}

export function timeDoProjeto(mundo: Mundo, pr: Projeto): Time | null {
  return mundo.times.find((t) => t.id === pr.timeId) ?? null
}

export function projetosDoTime(mundo: Mundo, timeId: number): Projeto[] {
  return mundo.projetos.filter((p) => p.timeId === timeId)
}

export function cargosDoTime(mundo: Mundo, timeId: number): Record<Papel, number> {
  const c: Record<Papel, number> = {}
  membrosDoTime(mundo, timeId).forEach((id) => {
    const p = mundo.pessoas[id]
    c[p.papel] = (c[p.papel] || 0) + 1
  })
  return c
}
