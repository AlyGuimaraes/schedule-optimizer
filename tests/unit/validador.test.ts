import { describe, expect, it } from "vitest"

import { construirMundo, criarConfig, simular, validarPlano } from "@/lib/dominio"

// Critério de aceite da E12: nenhuma violação de regra rígida em 100 sementes.
// Duas semanas por semente mantêm o teste abaixo de alguns segundos e ainda
// exercitam o orçamento mensal acumulado entre semanas.
describe("validador em 100 sementes", () => {
  it("o motor não viola regra rígida em nenhuma semente", () => {
    const falhas: string[] = []
    let alocadas = 0
    for (let seed = 1; seed <= 100; seed++) {
      const mundo = construirMundo(seed)
      const cfg = criarConfig({ horizonte: 2 })
      const sim = simular(mundo, cfg)
      for (const w of sim.semanas) {
        alocadas += w.otm.alocadas.length
        const v = validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo)
        if (v.length) falhas.push(`semente ${seed}, semana ${w.semana + 1}: ${v[0].regra} ${v[0].descricao}`)
      }
    }
    expect(falhas).toEqual([])
    // garante que o teste não passa por vacuidade: cada semana aloca dezenas de cerimônias
    expect(alocadas).toBeGreaterThan(100 * 2 * 40)
  }, 60_000)
})
