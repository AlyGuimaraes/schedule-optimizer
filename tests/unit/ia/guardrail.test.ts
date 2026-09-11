import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { CAMPOS_ALTERAVEIS, CONTRATOS } from "@/lib/ia/contratos"

// A IA nunca decide horário (§4.5). Guardrail estrutural: nenhuma chave de nenhum schema de saída
// pode nomear hora, horário, slot, dia, início ou fim, em qualquer profundidade.
const CAMPO_DE_HORARIO = /hor(a|ario|ário)|slot|^dia$|inicio|início|^fim$/i

type No = Record<string, unknown>

/** Caminhos de todas as chaves de propriedade de um JSON Schema, em qualquer profundidade. */
function chavesDe(schema: unknown, caminho = "$"): string[] {
  if (Array.isArray(schema)) return schema.flatMap((s, i) => chavesDe(s, `${caminho}[${i}]`))
  if (!schema || typeof schema !== "object") return []
  const no = schema as No
  const chaves: string[] = []
  if (no.properties && typeof no.properties === "object") {
    for (const [k, v] of Object.entries(no.properties as No)) {
      chaves.push(`${caminho}.${k}`, ...chavesDe(v, `${caminho}.${k}`))
    }
  }
  for (const campo of ["items", "prefixItems", "anyOf", "oneOf", "allOf", "additionalProperties", "not"]) {
    if (campo in no) chaves.push(...chavesDe(no[campo], caminho))
  }
  for (const defs of ["$defs", "definitions"]) {
    if (no[defs] && typeof no[defs] === "object")
      for (const [k, v] of Object.entries(no[defs] as No)) chaves.push(...chavesDe(v, `#${k}`))
  }
  return chaves
}

const nome = (caminho: string) => caminho.split(".").pop() ?? caminho
const proibidas = (jsonSchema: unknown) => chavesDe(jsonSchema).filter((c) => CAMPO_DE_HORARIO.test(nome(c)))

describe("guardrail estrutural: nenhum contrato de saída tem campo de horário (§4.5)", () => {
  it("o detector encontra campo de horário em objeto, lista, união e definição", () => {
    const ruim = z.object({
      ok: z.string(),
      diaProtegido: z.string(),
      itens: z.array(z.object({ horario: z.string() })),
      talvez: z.union([z.object({ slot: z.number() }), z.null()]),
      dia: z.number(),
      fim: z.string(),
      inicioPrevisto: z.string(),
      maxHoras: z.number(),
    })
    expect(proibidas(z.toJSONSchema(ruim)).map(nome).sort()).toEqual(
      ["dia", "fim", "horario", "inicioPrevisto", "maxHoras", "slot"].sort()
    )
  })

  for (const [agente, contrato] of Object.entries(CONTRATOS)) {
    it(`${agente} (${contrato.versao}): nenhuma chave de horário no Zod nem no JSON Schema enviado à API`, () => {
      const doZod = z.toJSONSchema(contrato.schema)
      const enviado = betaZodOutputFormat(contrato.schema).schema
      expect(chavesDe(doZod).length).toBeGreaterThan(0)
      expect(chavesDe(enviado).length).toBeGreaterThan(0)
      expect(proibidas(doZod)).toEqual([])
      expect(proibidas(enviado)).toEqual([])
    })
  }

  it("todo contrato é versionado", () => {
    for (const [agente, contrato] of Object.entries(CONTRATOS)) {
      expect(contrato.versao).toMatch(new RegExp(`^${agente}\\.v\\d+$`))
    }
  })

  it("o Orquestrador não altera as janelas de tempo da grade", () => {
    for (const campo of ["inicio", "fim", "almocoInicio", "almocoDur", "preferidos"]) {
      expect(CAMPOS_ALTERAVEIS as readonly string[]).not.toContain(campo)
    }
  })
})
