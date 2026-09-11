import { z } from "zod"

// Contrato do Orquestrador (§4.5): traduz um comando em linguagem natural numa proposta de
// alteração de premissas, perfil ou peso. É um rascunho: nunca é aplicado direto; passa pelo
// motor (ou solver) e por aprovação humana. O valor atual de cada campo não vem da IA, é lido da
// configuração vigente na montagem do diff (`montarDiff`).
//
// Os campos alteráveis deixam de fora, de propósito, os que definem janelas de tempo da grade
// (início e fim da jornada, almoço, faixa preferencial): a IA nunca decide horário.

export const VERSAO_CONTRATO_ORQUESTRADOR = "orquestrador.v1"

export const CAMPOS_CARGO = [
  "produtivoMin",
  "tolerancia",
  "maxReunioesDia",
  "maxHorasDia",
  "maxHorasSemana",
  "maxHorasMes",
  "blocoFocoMin",
  "focoProt",
  "duracaoMax",
] as const

export const CAMPOS_GERAIS = ["pesoPreferencia", "diaProtegido", "buffer"] as const

export const ESCOPOS = ["cargo", "geral", "perfil", "peso"] as const

export const CAMPOS_ALTERAVEIS = [...CAMPOS_CARGO, ...CAMPOS_GERAIS, "perfil", "pesoEstabilidade"] as const

export const PropostaOrquestradorV1 = z.object({
  interpretacao: z.string().describe("Uma frase dizendo como o comando foi entendido."),
  alteracoes: z
    .array(
      z.object({
        escopo: z.enum(ESCOPOS),
        cargo: z.string().nullable().describe("Nome exato do cargo quando o escopo é cargo; null nos demais."),
        campo: z.enum(CAMPOS_ALTERAVEIS),
        valor: z.union([z.number(), z.string()]).describe("Valor proposto, na unidade do campo."),
        motivo: z.string().describe("Por que esta alteração realiza o comando."),
      })
    )
    .describe("O menor conjunto de alterações que realiza o comando; vazio quando nada se aplica."),
  riscos: z.array(z.string()).describe("O que a alteração pode custar: cobertura, déficit, concessões."),
  foraDoEscopo: z
    .string()
    .nullable()
    .describe("Quando o comando pede algo que a configuração não expressa, como marcar uma cerimônia num horário, explique aqui."),
})

export type PropostaOrquestrador = z.infer<typeof PropostaOrquestradorV1>
export type EscopoAlteracao = (typeof ESCOPOS)[number]
export type CampoAlteravel = (typeof CAMPOS_ALTERAVEIS)[number]

/** Uma linha do diff proposto: o gestor vê o atual contra o proposto e aprova ou não. */
export interface ItemDiff {
  escopo: EscopoAlteracao
  cargo: string | null
  campo: CampoAlteravel
  atual: number | string | null
  proposto: number | string
  motivo: string
}

export interface PropostaOrquestrada {
  interpretacao: string
  itens: ItemDiff[]
  /** alterações que a IA propôs mas não passaram na validação, com o motivo */
  descartadas: { campo: string; cargo: string | null; razao: string }[]
  riscos: string[]
  foraDoEscopo: string | null
  /** sempre false: a proposta é rascunho até a aprovação humana */
  aplicada: false
  modelo: string
}
