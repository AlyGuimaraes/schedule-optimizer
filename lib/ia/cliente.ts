import "server-only"

import Anthropic, {
  AnthropicError,
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import type { z } from "zod"

import type { Json } from "@/lib/dados/tipos-banco"

import type { NomeAgente } from "./contratos"
import { registrarExecucao, type StatusExecucao, type Uso } from "./registro"

// Cliente da camada de IA (E18). Só no servidor. Sem ANTHROPIC_API_KEY, `iaDisponivel()` é falso,
// nenhum cliente é criado e nenhuma requisição sai: cada agente devolve a sua reserva
// determinística (ou null). A chave entra como variável sensível na Vercel; nunca no código.

export const MODELO = "claude-opus-5"

/**
 * Fallback do lado do servidor: se o classificador de segurança do modelo recusar, a API refaz a
 * mesma requisição no modelo recomendado para a categoria da recusa. Modo "default" com o header
 * de 2026-07-01 (o modo por lista usa outro header).
 */
export const BETA_FALLBACK = "server-side-fallback-2026-07-01"

export type Esforco = "low" | "medium" | "high" | "xhigh" | "max"

/** Profundidade por agente: baixo para classificação em lote, mais alto para narrativa e orquestração. */
export const ESFORCO: Record<NomeAgente, Esforco> = {
  classificador: "low",
  narrador: "medium",
  orquestrador: "high",
}

export function iaDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

let instancia: Anthropic | null = null

/** Cliente criado na primeira chamada com chave. Retries e timeout do SDK (429, 5xx e rede). */
function cliente(): Anthropic | null {
  if (!iaDisponivel()) return null
  instancia ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3, timeout: 120_000 })
  return instancia
}

export interface PedidoAgente<S extends z.ZodType> {
  agente: NomeAgente
  /** versão do prompt e do contrato, gravada no registro */
  versaoPrompt: string
  schema: S
  /** prefixo estável, com os breakpoints de cache (ver prefixo.ts) */
  sistema: Anthropic.Beta.BetaTextBlockParam[]
  /** conteúdo que muda a cada chamada, depois do último breakpoint */
  mensagem: string
  /** teto de pensamento mais resposta */
  maxTokens: number
  /** o que vai para `agente_execucoes.entrada` */
  entrada: Json
  cenarioId?: string | null
}

export type MotivoFalha = "indisponivel" | "recusa" | "truncada" | "invalida" | "erro"

export type RespostaAgente<T> =
  | { ok: true; dados: T; modelo: string; uso: Uso }
  | { ok: false; motivo: MotivoFalha; detalhe?: string }

/**
 * Uma chamada estruturada a um agente. Usa `create` com o formato Zod do SDK e faz o parse só
 * depois de conferir `stop_reason`: numa recusa o conteúdo pode vir vazio ou parcial e não deve
 * ser lido (o `parse` do SDK tentaria interpretar todo bloco de texto antes dessa checagem).
 * Qualquer falha vira `ok: false` e o agente cai na reserva; toda chamada feita é registrada.
 */
export async function chamarAgente<S extends z.ZodType>(p: PedidoAgente<S>): Promise<RespostaAgente<z.infer<S>>> {
  const c = cliente()
  if (!c) return { ok: false, motivo: "indisponivel" }

  const inicio = Date.now()
  const base = { agente: p.agente, entrada: p.entrada, versaoPrompt: p.versaoPrompt, cenarioId: p.cenarioId ?? null }
  const registrar = (status: StatusExecucao, modelo: string, uso: Uso | null, saida: Json) =>
    registrarExecucao({ ...base, status, modelo, uso, saida, duracaoMs: Date.now() - inicio })

  const formato = betaZodOutputFormat(p.schema)
  let resposta: Anthropic.Beta.BetaMessage
  try {
    resposta = await c.beta.messages.create({
      model: MODELO,
      max_tokens: p.maxTokens,
      betas: [BETA_FALLBACK],
      fallbacks: "default",
      // pensamento adaptativo, que já é o padrão do Opus 5; explícito para não depender disso
      thinking: { type: "adaptive" },
      output_config: { effort: ESFORCO[p.agente], format: formato },
      system: p.sistema,
      messages: [{ role: "user", content: p.mensagem }],
    })
  } catch (e) {
    const erro = classificarErro(e)
    console.error(`[cadência] agente ${p.agente} falhou (${erro.tipo}): ${erro.mensagem}`)
    await registrar("erro", MODELO, null, { erro })
    return { ok: false, motivo: "erro", detalhe: erro.tipo }
  }

  const uso = usoDe(resposta.usage)

  // 1. recusa: HTTP 200 com stop_reason "refusal" (depois de o fallback também recusar)
  if (resposta.stop_reason === "refusal") {
    const detalhes = resposta.stop_details
    await registrar("recusa", resposta.model, uso, {
      stop_reason: "refusal",
      categoria: detalhes?.category ?? null,
      explicacao: detalhes?.explanation ?? null,
    })
    return { ok: false, motivo: "recusa", detalhe: detalhes?.category ?? undefined }
  }

  // 2. cortada no teto de tokens: o JSON está incompleto
  if (resposta.stop_reason === "max_tokens") {
    await registrar("truncada", resposta.model, uso, { stop_reason: "max_tokens" })
    return { ok: false, motivo: "truncada" }
  }

  // 3. só agora lê o conteúdo: o último bloco de texto é a saída estruturada
  const texto = [...resposta.content].reverse().find((b) => b.type === "text")
  let dados: z.infer<S>
  try {
    if (!texto || texto.type !== "text") throw new Error("resposta sem bloco de texto")
    dados = formato.parse(texto.text)
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    await registrar("invalida", resposta.model, uso, { stop_reason: resposta.stop_reason, erro: mensagem })
    return { ok: false, motivo: "invalida", detalhe: mensagem }
  }

  await registrar("ok", resposta.model, uso, dados as Json)
  return { ok: true, dados, modelo: resposta.model, uso }
}

function usoDe(u: Anthropic.Beta.BetaUsage): Uso {
  return {
    entrada: u.input_tokens,
    saida: u.output_tokens,
    cacheEscrita: u.cache_creation_input_tokens ?? 0,
    cacheLeitura: u.cache_read_input_tokens ?? 0,
  }
}

export type TipoErro =
  | "autenticacao"
  | "permissao"
  | "nao_encontrado"
  | "requisicao"
  | "limite"
  | "servidor"
  | "conexao"
  | "api"
  | "desconhecido"

/**
 * Erros tipados do SDK, do mais específico ao mais geral. Os retentáveis (429, 5xx e rede) já
 * passaram pelos retries do SDK quando chegam aqui. `APIConnectionError` é subclasse de
 * `APIError` no SDK TypeScript, por isso vem antes.
 */
export function classificarErro(e: unknown): { tipo: TipoErro; mensagem: string; status: number | null } {
  const mensagem = e instanceof Error ? e.message : String(e)
  const status = e instanceof APIError ? (e.status ?? null) : null
  const tipo: TipoErro =
    e instanceof AuthenticationError
      ? "autenticacao"
      : e instanceof PermissionDeniedError
        ? "permissao"
        : e instanceof NotFoundError
          ? "nao_encontrado"
          : e instanceof BadRequestError
            ? "requisicao"
            : e instanceof RateLimitError
              ? "limite"
              : e instanceof InternalServerError
                ? "servidor"
                : e instanceof APIConnectionError
                  ? "conexao"
                  : e instanceof APIError || e instanceof AnthropicError
                    ? "api"
                    : "desconhecido"
  return { tipo, mensagem, status }
}
