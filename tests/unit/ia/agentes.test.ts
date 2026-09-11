import { APIConnectionError, RateLimitError } from "@anthropic-ai/sdk"
import { afterEach, describe, expect, it, vi } from "vitest"

// Nenhum teste aqui sai para a rede: o SDK é trocado por um cliente falso e o banco por um
// registrador em memória.
const m = vi.hoisted(() => ({ create: vi.fn(), construtor: vi.fn(), inserir: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@anthropic-ai/sdk")>()
  class ClienteFalso {
    beta = { messages: { create: m.create } }
    constructor(opcoes: unknown) {
      m.construtor(opcoes)
    }
  }
  return { ...real, default: ClienteFalso }
})
vi.mock("@/lib/dados/admin", () => ({
  clienteAdmin: () => ({
    from: (tabela: string) => ({
      insert: (linha: unknown) => {
        m.inserir(tabela, linha)
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

import { construirMundo, criarConfig, montarSquad, simular } from "@/lib/dominio"
import { narrarResultado } from "@/lib/ia/acoes"
import { classificar } from "@/lib/ia/agentes/classificador"
import { narrar } from "@/lib/ia/agentes/narrador"
import { montarDiff, orquestrar } from "@/lib/ia/agentes/orquestrador"
import { classificarErro } from "@/lib/ia/cliente"
import type { EntradaClassificador, EntradaNarrador, EntradaOrquestrador } from "@/lib/ia/entradas"
import { leituraDeterministica, textoLeitura } from "@/lib/ia/leitura-deterministica"
import { contextoDaOperacao, resumirExecucao } from "@/lib/ia/resumo"

const CHAVE_FALSA = "chave-falsa-de-teste"

const mundo = construirMundo()
mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
const config = criarConfig({ horizonte: 1 })
const papeis = Object.keys(config.papeis)
const contexto = contextoDaOperacao({ mundo, config, papeis })
const entradaNarrador: EntradaNarrador = {
  resumo: resumirExecucao({ mundo, config, papeis, simulacao: simular(mundo, config) }),
  contexto,
}
const leitura = textoLeitura(leituraDeterministica(entradaNarrador.resumo)).trim()

const entradaClassificador: EntradaClassificador = {
  projeto: {
    nome: "Cliente Exemplo",
    faseAtual: "construcao",
    health: "verde",
    prioridade: "media",
    mes: 5,
    atrasoDias: 0,
    produtos: { relatorios: 3, dashboards: 2, integracoes: 1 },
  },
  fases: [
    { id: "construcao", rotulo: "Construção" },
    { id: "homologacao", rotulo: "Homologação" },
  ],
  historico: { entregas: ["Carga inicial concluída"], atas: [], tarefasAbertas: ["Validar regra de negócio"] },
}

const entradaOrquestrador: EntradaOrquestrador = {
  comando: "proteger as manhãs dos especialistas",
  contexto,
  perfilAtual: "equilibrio",
  pesoEstabilidade: 3,
}

/** Resposta da API no formato de BetaMessage. */
function resposta(saida: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: "msg_teste",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: "end_turn",
    stop_details: null,
    content: [{ type: "text", text: typeof saida === "string" ? saida : JSON.stringify(saida) }],
    usage: { input_tokens: 800, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 2400 },
    ...extra,
  }
}

const narracaoIa = {
  resumo: "O plano cobre quase toda a demanda — sobra déficit no Arquiteto de Dados.",
  alertas: [{ gravidade: "atencao", titulo: "Déficit no Arquiteto de Dados.", detalhe: "Faltam 0,6 FTE." }],
}

const ultimaLinha = () => m.inserir.mock.calls.at(-1)?.[1] as Record<string, unknown>

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  m.create.mockReset()
  m.construtor.mockClear()
  m.inserir.mockClear()
})

describe("sem ANTHROPIC_API_KEY: nada é chamado e tudo cai na reserva determinística", () => {
  it("o Narrador devolve a leitura determinística e a action devolve null", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    const n = await narrar(entradaNarrador)
    expect(n).toEqual({ origem: "deterministica", resumo: leitura, alertas: [], modelo: null })
    expect(await narrarResultado(entradaNarrador)).toBeNull()
    expect(await classificar(entradaClassificador)).toBeNull()
    expect(await orquestrar(entradaOrquestrador)).toBeNull()
    expect(m.construtor).not.toHaveBeenCalled()
    expect(m.create).not.toHaveBeenCalled()
    expect(m.inserir).not.toHaveBeenCalled()
  })
})

describe("com chave (cliente falso, sem rede)", () => {
  it("o Narrador chama o Opus 5 com pensamento adaptativo, esforço do agente, fallback e cache no prefixo", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    m.create.mockResolvedValue(resposta(narracaoIa))
    const n = await narrar(entradaNarrador)

    const params = m.create.mock.calls[0][0]
    expect(params).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema" } },
    })
    // prefixo estável no system, com breakpoint em cada bloco; o volátil vai na mensagem
    expect(params.system).toHaveLength(2)
    for (const bloco of params.system) expect(bloco.cache_control).toEqual({ type: "ephemeral" })
    expect(params.system[1].text).toContain("<premissas_por_cargo>")
    expect(params.system[0].text).not.toContain(String(entradaNarrador.resumo.demanda))
    expect(params.messages).toEqual([{ role: "user", content: expect.stringContaining("<resumo_da_execucao>") }])

    expect(n).toEqual({
      origem: "ia",
      modelo: "claude-opus-5",
      resumo: "O plano cobre quase toda a demanda, sobra déficit no Arquiteto de Dados.",
      alertas: [{ gravidade: "atencao", titulo: "Déficit no Arquiteto de Dados", detalhe: "Faltam 0,6 FTE." }],
    })

    expect(m.inserir).toHaveBeenCalledWith("agente_execucoes", expect.anything())
    expect(ultimaLinha()).toMatchObject({
      agente: "narrador",
      status: "ok",
      modelo: "claude-opus-5",
      tokens_entrada: 3200,
      tokens_saida: 300,
      // 800 × 5 + 2400 × 0,5 + 300 × 25 = 12.700 por milhão
      custo: 0.0127,
      versao_prompt: expect.stringMatching(/^narrador\/.+\+narrador\.v1$/),
    })
  })

  it("a action devolve o texto da IA para a tela trocar a leitura", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    m.create.mockResolvedValue(resposta(narracaoIa))
    expect(await narrarResultado(entradaNarrador)).toMatchObject({ origem: "ia" })
    // entrada fora do contrato não chega à API
    m.create.mockClear()
    expect(await narrarResultado({ ...entradaNarrador, resumo: { demanda: "x" } } as never)).toBeNull()
    expect(m.create).not.toHaveBeenCalled()
  })

  it("recusa: confere stop_reason antes do conteúdo, cai na reserva e registra a categoria", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    // conteúdo parcial e inválido: se fosse lido antes da checagem, o parse quebraria
    m.create.mockResolvedValue(
      resposta('{"resumo": "parc', {
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "cyber", explanation: "recusado" },
      })
    )
    const n = await narrar(entradaNarrador)
    expect(n.origem).toBe("deterministica")
    expect(n.resumo).toBe(leitura)
    expect(ultimaLinha()).toMatchObject({
      status: "recusa",
      saida: { resultado: { stop_reason: "refusal", categoria: "cyber" } },
    })
    expect(await narrarResultado(entradaNarrador)).toBeNull()
  })

  it("resposta cortada ou fora do contrato cai na reserva", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    m.create.mockResolvedValueOnce(resposta('{"resumo": "cort', { stop_reason: "max_tokens" }))
    expect((await narrar(entradaNarrador)).origem).toBe("deterministica")
    expect(ultimaLinha()).toMatchObject({ status: "truncada" })

    m.create.mockResolvedValueOnce(resposta({ texto: "sem o campo resumo" }))
    expect((await narrar(entradaNarrador)).origem).toBe("deterministica")
    expect(ultimaLinha()).toMatchObject({ status: "invalida" })
  })

  it("erro tipado do SDK cai na reserva e é registrado com o tipo", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    vi.spyOn(console, "error").mockImplementation(() => {})
    m.create.mockRejectedValue(new RateLimitError(429, undefined, "limite de taxa", new Headers()))
    expect((await narrar(entradaNarrador)).origem).toBe("deterministica")
    expect(ultimaLinha()).toMatchObject({
      status: "erro",
      tokens_entrada: null,
      custo: null,
      saida: { resultado: { erro: { tipo: "limite", status: 429 } } },
    })
    expect(classificarErro(new APIConnectionError({ message: "sem rede" })).tipo).toBe("conexao")
    expect(classificarErro(new Error("outro")).tipo).toBe("desconhecido")
  })

  it("Classificador: esforço baixo, fase conferida contra a lista e confiança limitada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    m.create.mockResolvedValueOnce(
      resposta({ fase: "homologacao", health: "amarelo", justificativa: "Testes com o cliente.", confianca: 1.7 })
    )
    expect(await classificar(entradaClassificador)).toMatchObject({ fase: "homologacao", health: "amarelo", confianca: 1 })
    expect(m.create.mock.calls[0][0].output_config.effort).toBe("low")

    m.create.mockResolvedValueOnce(resposta({ fase: "inventada", health: "verde", justificativa: "x", confianca: 0.5 }))
    expect(await classificar(entradaClassificador)).toBeNull()
  })

  it("Orquestrador: esforço alto e proposta sempre como rascunho não aplicado", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CHAVE_FALSA)
    m.create.mockResolvedValueOnce(
      resposta({
        interpretacao: "Aumentar a janela protegida dos especialistas.",
        alteracoes: [{ escopo: "cargo", cargo: "Especialista", campo: "focoProt", valor: 6, motivo: "Manhãs sem reunião." }],
        riscos: ["Pode aumentar o déficit de Especialista."],
        foraDoEscopo: null,
      })
    )
    const proposta = await orquestrar(entradaOrquestrador)
    expect(m.create.mock.calls[0][0].output_config.effort).toBe("high")
    expect(proposta).toMatchObject({
      aplicada: false,
      itens: [{ escopo: "cargo", cargo: "Especialista", campo: "focoProt", atual: 4, proposto: 6 }],
      descartadas: [],
    })
  })
})

describe("diff do Orquestrador contra a configuração vigente", () => {
  it("mantém o que é válido e descarta, com motivo, o que não é", () => {
    const { itens, descartadas } = montarDiff(
      {
        interpretacao: "",
        riscos: [],
        foraDoEscopo: null,
        alteracoes: [
          { escopo: "cargo", cargo: "Especialista", campo: "focoProt", valor: 6, motivo: "" },
          { escopo: "cargo", cargo: "Astronauta", campo: "focoProt", valor: 6, motivo: "" },
          { escopo: "cargo", cargo: "Analista", campo: "produtivoMin", valor: 82, motivo: "" },
          { escopo: "cargo", cargo: "Analista", campo: "tolerancia", valor: 140, motivo: "" },
          { escopo: "geral", cargo: null, campo: "diaProtegido", valor: "sexta-tarde", motivo: "" },
          { escopo: "geral", cargo: null, campo: "diaProtegido", valor: "domingo", motivo: "" },
          { escopo: "perfil", cargo: null, campo: "perfil", valor: "foco", motivo: "" },
          { escopo: "perfil", cargo: null, campo: "perfil", valor: "turbo", motivo: "" },
          { escopo: "peso", cargo: null, campo: "pesoEstabilidade", valor: 6, motivo: "" },
        ],
      },
      { contexto, perfilAtual: "equilibrio", pesoEstabilidade: 3 }
    )
    expect(itens.map((i) => [i.campo, i.atual, i.proposto])).toEqual([
      ["focoProt", 4, 6],
      ["diaProtegido", "nenhum", "sexta-tarde"],
      ["perfil", "equilibrio", "foco"],
      ["pesoEstabilidade", 3, 6],
    ])
    expect(descartadas.map((d) => d.razao)).toEqual([
      "cargo inexistente",
      "igual ao valor vigente",
      "percentual acima de 100",
      "dia protegido inválido",
      "perfil inválido",
    ])
  })
})
