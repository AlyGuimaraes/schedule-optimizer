import { z } from "zod"

// Entradas dos agentes (§4.5). São validadas no servidor antes de qualquer chamada: server actions
// são alcançáveis por POST direto, então nada que vem do cliente é confiável. Os limites de tamanho
// seguram o custo de uma chamada abusiva. Este módulo não importa nada do servidor e pode ser usado
// pelo cliente só como tipo.

const texto = (max: number) => z.string().max(max)
const numero = z.number()

// ─────────────────────── resultado do otimizador ───────────────────────

export const IndicadoresSchema = z.object({
  produtivoMedio: numero,
  aderencia: numero,
  cobertura: numero,
  acimaTeto: numero,
  acimaLimite: numero,
  blocosFocoMedio: numero,
  fragMedia: numero,
  horasTotais: numero,
})

/** Resumo serializável de uma execução do otimizador (semana 1 do horizonte). */
export const ResumoExecucaoSchema = z.object({
  perfil: z.object({ id: texto(40), rotulo: texto(80), desc: texto(300) }),
  horizonte: numero,
  projetos: numero,
  pessoas: numero,
  demanda: numero,
  alocadas: numero,
  cobertura: z.object({
    total: numero,
    obrigatoria: numero,
    relaxadas: numero,
    sla: numero,
    slaTotal: numero,
  }),
  pessoasNoAlvo: numero,
  concessoes: z.object({
    total: numero,
    /** na ordem em que as premissas aparecem nas concessões, como na leitura do protótipo */
    porPremissa: z.array(z.object({ premissa: texto(120), qtd: numero })).max(40),
  }),
  adiadas: z.object({ total: numero, obrigatorias: numero, sla: numero }),
  trocas: numero,
  deficit: z.object({
    fte: numero,
    /** cargo que mais aparece nas cerimônias adiadas */
    gargalo: texto(120).nullable(),
    porCargo: z
      .array(
        z.object({
          cargo: texto(120),
          pessoas: numero,
          noAlvo: numero,
          concessoes: numero,
          fte: numero,
        })
      )
      .max(40),
  }),
  /** percentual de cerimônias que ficaram no lugar do plano vigente; null sem plano publicado */
  estabilidade: numero.nullable(),
  indicadores: z.object({ atual: IndicadoresSchema, otimizado: IndicadoresSchema }),
})

// ─────────────────────── contexto estável da operação ───────────────────────

const PremissaCargoSchema = z.object({
  cargo: texto(120),
  jornada: numero,
  fatorAusencia: numero,
  tempoInstitucional: numero,
  produtivoMin: numero,
  tolerancia: numero,
  maxReunioesDia: numero,
  maxHorasDia: numero,
  maxHorasSemana: numero,
  maxHorasMes: numero,
  blocoFocoMin: numero,
  focoProt: numero,
  duracaoMax: numero,
  teto: numero,
  tetoMax: numero,
})

/**
 * Premissas vigentes e playbook: a parte do prompt que muda pouco. Vai no prefixo em cache, por
 * isso é montada em arrays com ordem fixa (ver `contextoDaOperacao`).
 */
export const ContextoOperacaoSchema = z.object({
  premissasGerais: z.object({
    inicio: numero,
    fim: numero,
    almocoInicio: numero,
    almocoDur: numero,
    buffer: numero,
    preferidos: z.array(numero).max(40),
    pesoPreferencia: numero,
    diaProtegido: texto(20),
  }),
  premissasCargo: z.array(PremissaCargoSchema).max(40),
  etapas: z
    .array(z.object({ id: texto(60), rotulo: texto(120), urgencia: numero, prazoDias: numero }))
    .max(40),
  playbook: z
    .array(
      z.object({
        fase: texto(60),
        itens: z
          .array(
            z.object({
              tipo: texto(120),
              dur: numero,
              cada: numero,
              papeis: z.array(texto(120)).max(12),
              obrig: z.boolean(),
              prio: numero,
              origem: texto(120).optional(),
            })
          )
          .max(60),
      })
    )
    .max(40),
})

// ─────────────────────── entradas por agente ───────────────────────

export const EntradaNarradorSchema = z.object({
  resumo: ResumoExecucaoSchema,
  contexto: ContextoOperacaoSchema,
  cenarioId: z.uuid().nullable().optional(),
})

export const EntradaClassificadorSchema = z.object({
  projeto: z.object({
    nome: texto(200),
    faseAtual: texto(60),
    health: z.enum(["verde", "amarelo", "vermelho"]),
    prioridade: z.enum(["alta", "media", "baixa"]),
    mes: numero,
    atrasoDias: numero,
    produtos: z.object({ relatorios: numero, dashboards: numero, integracoes: numero }),
  }),
  fases: z.array(z.object({ id: texto(60), rotulo: texto(120) })).min(1).max(40),
  /** campos manuais e atas coladas até a integração da E23 */
  historico: z.object({
    entregas: z.array(texto(2000)).max(50),
    atas: z.array(texto(20000)).max(8),
    tarefasAbertas: z.array(texto(2000)).max(100),
  }),
})

export const EntradaOrquestradorSchema = z.object({
  comando: z.string().min(3).max(1000),
  contexto: ContextoOperacaoSchema,
  perfilAtual: texto(40),
  pesoEstabilidade: numero,
})

export type Indicadores = z.infer<typeof IndicadoresSchema>
export type ResumoExecucao = z.infer<typeof ResumoExecucaoSchema>
export type ContextoOperacao = z.infer<typeof ContextoOperacaoSchema>
export type EntradaNarrador = z.infer<typeof EntradaNarradorSchema>
export type EntradaClassificador = z.infer<typeof EntradaClassificadorSchema>
export type EntradaOrquestrador = z.infer<typeof EntradaOrquestradorSchema>
