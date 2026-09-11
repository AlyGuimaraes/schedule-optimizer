import "server-only"

import { clienteAdmin } from "@/lib/dados/admin"
import type { Database, Json } from "@/lib/dados/tipos-banco"

// Registro de toda chamada aos agentes em `agente_execucoes` (E18): entrada, saída, modelo,
// tokens, custo, duração e versão do prompt. Sem chave de API não há chamada, logo não há
// registro. O registro nunca derruba a resposta: se o banco falhar, avisa no log e segue.

export type StatusExecucao = "ok" | "recusa" | "truncada" | "invalida" | "erro"

/** Tokens de uma chamada. `entrada` é só a parte sem cache; o prompt inteiro é a soma dos três. */
export interface Uso {
  entrada: number
  saida: number
  cacheEscrita: number
  cacheLeitura: number
}

export interface Execucao {
  agente: string
  entrada: Json
  saida: Json
  modelo: string
  uso: Uso | null
  duracaoMs: number
  versaoPrompt: string
  status: StatusExecucao
  cenarioId?: string | null
}

export type LinhaExecucao = Database["public"]["Tables"]["agente_execucoes"]["Insert"]

/**
 * US$ por milhão de tokens (tabela de 2026-06). O fallback do servidor pode responder com outro
 * modelo; o Opus 4.8 tem o mesmo preço. Escrita de cache de 5 minutos custa 1,25 vez a entrada;
 * leitura de cache, 0,1 vez.
 */
const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5": { entrada: 5, saida: 25 },
  "claude-opus-4-8": { entrada: 5, saida: 25 },
}

export function custoDe(modelo: string, uso: Uso | null): number | null {
  if (!uso) return null
  const p = PRECOS[modelo] ?? PRECOS["claude-opus-5"]
  const dolares =
    (uso.entrada * p.entrada +
      uso.cacheEscrita * p.entrada * 1.25 +
      uso.cacheLeitura * p.entrada * 0.1 +
      uso.saida * p.saida) /
    1_000_000
  // a coluna é numeric(10, 4)
  return Math.round(dolares * 10_000) / 10_000
}

/** Linha da tabela, pura: o teste confere o formato sem banco. */
export function montarRegistro(e: Execucao): LinhaExecucao {
  return {
    agente: e.agente,
    entrada: e.entrada,
    saida: {
      resultado: e.saida,
      cache: e.uso ? { escrita: e.uso.cacheEscrita, leitura: e.uso.cacheLeitura } : null,
    },
    modelo: e.modelo,
    tokens_entrada: e.uso ? e.uso.entrada + e.uso.cacheEscrita + e.uso.cacheLeitura : null,
    tokens_saida: e.uso ? e.uso.saida : null,
    custo: custoDe(e.modelo, e.uso),
    duracao_ms: Math.round(e.duracaoMs),
    versao_prompt: e.versaoPrompt,
    status: e.status,
    cenario_id: e.cenarioId ?? null,
  }
}

export async function registrarExecucao(e: Execucao): Promise<void> {
  try {
    const { error } = await clienteAdmin().from("agente_execucoes").insert(montarRegistro(e))
    if (error) console.warn("[cadência] registro do agente falhou:", error.message)
  } catch (erro) {
    console.warn("[cadência] registro do agente falhou:", erro instanceof Error ? erro.message : String(erro))
  }
}
