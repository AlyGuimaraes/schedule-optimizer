import { describe, expect, it } from "vitest"

import {
  analiseCapacidade,
  construirMundo,
  criarConfig,
  gerarDemanda,
  montarSquad,
  simular,
  validarPlano,
  type Config,
  type PerfilId,
  type Simulacao,
} from "@/lib/dominio"

import { carregarMotor } from "./prototipo"
import { resumo } from "./resumo"

interface Ajuste {
  perfil?: PerfilId
  horizonte?: number
  rebalancear?: boolean
  /** aperta o alvo de todos os cargos em N pontos percentuais (§4.4) */
  alvoMais?: number
  /** recorrência da Reunião de Trabalho de Construção */
  cadenciaConstrucao?: number
}

function aplicarAlvo(cfg: Config, alvoMais?: number) {
  if (!alvoMais) return
  Object.values(cfg.papeis).forEach((p) => {
    p.produtivoMin += alvoMais
  })
}

function rodarPorte(a: Ajuste = {}): Simulacao {
  const mundo = construirMundo()
  const cfg = criarConfig({
    perfil: a.perfil ?? "equilibrio",
    horizonte: a.horizonte ?? 4,
    rebalancear: a.rebalancear ?? true,
  })
  aplicarAlvo(cfg, a.alvoMais)
  if (a.cadenciaConstrucao) mundo.playbook.construcao[0].cada = a.cadenciaConstrucao
  return simular(mundo, cfg)
}

function rodarPrototipo(a: Ajuste = {}): Simulacao {
  const API = carregarMotor()
  if (a.cadenciaConstrucao) API.PLAYBOOK.construcao[0].cada = a.cadenciaConstrucao
  const mundo = API.construirMundo()
  const cfg = API.criarCfg({
    perfil: a.perfil ?? "equilibrio",
    horizonte: a.horizonte ?? 4,
    rebalancear: a.rebalancear ?? true,
  })
  aplicarAlvo(cfg, a.alvoMais)
  cfg.mundo = mundo
  return API.simular(mundo, cfg)
}

const cenarios: [string, Ajuste][] = [
  ["padrão, equilíbrio e horizonte de 4 semanas", {}],
  ["perfil foco máximo", { perfil: "foco" }],
  ["perfil prioridade ao cliente", { perfil: "cliente" }],
  ["perfil estabilidade", { perfil: "estabilidade" }],
  ["horizonte de 2 semanas", { horizonte: 2 }],
  ["horizonte de 8 semanas", { horizonte: 8 }],
  ["alvos apertados em 7 p.p.", { alvoMais: 7 }],
  ["alvos apertados com foco máximo", { perfil: "foco", alvoMais: 7 }],
  ["sem rebalanceamento de cadeira", { rebalancear: false }],
  ["reunião de trabalho de construção quinzenal", { cadenciaConstrucao: 2 }],
]

describe("paridade com o motor do protótipo", () => {
  it.each(cenarios)("%s", (_nome, ajuste) => {
    expect(resumo(rodarPorte(ajuste))).toEqual(resumo(rodarPrototipo(ajuste)))
  })
})

describe("números de referência da semente 7", () => {
  const sim = rodarPorte()
  const w = sim.semanas[0]

  it("mundo com 112 projetos, 20 pessoas e 4 squads", () => {
    const mundo = construirMundo()
    expect(mundo.projetos.length).toBe(112)
    expect(mundo.pessoas.length).toBe(20)
    expect(mundo.times.map((t) => t.membros.length)).toEqual([9, 8, 8, 7])
    expect(mundo.times.map((t) => mundo.projetos.filter((p) => p.timeId === t.id).length)).toEqual([28, 28, 28, 28])
  })

  it("demanda de 58, 59, 58 e 58 cerimônias no horizonte", () => {
    expect(sim.semanas.map((s) => s.demanda.length)).toEqual([58, 59, 58, 58])
  })

  it("cenário otimizado da semana 1", () => {
    expect(w.otm.alocadas.length).toBe(56)
    expect(w.otm.adiadas.length).toBe(2)
    expect(w.otm.cobertura.total).toBe(96.6)
    expect(w.otm.cobertura.obrigatoria).toBe(98.1)
    expect(w.otm.cobertura.relaxadas).toBe(3)
    expect(w.otm.concessoes.length).toBe(3)
    expect(w.otm.trocas.length).toBe(5)
    expect(w.otm.kpi.aderencia).toBe(85)
    expect(w.otm.kpi.produtivoMedio).toBe(82.7)
    expect(w.otm.kpi.horasTotais).toBe(109)
    expect(w.otm.kpi.acimaTeto).toBe(3)
  })

  it("agenda vigente da semana 1", () => {
    expect(w.base.alocadas.length).toBe(58)
    expect(w.base.kpi.aderencia).toBe(70)
    expect(w.base.kpi.produtivoMedio).toBe(81.6)
    expect(w.base.kpi.horasTotais).toBe(116)
    expect(w.base.kpi.acimaTeto).toBe(6)
  })

  it("projeção mensal", () => {
    expect(sim.mes.otm.reunioes).toBe(238)
    expect(sim.mes.otm.horas).toBe(464.9)
    expect(sim.mes.base.reunioes).toBe(252)
    expect(sim.mes.base.horas).toBe(499.6)
  })

  it("déficit estrutural de 0,4 FTE", () => {
    const fte = Object.values(w.otm.deficit).reduce((s, x) => s + x.fteObrig, 0)
    expect(+fte.toFixed(2)).toBe(0.4)
  })

  it("recorrência quinzenal em Construção leva a demanda de 58 para 64", () => {
    const mundo = construirMundo()
    const cfg = criarConfig()
    expect(gerarDemanda(mundo, 1, cfg).length).toBe(58)
    mundo.playbook.construcao[0].cada = 2
    expect(gerarDemanda(mundo, 1, cfg).length).toBe(64)
  })

  it("quadro de pessoal com Analista Sênior no limite", () => {
    const linhas = analiseCapacidade(construirMundo(), criarConfig(), 4)
    const senior = linhas.find((l) => l.papel === "Analista Sênior")
    expect(senior?.situacao).toBe("no limite")
    expect(+(senior?.saldoFte ?? 0).toFixed(2)).toBe(0.03)
    expect(linhas[0].papel).toBe("Analista Sênior")
  })

  it("SLA de etapa fica em 88,9%, abaixo do critério 5 do MVP", () => {
    // Documentado como decisão D-07 no plano: o orçamento mensal pró-rata barra um kickoff.
    expect(w.otm.cobertura.sla).toBe(88.9)
    expect(w.otm.cobertura.slaViolado.map((x) => x.motivo)).toEqual(["excede o teto mensal do cargo"])
  })
})

describe("restrições rígidas do §4.1", () => {
  it("o plano otimizado não viola nenhuma restrição rígida", () => {
    const mundo = construirMundo()
    const cfg = criarConfig()
    const sim = simular(mundo, cfg)
    sim.semanas.forEach((w) => {
      const violacoes = validarPlano(
        w.otm,
        w.demanda,
        mundo.pessoas,
        { ...cfg, semanaIdx: w.semana },
        mundo
      )
      expect(violacoes).toEqual([])
    })
  })

  it("defeito 15: a semente monta squads com gente de fora do time", () => {
    // construirMundo sorteia as cadeiras por cargo sem filtrar pelo time, então a regra §2.0
    // só passa a valer depois que montarSquad roda. Corrigido no seed da E03.
    const mundo = construirMundo()
    const cfg = criarConfig()
    const sim = simular(mundo, cfg)
    const violacoes = validarPlano(
      sim.semanas[0].otm,
      sim.semanas[0].demanda,
      mundo.pessoas,
      { ...cfg, semanaIdx: 1 },
      mundo,
      { conferirTime: true }
    )
    expect(violacoes.every((v) => v.regra === "§2.0")).toBe(true)
    expect(violacoes.length).toBeGreaterThan(0)

    // depois de remontar os squads pelo time, a regra passa a valer
    mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
    const depois = simular(mundo, cfg)
    expect(
      validarPlano(
        depois.semanas[0].otm,
        depois.semanas[0].demanda,
        mundo.pessoas,
        { ...cfg, semanaIdx: 1 },
        mundo,
        { conferirTime: true }
      )
    ).toEqual([])
  })

  it("todos ficam com 3 ou mais blocos de foco por semana", () => {
    const sim = rodarPorte()
    sim.semanas.forEach((w) => {
      w.otm.kpi.porPessoa.forEach((p) => {
        expect(p.blocosFoco).toBeGreaterThanOrEqual(3)
      })
    })
  })

  it("resolve o horizonte de 8 semanas em menos de 1 segundo", () => {
    const t = performance.now()
    simular(construirMundo(), criarConfig({ horizonte: 8 }))
    expect(performance.now() - t).toBeLessThan(1000)
  })
})
