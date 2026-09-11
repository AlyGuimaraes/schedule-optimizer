import { describe, expect, it } from "vitest"

import { construirMundo, criarConfig, PERFIS, simular, validarPlano } from "@/lib/dominio"

const mundo = construirMundo()
const base = simular(mundo, criarConfig({ horizonte: 2 }))

/** Projeto com mais cerimônias alocadas na semana 1 da base. */
const alvo = (() => {
  const conta = new Map<number, number>()
  base.semanas[0].otm.alocadas.forEach((ev) => conta.set(ev.projetoId, (conta.get(ev.projetoId) ?? 0) + 1))
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
})()

describe("exceções por projeto (§2.1)", () => {
  it("janela do cliente: as cerimônias do projeto só acontecem à tarde", () => {
    const cfg = criarConfig({ horizonte: 2, excecoesProjeto: { [alvo]: { inicioMin: 10 } } })
    const sim = simular(mundo, cfg)
    const doAlvo = sim.semanas.flatMap((w) => w.otm.alocadas.filter((ev) => ev.projetoId === alvo))
    expect(doAlvo.length).toBeGreaterThan(0)
    doAlvo.forEach((ev) => expect(ev.slot).toBeGreaterThanOrEqual(10))
    sim.semanas.forEach((w) =>
      expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo)).toEqual([])
    )
  })

  it("duração máxima do projeto vence a do cargo", () => {
    const cfg = criarConfig({ horizonte: 2, excecoesProjeto: { [alvo]: { duracaoMax: 1 } } })
    const sim = simular(mundo, cfg)
    const extra = PERFIS[cfg.perfil].extraDuracao
    sim.semanas.forEach((w) => {
      w.otm.alocadas
        .filter((ev) => ev.projetoId === alvo)
        .forEach((ev) => expect(ev.slots).toBeLessThanOrEqual(1 + (ev.relaxado ? extra : 0)))
      expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo)).toEqual([])
    })
  })

  it("o validador acusa cerimônia fora da janela do cliente", () => {
    const w = base.semanas[0]
    const cedo = w.otm.alocadas.find((ev) => (ev.slot ?? 0) < 10)!
    const cfg = criarConfig({ excecoesProjeto: { [cedo.projetoId]: { inicioMin: 10 } } })
    const v = validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: 1 }, mundo)
    expect(v.some((x) => x.regra === "§2.1" && x.descricao.includes("cliente"))).toBe(true)
  })
})
