import { afterEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ clienteAdmin: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dados/admin", () => ({ clienteAdmin: m.clienteAdmin }))

import { custoDe, montarRegistro, registrarExecucao, type Execucao } from "@/lib/ia/registro"

// colunas de agente_execucoes em supabase/migrations/20260911000001_esquema.sql
const COLUNAS = [
  "agente",
  "cenario_id",
  "custo",
  "duracao_ms",
  "entrada",
  "modelo",
  "saida",
  "status",
  "tokens_entrada",
  "tokens_saida",
  "versao_prompt",
]

const execucao: Execucao = {
  agente: "narrador",
  entrada: { resumo: { cobertura: 91.2 } },
  saida: { resumo: "texto", alertas: [] },
  modelo: "claude-opus-5",
  uso: { entrada: 1000, saida: 500, cacheEscrita: 2000, cacheLeitura: 10000 },
  duracaoMs: 1834.6,
  versaoPrompt: "narrador/2026-09-11.1+narrador.v1",
  status: "ok",
}

describe("registro em agente_execucoes", () => {
  afterEach(() => {
    m.clienteAdmin.mockReset()
    vi.restoreAllMocks()
  })

  it("monta a linha com as colunas da tabela, tokens somados e custo por modelo", () => {
    const linha = montarRegistro(execucao)
    expect(Object.keys(linha).sort()).toEqual(COLUNAS)
    expect(linha).toMatchObject({
      agente: "narrador",
      modelo: "claude-opus-5",
      entrada: execucao.entrada,
      saida: { resultado: execucao.saida, cache: { escrita: 2000, leitura: 10000 } },
      tokens_entrada: 13000,
      tokens_saida: 500,
      duracao_ms: 1835,
      versao_prompt: "narrador/2026-09-11.1+narrador.v1",
      status: "ok",
      cenario_id: null,
    })
    // 1000 × 5 + 2000 × 6,25 + 10000 × 0,5 + 500 × 25 = 35.000 por milhão
    expect(linha.custo).toBe(0.035)
  })

  it("sem uso (erro antes da resposta) grava tokens e custo nulos", () => {
    const linha = montarRegistro({ ...execucao, uso: null, status: "erro" })
    expect(linha).toMatchObject({ tokens_entrada: null, tokens_saida: null, custo: null, status: "erro" })
    expect(custoDe("claude-opus-4-8", execucao.uso)).toBe(0.035)
  })

  it("grava em agente_execucoes pelo cliente do servidor", async () => {
    const inserir = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ insert: inserir }))
    m.clienteAdmin.mockReturnValue({ from })
    await registrarExecucao(execucao)
    expect(from).toHaveBeenCalledWith("agente_execucoes")
    expect(inserir).toHaveBeenCalledWith(montarRegistro(execucao))
  })

  it("falha do banco não derruba a chamada do agente", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
    m.clienteAdmin.mockImplementation(() => {
      throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
    })
    await expect(registrarExecucao(execucao)).resolves.toBeUndefined()
    m.clienteAdmin.mockReturnValue({
      from: () => ({ insert: () => Promise.resolve({ error: { message: "permission denied" } }) }),
    })
    await expect(registrarExecucao(execucao)).resolves.toBeUndefined()
    expect(aviso).toHaveBeenCalledTimes(2)
  })
})
