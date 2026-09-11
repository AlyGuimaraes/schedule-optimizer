import { z } from "zod"

// Contrato do Narrador (§4.5): explica o plano e os trade-offs. Não tem campo de horário; o
// Narrador descreve o que o solver fez, nunca decide onde uma cerimônia cai.

export const VERSAO_CONTRATO_NARRADOR = "narrador.v1"

export const GRAVIDADES = ["info", "atencao", "critico"] as const

export const SaidaNarradorV1 = z.object({
  resumo: z
    .string()
    .describe("Resumo executivo em um parágrafo, em português do Brasil, com no máximo 120 palavras."),
  alertas: z
    .array(
      z.object({
        gravidade: z
          .enum(GRAVIDADES)
          .describe("critico: SLA violado ou obrigatória adiada; atencao: déficit, concessões ou estabilidade; info: o resto."),
        titulo: z.string().describe("Frase curta, até 8 palavras, sem ponto final."),
        detalhe: z.string().describe("Uma ou duas frases com o número que motiva o alerta e a decisão que ele pede."),
      })
    )
    .describe("De zero a quatro alertas, só o que pede decisão do gestor."),
})

export type SaidaNarrador = z.infer<typeof SaidaNarradorV1>
export type AlertaNarrador = SaidaNarrador["alertas"][number]

/** O que a tela recebe: o texto da IA ou, sem ela, a leitura determinística. */
export interface Narracao extends SaidaNarrador {
  origem: "ia" | "deterministica"
  /** modelo que respondeu (pode ser o de fallback); null na leitura determinística */
  modelo: string | null
}
