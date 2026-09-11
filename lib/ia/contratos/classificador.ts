import { z } from "zod"

// Contrato do Classificador (§4.5): fase e health reais do projeto, com justificativa e
// confiança. A fase é um id de etapa; como as etapas são cadastráveis, o id é conferido contra a
// lista enviada na entrada depois da resposta, e a confiança é limitada a [0, 1] no código (as
// saídas estruturadas não garantem mínimo e máximo numéricos).

export const VERSAO_CONTRATO_CLASSIFICADOR = "classificador.v1"

export const SaidaClassificadorV1 = z.object({
  fase: z.string().describe("Id da fase, exatamente um dos ids da lista de fases fornecida."),
  health: z.enum(["verde", "amarelo", "vermelho"]),
  justificativa: z
    .string()
    .describe("Até três frases, citando as evidências do histórico que sustentam fase e health."),
  confianca: z
    .number()
    .describe("Entre 0 e 1. Baixa quando o histórico é escasso ou contraditório."),
})

export type SaidaClassificador = z.infer<typeof SaidaClassificadorV1>
