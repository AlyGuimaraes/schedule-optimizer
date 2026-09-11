import { simular, type Config, type Mundo } from "@/lib/dominio"

// Roda o motor fora da thread da interface, para a edição continuar fluida enquanto recalcula.
type Pedido = { id: number; mundo: Mundo; config: Config }

self.onmessage = (evento: MessageEvent<Pedido>) => {
  const { id, mundo, config } = evento.data
  const inicio = performance.now()
  try {
    const simulacao = simular(mundo, config)
    self.postMessage({ id, simulacao, ms: Math.round(performance.now() - inicio) })
  } catch (e) {
    self.postMessage({ id, erro: e instanceof Error ? e.message : String(e) })
  }
}
