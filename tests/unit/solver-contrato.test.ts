import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  construirMundo,
  criarConfig,
  gerarDemanda,
  otimizar,
  validarPlano,
  type Config,
  type ResultadoOtimizacao,
} from "@/lib/dominio"
import type { RespostaSemana } from "@/lib/solver/contrato"
import { mapearResposta, montarRequisicao } from "@/lib/solver/mapeamento"

// O contrato do solver (E15) é o JSON Schema em solver/contrato; do lado Python o Pydantic é
// conferido contra ele em solver/tests/test_contrato.py. Aqui a conferência é do lado TypeScript.

interface No {
  $ref?: string
  anyOf?: No[]
  const?: unknown
  enum?: unknown[]
  type?: string | string[]
  minimum?: number
  exclusiveMinimum?: number
  minItems?: number
  items?: No
  required?: string[]
  properties?: Record<string, No>
  additionalProperties?: boolean
}

const esquema = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "solver/contrato/semana.schema.json"), "utf8")
) as { $defs: Record<string, No> }

/** Validador mínimo de JSON Schema: só o subconjunto que o contrato usa. */
function validar(valor: unknown, no: No, caminho = "$"): string[] {
  if (no.$ref) return validar(valor, esquema.$defs[no.$ref.replace("#/$defs/", "")], caminho)
  if (no.anyOf) return no.anyOf.some((n) => validar(valor, n).length === 0) ? [] : [`${caminho}: nenhuma alternativa`]
  const erros: string[] = []
  if ("const" in no && valor !== no.const) erros.push(`${caminho}: esperava ${String(no.const)}`)
  if (no.enum && !no.enum.includes(valor)) erros.push(`${caminho}: ${String(valor)} fora do enum`)
  if (no.type !== undefined) {
    const tipos = Array.isArray(no.type) ? no.type : [no.type]
    const tipo =
      valor === null ? "null" : Array.isArray(valor) ? "array" : Number.isInteger(valor) ? "integer" : typeof valor
    if (!tipos.some((t) => t === tipo || (t === "number" && tipo === "integer")))
      return [`${caminho}: esperava ${tipos.join("|")}, veio ${tipo}`]
  }
  if (typeof valor === "number") {
    if (no.minimum !== undefined && valor < no.minimum) erros.push(`${caminho}: abaixo de ${no.minimum}`)
    if (no.exclusiveMinimum !== undefined && valor <= no.exclusiveMinimum) erros.push(`${caminho}: não é maior que ${no.exclusiveMinimum}`)
  }
  if (Array.isArray(valor)) {
    if (no.minItems !== undefined && valor.length < no.minItems) erros.push(`${caminho}: menos de ${no.minItems} itens`)
    if (no.items) valor.forEach((v, i) => erros.push(...validar(v, no.items as No, `${caminho}[${i}]`)))
  } else if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>
    ;(no.required ?? []).forEach((k) => {
      if (obj[k] === undefined) erros.push(`${caminho}.${k}: obrigatório`)
    })
    Object.entries(obj).forEach(([k, v]) => {
      if (v === undefined) return
      const filho = no.properties?.[k]
      if (filho) erros.push(...validar(v, filho, `${caminho}.${k}`))
      else if (no.additionalProperties === false) erros.push(`${caminho}.${k}: fora do contrato`)
    })
  }
  return erros
}

const REQUISICAO: No = { $ref: "#/$defs/RequisicaoSemana" }
const RESPOSTA: No = { $ref: "#/$defs/RespostaSemana" }

function cenario(parcial: Partial<Config> = {}) {
  const mundo = construirMundo(7)
  const cfg: Config = {
    ...criarConfig(parcial),
    semanaIdx: 1,
    acumulado: new Array<number>(mundo.pessoas.length).fill(0),
  }
  const demanda = gerarDemanda(mundo, 1, cfg)
  const guloso = otimizar(
    demanda.map((ev) => ({ ...ev })),
    mundo.pessoas,
    cfg,
    mundo
  )
  return { mundo, cfg, demanda, guloso }
}

/** O plano guloso escrito como se tivesse vindo do solver. */
function respostaDoGuloso(r: ResultadoOtimizacao): RespostaSemana {
  return {
    versao: "1",
    status: "viavel",
    objetivo: null,
    limiteInferior: null,
    objetivoDica: null,
    ms: 0,
    alocadas: r.alocadas.map((ev) => ({
      cerimoniaId: ev.id,
      dia: ev.dia as number,
      slot: ev.slot as number,
      camada: ev.camada ?? 1,
      participantes: [...ev.participantes],
      trocas: (ev.trocas ?? []).map((t) => ({ ...t })),
      relaxada: !!ev.relaxado,
      ancorada: !!ev.ancorada,
    })),
    naoAlocadas: r.adiadas.map((ev) => ({ cerimoniaId: ev.id, motivo: ev.motivo ?? "" })),
    concessoes: r.concessoes.map((c) => ({
      cerimoniaId: c.evId,
      pessoaId: c.pessoaId,
      premissa: c.premissa,
      alvo: c.alvo,
      valor: c.valor,
      un: c.un,
    })),
    estatisticas: { variaveis: 0, restricoes: 0, workers: 0, conflitos: 0, ramos: 0, tempoSolver: 0 },
  }
}

describe("contrato do solver CP-SAT", () => {
  it("a requisição da semana 1 da semente segue o JSON Schema", () => {
    const { mundo, cfg, demanda, guloso } = cenario()
    const req = montarRequisicao(demanda, mundo.pessoas, cfg, mundo, {
      dica: guloso,
      opcoes: { limiteSegundos: 60, workers: 8 },
    })
    expect(validar(JSON.parse(JSON.stringify(req)), REQUISICAO)).toEqual([])
    expect(req.cerimonias).toHaveLength(demanda.length)
    expect(req.dica).toHaveLength(guloso.alocadas.length)
    // premissas resolvidas com a folga do perfil: o relaxado nunca é mais apertado que o alvo
    req.pessoas.forEach((p) => {
      expect(p.premissas.tetoRelaxado).toBeGreaterThanOrEqual(p.premissas.teto)
      expect(p.premissas.focoProtRelaxado).toBeLessThanOrEqual(p.premissas.focoProt)
    })
  })

  it("os candidatos de troca são do mesmo cargo, do time e de fora da cerimônia", () => {
    const { mundo, cfg, demanda } = cenario()
    const req = montarRequisicao(demanda, mundo.pessoas, cfg, mundo)
    req.cerimonias.forEach((c) => {
      const ev = demanda.find((d) => d.id === c.id)
      const time = mundo.times.find((t) => t.id === ev?.timeId)
      c.cadeiras.forEach((cad) =>
        cad.candidatos.forEach((q) => {
          expect(mundo.pessoas[q].papel).toBe(cad.papel)
          expect(c.cadeiras.map((x) => x.titular)).not.toContain(q)
          if (time) expect(time.membros).toContain(q)
        })
      )
    })
    const sem = montarRequisicao(demanda, mundo.pessoas, { ...cfg, rebalancear: false }, mundo)
    expect(sem.permitirTroca).toBe(false)
    expect(sem.cerimonias.every((c) => c.cadeiras.every((cad) => cad.candidatos.length === 0))).toBe(true)
  })

  it("a resposta volta ao domínio com a mesma cobertura, déficit e concessões do guloso", () => {
    const { mundo, cfg, demanda, guloso } = cenario()
    const resp = respostaDoGuloso(guloso)
    expect(validar(resp, RESPOSTA)).toEqual([])

    const r = mapearResposta(resp, demanda, mundo.pessoas, cfg)
    expect(validarPlano(r, demanda, mundo.pessoas, cfg, mundo)).toEqual([])
    const { slaViolado, ...cobertura } = r.cobertura
    const { slaViolado: slaGuloso, ...coberturaGuloso } = guloso.cobertura
    expect(cobertura).toEqual(coberturaGuloso)
    expect(slaViolado.map((e) => e.id).sort()).toEqual(slaGuloso.map((e) => e.id).sort())
    expect(r.deficit).toEqual(guloso.deficit)
    expect(r.carga).toEqual(guloso.carga)
    expect(r.trocas).toHaveLength(guloso.trocas.length)
    expect(r.concessoes).toEqual(guloso.concessoes)
    expect(r.oc).toEqual(guloso.oc)
    // a demanda original não é alterada pelo mapeamento
    expect(demanda.every((ev) => ev.dia === undefined)).toBe(true)
  })

  it("com plano vigente igual ao resultado, a estabilidade é de 100%", () => {
    const base = cenario()
    const planoVigente: Record<string, { dia: number; slot: number }> = {}
    base.guloso.alocadas.forEach((ev) => {
      planoVigente[`${ev.projetoId}|${ev.tipo}|1`] = { dia: ev.dia as number, slot: ev.slot as number }
    })
    const { mundo, cfg, demanda, guloso } = cenario({ planoVigente })
    const req = montarRequisicao(demanda, mundo.pessoas, cfg, mundo)
    expect(req.cerimonias.filter((c) => c.vigente).length).toBeGreaterThan(0)
    const r = mapearResposta(respostaDoGuloso(guloso), demanda, mundo.pessoas, cfg)
    expect(r.estabilidade?.pct).toBe(100)
  })

  it("resposta com cerimônia desconhecida é recusada", () => {
    const { mundo, cfg, demanda, guloso } = cenario()
    const resp = respostaDoGuloso(guloso)
    resp.alocadas[0] = { ...resp.alocadas[0], cerimoniaId: 9999 }
    expect(() => mapearResposta(resp, demanda, mundo.pessoas, cfg)).toThrow(/não está na demanda/)
  })
})
