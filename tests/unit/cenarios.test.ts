import { describe, expect, it } from "vitest"

import {
  chaveOcorrencia,
  chaveSerie,
  construirMundo,
  criarConfig,
  justificativa,
  montarSquad,
  simular,
  validarPlano,
  type Simulacao,
} from "@/lib/dominio"

/** A base do banco: semente 7 com os squads dentro do time. */
function base() {
  const mundo = construirMundo()
  mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
  return mundo
}

function planoDe(sim: Simulacao) {
  const plano: Record<string, { dia: number; slot: number }> = {}
  sim.semanas.forEach((w) =>
    w.otm.alocadas.forEach((ev) => {
      plano[chaveOcorrencia(ev, w.semana)] = { dia: ev.dia as number, slot: ev.slot as number }
    })
  )
  return plano
}

const movidas = (s: Simulacao) => s.semanas.reduce((a, w) => a + (w.otm.estabilidade?.movidas ?? 0), 0)

describe("estabilidade contra o plano vigente (E13, termo w6)", () => {
  it("replanejar sem mudança mantém 100% das cerimônias no lugar", () => {
    const mundo = base()
    const cfg = criarConfig()
    const sim = simular(mundo, { ...cfg, planoVigente: planoDe(simular(mundo, cfg)) })
    sim.semanas.forEach((w) => {
      expect(w.otm.estabilidade?.movidas).toBe(0)
      expect(w.otm.estabilidade?.pct).toBe(100)
    })
  })

  it("depois de mudar premissas, o peso de estabilidade segura o plano acima de 80%", () => {
    const mundo = base()
    const plano = planoDe(simular(mundo, criarConfig()))
    const mudada = criarConfig()
    mudada.geral = { ...mudada.geral, diaProtegido: "sexta-tarde", pesoPreferencia: 3 }
    const sem = simular(mundo, { ...mudada, planoVigente: plano, pesoEstabilidade: 0 })
    const com = simular(mundo, { ...mudada, planoVigente: plano, pesoEstabilidade: 6 })
    expect(movidas(com)).toBeLessThanOrEqual(movidas(sem))
    com.semanas.forEach((w) => expect(w.otm.estabilidade?.pct ?? 0).toBeGreaterThanOrEqual(80))
  })

  it("com peso zero o resultado é igual ao de sem plano vigente", () => {
    const mundo = base()
    const cfg = criarConfig()
    const livre = simular(mundo, cfg)
    const zero = simular(mundo, { ...cfg, planoVigente: planoDe(livre), pesoEstabilidade: 0 })
    expect(zero.semanas.map((w) => w.otm.alocadas.map((e) => `${e.id}|${e.dia}|${e.slot}`))).toEqual(
      livre.semanas.map((w) => w.otm.alocadas.map((e) => `${e.id}|${e.dia}|${e.slot}`))
    )
  })
})

describe("âncoras (§12, cliente impõe horário)", () => {
  it("a série ancorada cai no horário imposto em todas as semanas e sem violar restrição rígida", () => {
    const mundo = base()
    const cfg = criarConfig()
    const alvo = simular(mundo, cfg).semanas[0].otm.alocadas[0]
    const ancoras = { [chaveSerie(alvo)]: { dia: 3, slot: 14 } }
    const sim = simular(mundo, { ...cfg, ancoras })
    let vistas = 0
    sim.semanas.forEach((w) => {
      w.otm.alocadas
        .filter((e) => chaveSerie(e) === chaveSerie(alvo))
        .forEach((e) => {
          vistas++
          expect(e.dia).toBe(3)
          expect(e.slot).toBe(14)
          expect(e.ancorada).toBe(true)
        })
      expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo)).toEqual([])
    })
    expect(vistas).toBeGreaterThan(0)
  })
})

describe("rastro de cada alocação", () => {
  const mundo = base()
  const cfg = criarConfig()
  const w = simular(mundo, cfg).semanas[0]

  it("toda cerimônia alocada informa a camada que a alocou", () => {
    w.otm.alocadas.forEach((ev) => expect([1, 2, 3]).toContain(ev.camada))
    expect(w.otm.alocadas.filter((e) => e.camada === 3).every((e) => e.relaxado)).toBe(true)
    expect(w.otm.alocadas.filter((e) => e.camada === 2).length).toBe(w.otm.trocas.length)
  })

  it("toda concessão aponta para a cerimônia que a motivou", () => {
    const ids = new Set(w.otm.alocadas.filter((e) => e.relaxado).map((e) => e.id))
    w.otm.concessoes.forEach((c) => expect(ids.has(c.evId)).toBe(true))
  })

  it("a justificativa explica camada, participantes e concessões", () => {
    const cedida = w.otm.alocadas.find((e) => e.relaxado)
    const texto = justificativa(cedida ?? w.otm.alocadas[0], w.otm, mundo, cfg)
    expect(texto.length).toBeGreaterThan(0)
    if (cedida) expect(texto.join(" ")).toMatch(/camada 3/)
  })
})
