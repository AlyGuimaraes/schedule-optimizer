import type { z } from "zod"

import { SaidaClassificadorV1, VERSAO_CONTRATO_CLASSIFICADOR } from "./classificador"
import { SaidaNarradorV1, VERSAO_CONTRATO_NARRADOR } from "./narrador"
import { PropostaOrquestradorV1, VERSAO_CONTRATO_ORQUESTRADOR } from "./orquestrador"

// Contratos versionados das saídas dos agentes. Mudou o formato, sobe a versão: a versão vai para
// `agente_execucoes.versao_prompt` junto com a do prompt, e as avaliações comparam por versão.
//
// Guardrail estrutural (§4.5): nenhum schema de saída tem campo de horário, dia ou slot. O teste
// tests/unit/ia/guardrail.test.ts percorre todas as chaves de todos os contratos daqui.

export type NomeAgente = "classificador" | "narrador" | "orquestrador"

export interface Contrato {
  versao: string
  schema: z.ZodType
}

export const CONTRATOS = {
  classificador: { versao: VERSAO_CONTRATO_CLASSIFICADOR, schema: SaidaClassificadorV1 },
  narrador: { versao: VERSAO_CONTRATO_NARRADOR, schema: SaidaNarradorV1 },
  orquestrador: { versao: VERSAO_CONTRATO_ORQUESTRADOR, schema: PropostaOrquestradorV1 },
} as const satisfies Record<NomeAgente, Contrato>

export * from "./classificador"
export * from "./narrador"
export * from "./orquestrador"
