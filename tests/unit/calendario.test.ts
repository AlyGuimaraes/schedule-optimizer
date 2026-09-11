import { describe, expect, it } from "vitest"

import {
  construirMundo,
  criarConfig,
  gerarDemanda,
  limiteCongelamento,
  ocorreNaSemana,
  posicaoNaSemana,
  posicaoNoHorizonte,
  proximaSegunda,
  semanaAbsoluta,
  simular,
  SLOTS_DIA,
  validarPlano,
  type Calendario,
  type Config,
  type Mundo,
} from "@/lib/dominio"

const INICIO = "2026-09-14"
const R = semanaAbsoluta(INICIO)

/** Séries como a migração 0008 grava: reproduzem o faseamento do protótipo no horizonte de 14/09. */
function seriesDaMigracao(mundo: Mundo): Record<string, number> {
  const s: Record<string, number> = {}
  mundo.projetos.forEach((pr) =>
    (mundo.playbook[pr.fase] ?? []).forEach((c) => {
      if (c.cada > 1) s[`${pr.id}|${c.tipo}`] = R - ((pr.id + 1) % c.cada)
    })
  )
  return s
}

const assinatura = (mundo: Mundo, w: number, cfg?: Partial<Config>) =>
  gerarDemanda(mundo, w, cfg).map((c) => `${c.projetoId}|${c.tipo}`)

describe("datas reais do horizonte", () => {
  it("próxima segunda e posição no horizonte, em São Paulo", () => {
    // sexta, 11/09/2026 às 13h em São Paulo (16h UTC)
    expect(proximaSegunda(Date.UTC(2026, 8, 11, 16))).toBe(INICIO)
    // segunda às 02h em São Paulo ainda é domingo à noite em UTC−3? não: 05h UTC já é segunda local
    expect(proximaSegunda(Date.UTC(2026, 8, 14, 5))).toBe("2026-09-21")
    expect(posicaoNoHorizonte(INICIO, "2026-10-12")).toEqual({ semana: 5, dia: 0 })
    expect(posicaoNoHorizonte(INICIO, "2026-09-19")).toBeNull()
    expect(posicaoNoHorizonte(INICIO, "2026-09-11")).toBeNull()
  })

  it("antecedência de 48h congela só o que está a menos de 48h", () => {
    // sexta 13h: segunda 08h está a 67h, nada congela
    expect(limiteCongelamento(INICIO, Date.UTC(2026, 8, 11, 16))).toBe(0)
    // domingo 10h local (13h UTC): congela a segunda inteira e a terça até 10h
    expect(limiteCongelamento(INICIO, Date.UTC(2026, 8, 13, 13))).toBe(posicaoNaSemana(1, 4))
  })
})

describe("cadência ancorada no início da série (defeito 8)", () => {
  const mundo = construirMundo()
  const inicioSerie = seriesDaMigracao(mundo)
  const cal = (semana0: number): Calendario => ({ inicio: INICIO, semana0, inicioSerie })

  it("no horizonte de 14/09 a demanda é idêntica à do protótipo", () => {
    for (let w = 1; w <= 4; w++) expect(assinatura(mundo, w, { calendario: cal(R) })).toEqual(assinatura(mundo, w))
  })

  it("uma semana depois, a semana 1 é a antiga semana 2: a cadência não recomeça", () => {
    expect(assinatura(mundo, 1, { calendario: cal(R + 1) })).toEqual(assinatura(mundo, 2, { calendario: cal(R) }))
    expect(assinatura(mundo, 3, { calendario: cal(R + 1) })).toEqual(assinatura(mundo, 4, { calendario: cal(R) }))
  })

  it("série sem início cadastrado começa na semana 1 do horizonte", () => {
    expect(ocorreNaSemana(0, "x", 2, 1, { calendario: { inicio: INICIO, semana0: R } })).toBe(true)
    expect(ocorreNaSemana(0, "x", 2, 2, { calendario: { inicio: INICIO, semana0: R } })).toBe(false)
    // série que começa no futuro não acontece antes
    expect(ocorreNaSemana(0, "x", 1, 1, { calendario: { inicio: INICIO, semana0: R, inicioSerie: { "0|x": R + 2 } } })).toBe(false)
  })
})

describe("ausências e feriados (E14)", () => {
  const mundo = construirMundo()
  const todos = (motivo: string) => Object.fromEntries(mundo.pessoas.map((_, p) => [p, { 0: motivo }]))

  it("feriado na segunda: ninguém é convocado e o plano segue válido", () => {
    const cfg = criarConfig({
      horizonte: 1,
      calendario: { inicio: INICIO, semana0: R, inicioSerie: seriesDaMigracao(mundo), indisponivel: { 1: todos("feriado") } },
    })
    const w = simular(mundo, cfg).semanas[0]
    expect(w.otm.alocadas.length).toBeGreaterThan(0)
    expect(w.otm.alocadas.every((ev) => ev.dia !== 0)).toBe(true)
    expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: 1 }, mundo)).toEqual([])
  })

  it("férias de uma pessoa tiram os dias dela e encolhem o teto da semana", () => {
    const pessoa = 5
    const cfg = criarConfig({
      horizonte: 1,
      calendario: { inicio: INICIO, semana0: R, indisponivel: { 1: { [pessoa]: { 0: "férias", 1: "férias", 2: "férias" } } } },
    })
    const w = simular(mundo, cfg).semanas[0]
    const dela = w.otm.alocadas.filter((ev) => ev.participantes.includes(pessoa))
    expect(dela.every((ev) => (ev.dia ?? 0) >= 3)).toBe(true)
    const horas = dela.reduce((s, ev) => s + ev.dur / 60, 0)
    expect(horas).toBeLessThanOrEqual(w.otm.PP[pessoa].tetoMax * (2 / 5) + 1e-9)
    expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: 1 }, mundo)).toEqual([])
  })
})

describe("estabilidade: antecedência de 48h e limite de 20% de movidas (E13)", () => {
  const mundo = construirMundo()
  const base = criarConfig({ horizonte: 1 })
  const vigente = (() => {
    const w = simular(mundo, base).semanas[0]
    const plano: Record<string, { dia: number; slot: number }> = {}
    w.otm.alocadas.forEach((ev) => (plano[`${ev.projetoId}|${ev.tipo}|1`] = { dia: ev.dia ?? 0, slot: ev.slot ?? 0 }))
    return plano
  })()

  it("na janela congelada nada é novo nem muda de lugar", () => {
    const congeladoAte = SLOTS_DIA * 2 // segunda e terça
    const cfg = criarConfig({
      horizonte: 1,
      perfil: "foco",
      planoVigente: vigente,
      pesoEstabilidade: 0,
      calendario: { inicio: INICIO, semana0: R, congeladoAte },
    })
    const w = simular(mundo, cfg).semanas[0]
    const naJanela = w.otm.alocadas.filter((ev) => posicaoNaSemana(ev.dia ?? 0, ev.slot ?? 0) < congeladoAte)
    expect(naJanela.length).toBeGreaterThan(0)
    naJanela.forEach((ev) => {
      const v = vigente[`${ev.projetoId}|${ev.tipo}|1`]
      expect(v).toEqual({ dia: ev.dia, slot: ev.slot })
    })
    expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: 1 }, mundo)).toEqual([])
  })

  it("replanejar respeita o limite de 20% de movidas ou registra a relaxação", () => {
    const cfg = criarConfig({ horizonte: 1, perfil: "foco", planoVigente: vigente, pesoEstabilidade: 0 })
    const e = simular(mundo, cfg).semanas[0].otm.estabilidade
    expect(e).toBeDefined()
    expect(e!.pct >= 80 || e!.relaxada === true).toBe(true)
    if (e!.pct >= 80) expect(e!.relaxada).toBeFalsy()
  })
})
