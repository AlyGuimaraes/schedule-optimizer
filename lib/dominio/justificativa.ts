import { geralDe } from "./premissas"
import type { Cerimonia, Config, Mundo, ResultadoOtimizacao } from "./tipos"

const hhmm = (s: number) => String(8 + Math.floor(s / 2)).padStart(2, "0") + ":" + (s % 2 ? "30" : "00")
const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",")

/**
 * Por que esta cerimônia caiu neste horário (§12: justificativa visível em cada ocorrência).
 * Frases curtas, na ordem em que o solver decidiu.
 */
export function justificativa(
  ev: Cerimonia,
  resultado: Pick<ResultadoOtimizacao, "concessoes" | "trocas">,
  mundo: Mundo,
  cfg: Partial<Config>
): string[] {
  const G = geralDe(cfg)
  const frases: string[] = []
  const nome = (id: number) => mundo.pessoas[id]?.nome ?? `pessoa ${id}`
  const slot = ev.slot ?? 0

  if (ev.ancorada) frases.push(`Horário fixado por âncora: ${hhmm(slot)}, imposto pelo cliente e tratado como restrição rígida.`)

  if (ev.camada === 3) {
    const cedidas = resultado.concessoes.filter((c) => c.evId === ev.id)
    const lista = cedidas.map((c) => `${c.premissa} de ${c.pessoa} (${n1(c.alvo)}${c.un} para ${n1(c.valor)}${c.un})`)
    frases.push(
      `Alocada na camada 3, com concessão dentro da tolerância do cargo${lista.length ? `: ${lista.join("; ")}` : ""}.`
    )
  } else if (ev.camada === 2) {
    const troca = resultado.trocas.find((t) => t.ev.id === ev.id)
    const subs = troca?.subs.map((s) => `${s.papel}: ${nome(s.de)} saiu e ${nome(s.para)} entrou`) ?? []
    frases.push(`Alocada na camada 2, trocando a cadeira sem ceder premissa${subs.length ? ` (${subs.join("; ")})` : ""}.`)
  } else if (!ev.ancorada) {
    frases.push("Alocada na camada 1, dentro do alvo de todos os participantes.")
  }

  if (ev.sla) frases.push(`Prazo crítico de ${ev.prazoDias} dias úteis: entrou na frente da fila e foi puxada para o início da semana.`)
  else frases.push(`Score de fila ${n1(ev.score)} (urgência da etapa ${ev.urgencia} × peso do cliente ${ev.pesoCliente}).`)

  const fora = Array.from({ length: ev.slots }, (_, i) => slot + i).some((s) => !G.preferidos.includes(s))
  frases.push(
    fora
      ? "Parte do horário fica fora da faixa preferencial: não havia janela comum aos participantes dentro dela."
      : "Dentro da faixa preferencial de horários."
  )

  if (ev.movida) frases.push("Saiu do horário que tinha no plano vigente.")

  frases.push(
    `Participantes: ${ev.participantes.map((p, i) => `${nome(p)} (${ev.papeis[i]})`).join(", ")}.`
  )
  return frases
}
