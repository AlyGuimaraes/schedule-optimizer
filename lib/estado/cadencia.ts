"use client"

import { create } from "zustand"

import type { Config, Mundo, PerfilId, Simulacao } from "@/lib/dominio"
import type { DadosMundo, Indices } from "@/lib/dados/mapeador"

export type Cenario = "base" | "otm"
type Estado = { texto: string; vivo: boolean }
/** Cenário salvo aplicado ao alternador global (E13): as premissas dele sobre o mundo atual. */
export type CenarioAtivo = { id: string; nome: string; premissas: Record<string, unknown> }

const CHAVES_SNAPSHOT = ["perfil", "horizonte", "rebalancear", "papeis", "geral", "etapas", "clientes"] as const

function comSnapshot(base: Config, premissas: Record<string, unknown>): Config {
  const c = { ...base } as unknown as Record<string, unknown>
  for (const k of CHAVES_SNAPSHOT) if (premissas[k] !== undefined && premissas[k] !== null) c[k] = premissas[k]
  return c as unknown as Config
}

interface CadenciaState {
  mundo: Mundo | null
  config: Config | null
  indices: Indices | null
  simulacao: Simulacao | null
  ms: number | null
  erro: string | null
  cenario: Cenario
  /** linha de estado do cabeçalho, em mono 10.5px, como no protótipo */
  estado: Estado
  /** true enquanto o botão Otimizar roda; o terminal mostra esqueleto */
  otimizando: boolean
  /** muda a cada execução do Otimizar, para o terminal repetir a animação */
  execucao: number
  dadosAtuais: DadosMundo | null
  cenarioAtivo: CenarioAtivo | null

  setCenario: (cenario: Cenario) => void
  /** troca as premissas do alternador pelas de um cenário salvo; null volta às atuais */
  aplicarCenario: (c: CenarioAtivo | null) => void
  avisar: (texto: string, duracao?: number) => void
  inicializar: (dados: DadosMundo | null, erro: string | null) => void
  recalcular: (motivo?: string) => Promise<void>
  otimizar: () => Promise<void>
  setHorizonte: (h: number) => void
  setPerfil: (p: PerfilId) => void
  setRebalancear: (v: boolean) => void
  /** edição otimista da configuração; `adiado` segura o recálculo por 300ms, como nas células */
  editarConfig: (fn: (c: Config) => Config, opcoes?: { adiado?: boolean; motivo?: string }) => void
  /** edição otimista do mundo (playbook, etapas), recalculando em seguida */
  editarMundo: (fn: (m: Mundo) => Mundo, motivo?: string) => void
}

type Resposta = { id: number; simulacao?: Simulacao; ms?: number; erro?: string }

let worker: Worker | null = null
let proximoId = 0
const pendentes = new Map<number, (r: Resposta) => void>()
let timerEstado: ReturnType<typeof setTimeout> | undefined
let timerRecalculo: ReturnType<typeof setTimeout> | undefined

function obterWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/motor.worker.ts", import.meta.url))
    worker.onmessage = (e: MessageEvent<Resposta>) => {
      const resolver = pendentes.get(e.data.id)
      pendentes.delete(e.data.id)
      resolver?.(e.data)
    }
  }
  return worker
}

function executar(mundo: Mundo, config: Config): Promise<Resposta> {
  const id = ++proximoId
  return new Promise((resolve) => {
    pendentes.set(id, resolve)
    obterWorker().postMessage({ id, mundo, config })
  })
}

const ocioso = (ms: number | null): Estado => ({
  texto: ms === null ? "carregando o mundo" : `solver ${ms} ms`,
  vivo: false,
})

export const useCadencia = create<CadenciaState>((set, get) => ({
  mundo: null,
  config: null,
  indices: null,
  simulacao: null,
  ms: null,
  erro: null,
  cenario: "otm",
  estado: ocioso(null),
  otimizando: false,
  execucao: 0,
  dadosAtuais: null,
  cenarioAtivo: null,

  setCenario: (cenario) => set({ cenario }),

  aplicarCenario: (c) => {
    const dados = get().dadosAtuais
    if (!dados) return
    set({ cenarioAtivo: c, config: c ? comSnapshot(dados.config, c.premissas) : dados.config, cenario: "otm" })
    void get().recalcular(c ? `cenário "${c.nome}" aplicado` : "de volta às premissas atuais")
  },

  avisar: (texto, duracao = 2200) => {
    set({ estado: { texto, vivo: true } })
    clearTimeout(timerEstado)
    timerEstado = setTimeout(() => set({ estado: ocioso(get().ms) }), duracao)
  },

  // Recebe o mundo do servidor. Depois de cada gravação o layout recarrega e entrega um novo
  // objeto; o cenário (horizonte, perfil, rebalanceamento) é escolha da sessão e é preservado.
  inicializar: (dados, erro) => {
    if (!dados) {
      set({ erro, estado: { texto: "sem conexão com o banco", vivo: true } })
      return
    }
    if (get().dadosAtuais === dados) return
    const atual = get().config
    const ativo = get().cenarioAtivo
    // com um cenário salvo no alternador, o mundo novo recebe as premissas dele outra vez
    const config = ativo
      ? comSnapshot(dados.config, ativo.premissas)
      : atual
        ? { ...dados.config, horizonte: atual.horizonte, perfil: atual.perfil, rebalancear: atual.rebalancear }
        : dados.config
    set({ mundo: dados.mundo, config, indices: dados.indices, erro: null, dadosAtuais: dados })
    void get().recalcular()
  },

  recalcular: async (motivo) => {
    const { mundo, config } = get()
    if (!mundo || !config) return
    const id = proximoId + 1
    const r = await executar(mundo, config)
    // resposta de uma execução antiga: descartada
    if (r.id < id || r.id < proximoId) return
    if (r.erro || !r.simulacao) {
      set({ erro: r.erro ?? "falha no motor" })
      get().avisar(`erro no motor: ${r.erro}`, 4000)
      return
    }
    set({ simulacao: r.simulacao, ms: r.ms ?? null })
    if (motivo) get().avisar(motivo)
    else set({ estado: ocioso(r.ms ?? null) })
  },

  // Botão Otimizar: pausa mínima de 620ms para a execução ser percebida, como no protótipo.
  otimizar: async () => {
    set({ estado: { texto: "otimizando", vivo: true }, otimizando: true })
    const espera = new Promise((r) => setTimeout(r, 620))
    await Promise.all([get().recalcular(), espera])
    set({ otimizando: false, execucao: get().execucao + 1 })
    get().avisar(`plano recalculado, solver ${get().ms} ms`, 2400)
  },

  setHorizonte: (h) => get().editarConfig((c) => ({ ...c, horizonte: h })),
  setPerfil: (p) => get().editarConfig((c) => ({ ...c, perfil: p })),
  setRebalancear: (v) => get().editarConfig((c) => ({ ...c, rebalancear: v })),

  editarConfig: (fn, opcoes = {}) => {
    const config = get().config
    if (!config) return
    set({ config: fn(config) })
    clearTimeout(timerRecalculo)
    if (opcoes.adiado) {
      set({ estado: { texto: "recalculando", vivo: true } })
      timerRecalculo = setTimeout(() => void get().recalcular(), 300)
    } else {
      void get().recalcular(opcoes.motivo ?? "cenário recalculado")
    }
  },

  editarMundo: (fn, motivo) => {
    const mundo = get().mundo
    if (!mundo) return
    set({ mundo: fn(mundo) })
    void get().recalcular(motivo ?? "cenário replanejado")
  },
}))
