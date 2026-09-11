import { etapaDe, pesoCliente } from "./premissas"
import type { Cerimonia, Config, Mundo, Papel } from "./tipos"

/**
 * Demanda da semana derivada do playbook (§3). Duas regras do §3.2 vivem aqui:
 * sem todos os cargos obrigatórios não há cerimônia, e a cadeira é do cargo, não da pessoa.
 */
export function gerarDemanda(mundo: Mundo, semana = 1, cfg?: Partial<Config>): Cerimonia[] {
  const dem: Cerimonia[] = []
  let id = 0
  mundo.projetos.forEach((pr) => {
    const et = etapaDe(cfg, pr.fase)
    const pc = pesoCliente(cfg, pr.prioridade || "media")
    ;(mundo.playbook[pr.fase] ?? []).forEach((c) => {
      if ((pr.id + semana) % c.cada !== 0) return
      // sem quórum: a cerimônia não entra na demanda
      if (c.papeis.some((pp) => pr.squad[pp] === undefined || pr.squad[pp] === null)) return
      const pares = c.papeis
        .map((pp) => [pp, pr.squad[pp]] as [Papel, number | undefined])
        .filter((v) => v[1] !== undefined)
      const vistos = new Set<number>()
      const parts: number[] = []
      const paps: Papel[] = []
      pares.forEach(([pp, pid]) => {
        if (!vistos.has(pid as number)) {
          vistos.add(pid as number)
          parts.push(pid as number)
          paps.push(pp)
        }
      })
      if (parts.length === 0) return
      dem.push({
        id: id++,
        projetoId: pr.id,
        projeto: pr.nome,
        fase: pr.fase,
        tipo: c.tipo,
        dur: c.dur,
        slots: Math.ceil(c.dur / 30),
        participantes: parts,
        papeis: paps,
        obrig: c.obrig,
        prio: c.prio,
        health: pr.health,
        timeId: pr.timeId,
        prioridade: pr.prioridade || "media",
        urgencia: et.urgencia,
        prazoDias: et.prazoDias,
        pesoCliente: pc,
        score: +(et.urgencia * pc).toFixed(2),
        sla: et.prazoDias <= 7 && c.obrig,
      })
    })
  })
  return dem
}

/**
 * Demanda teórica por cargo, direto do playbook, contando inclusive o que hoje não acontece
 * por falta de quórum. É o número que responde "falta gente?" no quadro de pessoal (§7.7).
 */
export function demandaPorCargo(
  mundo: Mundo,
  cfg?: Partial<Config>,
  nSemanas = 4
): Record<Papel, { horasSemana: number; cerimoniasSemana: number; horasSemQuorum: number }> {
  const horas: Record<Papel, number> = {}
  const cerim: Record<Papel, number> = {}
  const semQuorum: Record<Papel, number> = {}
  for (let w = 1; w <= nSemanas; w++) {
    mundo.projetos.forEach((pr) => {
      ;(mundo.playbook[pr.fase] ?? []).forEach((c) => {
        if ((pr.id + w) % c.cada !== 0) return
        const falta = c.papeis.some((pp) => pr.squad[pp] === undefined || pr.squad[pp] === null)
        c.papeis.forEach((pp) => {
          horas[pp] = (horas[pp] || 0) + c.dur / 60
          cerim[pp] = (cerim[pp] || 0) + 1
          if (falta) semQuorum[pp] = (semQuorum[pp] || 0) + c.dur / 60
        })
      })
    })
  }
  const saida: Record<Papel, { horasSemana: number; cerimoniasSemana: number; horasSemQuorum: number }> = {}
  Object.keys(horas).forEach((pp) => {
    saida[pp] = {
      horasSemana: horas[pp] / nSemanas,
      cerimoniasSemana: cerim[pp] / nSemanas,
      horasSemQuorum: (semQuorum[pp] || 0) / nSemanas,
    }
  })
  return saida
}
