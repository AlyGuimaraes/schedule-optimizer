import { describe, expect, it } from "vitest"

import {
  almoco,
  BLOQUEADO,
  construirMundo,
  criarConfig,
  custoDia,
  geralDe,
  premDe,
  semanaAbsoluta,
  simular,
  validarPlano,
  type Bloqueio,
  type Config,
} from "@/lib/dominio"

import { resumo } from "../paridade/resumo"

// Agenda importada no motor (E09): compromisso de fora bloqueia a pessoa, com o intervalo
// obrigatório, e o tempo bloqueado não conta como foco. Sem bloqueios, nada muda.

const INICIO = "2026-09-14"
const R = semanaAbsoluta(INICIO)
const mundo = construirMundo()

type Bloqueios = Record<number, Record<number, Bloqueio[]>>
const comBloqueios = (bloqueios?: Bloqueios, parcial: Partial<Config> = {}) =>
  criarConfig({ horizonte: 2, ...parcial, calendario: { inicio: INICIO, semana0: R, ...(bloqueios ? { bloqueios } : {}) } })

const base = simular(mundo, comBloqueios())

/** Quem mais participa de cerimônias na semana 1. */
const alvo = (() => {
  const conta = new Map<number, number>()
  base.semanas[0].otm.alocadas.forEach((ev) => ev.participantes.forEach((p) => conta.set(p, (conta.get(p) ?? 0) + 1)))
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
})()

const sobrepoe = (s: number, n: number, b: Bloqueio) => s < b.fim && s + n > b.inicio

describe("agenda importada no motor (E09)", () => {
  it("sem bloqueios na semana, o plano é idêntico", () => {
    expect(resumo(simular(mundo, comBloqueios({})))).toEqual(resumo(base))
    // bloqueio só na semana 5 não mexe nas semanas 1 e 2
    const s5 = comBloqueios({ 5: { [alvo]: [{ dia: 0, inicio: 0, fim: 20, motivo: "compromisso da agenda" }] } })
    expect(resumo(simular(mundo, s5))).toEqual(resumo(base))
  })

  it("ninguém é convocado por cima nem colado num compromisso importado", () => {
    const manhas: Bloqueio[] = [0, 1, 2, 3, 4].map((dia) => ({ dia, inicio: 0, fim: 8, motivo: "compromisso da agenda" }))
    const tarde: Bloqueio = { dia: 1, inicio: 12, fim: 14, motivo: "compromisso institucional" }
    const bloqueios: Bloqueios = { 1: { [alvo]: [...manhas, tarde] }, 2: { [alvo]: manhas } }
    const cfg = comBloqueios(bloqueios)
    const G = geralDe(cfg)
    const sim = simular(mundo, cfg)
    // não passa por vacuidade: a pessoa segue convocada na semana 1, à tarde. Na semana 2 o
    // orçamento mensal pró-rata dela já pode ter acabado, com ou sem bloqueio.
    expect(sim.semanas[0].otm.alocadas.filter((ev) => ev.participantes.includes(alvo)).length).toBeGreaterThan(0)
    sim.semanas.forEach((w) => {
      const dele = w.otm.alocadas.filter((ev) => ev.participantes.includes(alvo))
      dele.forEach((ev) =>
        bloqueios[w.semana][alvo]
          .filter((b) => b.dia === ev.dia)
          .forEach((b) => expect(sobrepoe((ev.slot ?? 0) - G.buffer, ev.slots + 2 * G.buffer, b)).toBe(false))
      )
      expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo)).toEqual([])
    })
    expect(resumo(sim)).not.toEqual(resumo(base))
  })

  it("o tempo bloqueado não conta como foco nem como hora de cerimônia", () => {
    const cfg = comBloqueios({ 1: { [alvo]: [{ dia: 2, inicio: 10, fim: 20, motivo: "compromisso da agenda" }] } })
    const w = simular(mundo, cfg).semanas[0]
    expect(w.otm.oc[alvo][2].slice(10, 20).every((x) => x === BLOQUEADO)).toBe(true)
    const blocoMin = premDe(cfg, mundo.pessoas[alvo].papel).blocoFocoMin
    // só a manhã pode estar livre: 8 slots antes do almoço
    expect(custoDia(w.otm.oc, alvo, 2, blocoMin, geralDe(cfg)).livres).toBeLessThanOrEqual(8)
    const horas = w.otm.alocadas.filter((ev) => ev.participantes.includes(alvo)).reduce((s, ev) => s + ev.dur / 60, 0)
    expect(w.otm.kpi.porPessoa[alvo].horas).toBeCloseTo(horas, 6)
  })

  it("o validador acusa cerimônia sobre compromisso importado e sem o intervalo", () => {
    const w = base.semanas[0]
    const G = geralDe(comBloqueios())
    const ev = w.otm.alocadas.find((e) => (e.slot ?? 0) - 1 >= G.inicio && !almoco(G, (e.slot ?? 0) - 1))!
    const p = ev.participantes[0]
    const dia = ev.dia as number
    const slot = ev.slot as number

    const sobre = comBloqueios({ 1: { [p]: [{ dia, inicio: slot, fim: slot + 1, motivo: "compromisso da agenda" }] } })
    const v1 = validarPlano(w.otm, w.demanda, mundo.pessoas, { ...sobre, semanaIdx: 1 }, mundo)
    expect(v1).toContainEqual(
      expect.objectContaining({ regra: "§8", pessoa: mundo.pessoas[p].nome, cerimonia: ev.tipo })
    )

    const colado = comBloqueios({ 1: { [p]: [{ dia, inicio: slot - 1, fim: slot, motivo: "compromisso da agenda" }] } })
    const v2 = validarPlano(w.otm, w.demanda, mundo.pessoas, { ...colado, semanaIdx: 1 }, mundo)
    expect(v2.map((x) => x.regra)).toContain("R5")
    expect(v2.some((x) => x.regra === "§8")).toBe(false)
  })
})
