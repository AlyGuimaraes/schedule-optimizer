"use client"

import { create } from "zustand"

import type { Config, Mundo, Simulacao } from "@/lib/dominio"
import type { DadosMundo, Indices } from "@/lib/dados/mapeador"

export type Cenario = "base" | "otm"
type Estado = { texto: string; vivo: boolean }

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
  setCenario: (cenario: Cenario) => void
  avisar: (texto: string, duracao?: number) => void
  inicializar: (dados: DadosMundo | null, erro: string | null) => void
  recalcular: (motivo?: string) => Promise<void>
  otimizar: () => Promise<void>
}

type Resposta = { id: number; simulacao?: Simulacao; ms?: number; erro?: string }

let worker: Worker | null = null
let proximoId = 0
const pendentes = new Map<number, (r: Resposta) => void>()
let timerEstado: ReturnType<typeof setTimeout> | undefined

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

  setCenario: (cenario) => set({ cenario }),

  avisar: (texto, duracao = 2400) => {
    set({ estado: { texto, vivo: true } })
    clearTimeout(timerEstado)
    timerEstado = setTimeout(() => set({ estado: ocioso(get().ms) }), duracao)
  },

  inicializar: (dados, erro) => {
    if (!dados) {
      set({ erro, estado: { texto: "sem conexão com o banco", vivo: true } })
      return
    }
    if (get().mundo) return
    set({ mundo: dados.mundo, config: dados.config, indices: dados.indices, erro: null })
    void get().recalcular()
  },

  recalcular: async (motivo) => {
    const { mundo, config } = get()
    if (!mundo || !config) return
    const id = proximoId + 1
    const r = await executar(mundo, config)
    // resposta de uma execução antiga: descartada
    if (r.id < id) return
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
    set({ estado: { texto: "otimizando", vivo: true } })
    const espera = new Promise((r) => setTimeout(r, 620))
    await Promise.all([get().recalcular(), espera])
    get().avisar(`plano recalculado, solver ${get().ms} ms`)
  },
}))
