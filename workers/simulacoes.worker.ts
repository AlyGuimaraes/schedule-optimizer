import { executarHipotese, type Config, type Mundo, type PedidoSimulacao } from "@/lib/dominio"

// Hipóteses da E22 (contratação, dispensa de cargo, projeção) num worker próprio: várias simulações
// seguidas sem travar a interface e sem disputar a fila do motor principal.
type Mensagem = { id: number; mundo: Mundo; config: Config; pedido: PedidoSimulacao }

self.onmessage = (evento: MessageEvent<Mensagem>) => {
  const { id, mundo, config, pedido } = evento.data
  try {
    self.postMessage({ id, resultado: executarHipotese(mundo, config, pedido) })
  } catch (e) {
    self.postMessage({ id, erro: e instanceof Error ? e.message : String(e) })
  }
}
