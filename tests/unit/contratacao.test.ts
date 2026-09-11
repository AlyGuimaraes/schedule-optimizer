import { describe, expect, it } from "vitest"

import {
  comContratacao,
  compararDispensa,
  construirMundo,
  criarConfig,
  curvaContratacao,
  executarHipotese,
  projecaoTrimestre,
  semCargoNaFase,
  simular,
  validarPlano,
} from "@/lib/dominio"

const mundo = construirMundo()
const cfg = criarConfig({ horizonte: 2 })

describe("simulação de contratação e déficit (E22)", () => {
  it("contratar põe a pessoa no time e o plano continua válido, com a regra do time", () => {
    const { mundo: m, cfg: c } = comContratacao(mundo, cfg, { papel: "Analista", timeId: 0, quantidade: 2 })
    expect(m.pessoas).toHaveLength(mundo.pessoas.length + 2)
    expect(m.times[0].membros).toContain(mundo.pessoas.length)
    expect(m.pessoas.at(-1)?.papel).toBe("Analista")
    // o mundo original não muda
    expect(mundo.pessoas).toHaveLength(20)
    const sim = simular(m, c)
    sim.semanas.forEach((w) =>
      expect(validarPlano(w.otm, w.demanda, m.pessoas, { ...c, semanaIdx: w.semana }, m, { conferirTime: true })).toEqual([])
    )
  })

  it("a curva vai de zero ao máximo, uma pessoa por ponto", () => {
    const curva = curvaContratacao(mundo, cfg, "Analista", 0, 3)
    expect(curva.map((p) => p.adicionais)).toEqual([0, 1, 2, 3])
    expect(curva.map((p) => p.pessoas)).toEqual([20, 21, 22, 23])
    curva.forEach((p) => {
      expect(p.obrigatoria).toBeGreaterThan(0)
      expect(p.obrigatoria).toBeLessThanOrEqual(100)
    })
  })

  it("dispensar o cargo na fase tira o cargo das cerimônias e não aumenta as horas dele", () => {
    const m = semCargoNaFase(mundo, cfg, { fase: "kickoff", papel: "Líder Técnico" })
    expect(m.playbook.kickoff.every((c) => !c.papeis.includes("Líder Técnico"))).toBe(true)
    const r = compararDispensa(mundo, cfg, { fase: "kickoff", papel: "Líder Técnico" })
    expect(r.horasCargo.depois).toBeLessThanOrEqual(r.horasCargo.antes + 1e-9)
  })

  it("a projeção soma os projetos previstos mês a mês", () => {
    const p = projecaoTrimestre(mundo, cfg, { novosPorMes: 2, fase: "kickoff", timeId: 1 })
    expect(p.map((x) => x.projetos)).toEqual([112, 114, 116, 118])
    expect(p[3].demanda).toBeGreaterThanOrEqual(p[0].demanda)
  })

  it("o ponto de entrada do worker despacha para a mesma função", () => {
    const direto = curvaContratacao(mundo, cfg, "Especialista", 2, 1)
    expect(executarHipotese(mundo, cfg, { tipo: "curva", papel: "Especialista", timeId: 2, maximo: 1 })).toEqual(direto)
  })
})
