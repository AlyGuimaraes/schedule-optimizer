import { describe, expect, it } from "vitest"

import {
  analisarCustos,
  clienteDe,
  construirMundo,
  criarConfig,
  custoCerimonia,
  CUSTO_HORA_PADRAO,
  faixaVolume,
  simular,
} from "@/lib/dominio"

describe("custo de cerimônia (§6, E08 e E24)", () => {
  it("horas vezes o custo-hora do cargo de cada cadeira", () => {
    const ev = { dur: 60, papeis: ["Analista", "Líder Técnico"] }
    expect(custoCerimonia(ev)).toBe(2 * CUSTO_HORA_PADRAO)
    expect(custoCerimonia(ev, { custoHora: { "Líder Técnico": 300 } })).toBe(CUSTO_HORA_PADRAO + 300)
    expect(custoCerimonia({ dur: 30, papeis: ["Analista"] }, { custoHora: { Analista: 90 } })).toBe(45)
  })

  it("cliente do projeto e faixas de volume", () => {
    expect(clienteDe({ nome: "Agro Bandeirante I" })).toBe("Agro Bandeirante")
    expect(clienteDe({ nome: "Agro Bandeirante I", cliente: "Agro Bandeirante S.A." })).toBe("Agro Bandeirante S.A.")
    expect(faixaVolume(3)).toBe("até 3 produtos")
    expect(faixaVolume(10)).toBe("10 ou mais")
  })

  it("os recortes somam o total e o benchmark cobre todos os projetos", () => {
    const mundo = construirMundo()
    const cfg = criarConfig({ custoHora: { "Líder Técnico": 260, Analista: 95 } })
    const sim = simular(mundo, cfg)
    const a = analisarCustos(sim, mundo, cfg)
    const soma = (xs: { custo: number }[]) => xs.reduce((s, x) => s + x.custo, 0)
    expect(a.total).toBeGreaterThan(0)
    expect(soma(a.porCliente)).toBeCloseTo(a.total, 6)
    expect(soma(a.porTipo)).toBeCloseTo(a.total, 6)
    expect(soma(a.porFase)).toBeCloseTo(a.total, 6)
    expect(soma(a.porVolume)).toBeCloseTo(a.total, 6)
    expect(a.porVolume.reduce((s, x) => s + x.projetos, 0)).toBe(mundo.projetos.length)
    // pessoa-hora do recorte bate com a projeção mensal da simulação
    const ph = a.porCliente.reduce((s, x) => s + x.pessoaHora, 0)
    expect(ph).toBeCloseTo(sim.mes.otm.horas, 0)
  })
})
