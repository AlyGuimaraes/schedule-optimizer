"use client"

import type { Config, Mundo, PedidoSimulacao } from "@/lib/dominio"

type Resposta = { id: number; resultado?: unknown; erro?: string }

let worker: Worker | null = null
let proximo = 0
const pendentes = new Map<number, { ok: (v: unknown) => void; falha: (e: Error) => void }>()

function obterWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/simulacoes.worker.ts", import.meta.url))
    worker.onmessage = (e: MessageEvent<Resposta>) => {
      const p = pendentes.get(e.data.id)
      pendentes.delete(e.data.id)
      if (!p) return
      if (e.data.erro) p.falha(new Error(e.data.erro))
      else p.ok(e.data.resultado)
    }
  }
  return worker
}

/** Roda uma hipótese da E22 fora da thread da interface. */
export function simularHipotese<T>(mundo: Mundo, config: Config, pedido: PedidoSimulacao): Promise<T> {
  const id = ++proximo
  return new Promise<T>((ok, falha) => {
    pendentes.set(id, { ok: (v) => ok(v as T), falha })
    obterWorker().postMessage({ id, mundo, config, pedido })
  })
}
