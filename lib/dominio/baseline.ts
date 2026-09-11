import { mulberry32 } from "./aleatorio"
import { livre, marcar, novaOcupacao, almoco } from "./disponibilidade"
import { DIAS, GERAL_PADRAO } from "./padroes"
import type { Cerimonia, PremissasGerais, ResultadoBaseline } from "./tipos"

/**
 * Agenda vigente simulada: cada pessoa marca no maior bloco livre que encontra, sem política.
 * É o cenário "Agenda atual" enquanto a importação real (E09) não existe.
 *
 * O embaralhamento com `sort` de comparador aleatório é o do protótipo e fica aqui
 * apenas enquanto a paridade numérica estiver travada.
 */
export function agendarBaseline(
  demanda: Cerimonia[],
  nPessoas: number,
  seed = 21,
  G: PremissasGerais = GERAL_PADRAO
): ResultadoBaseline {
  const rnd = mulberry32(seed)
  const oc = novaOcupacao(nPessoas)
  const alocadas: Cerimonia[] = []
  const naoAlocadas: Cerimonia[] = []
  const ordem = [...demanda].sort(() => rnd() - 0.5)

  ordem.forEach((ev) => {
    let melhor: { d: number; s: number } | null = null
    for (let tent = 0; tent < 8 && !melhor; tent++) {
      const d = Math.floor(rnd() * DIAS)
      let run: number[] = []
      const blocos: number[][] = []
      for (let t = G.inicio; t < G.fim; t++) {
        const ok = !almoco(G, t) && ev.participantes.every((p) => oc[p][d][t] === null)
        if (ok) run.push(t)
        else {
          if (run.length) blocos.push(run)
          run = []
        }
      }
      if (run.length) blocos.push(run)
      const cand = blocos.filter((b) => b.length >= ev.slots).sort((a, b) => b.length - a.length)[0]
      if (cand) {
        const centro = cand[0] + Math.max(0, Math.floor((cand.length - ev.slots) / 2))
        if (ev.participantes.every((p) => livre(oc, p, d, centro, ev.slots, G)))
          melhor = { d, s: centro }
      }
    }
    if (!melhor) {
      for (let d = 0; d < DIAS && !melhor; d++)
        for (let s = G.inicio; s + ev.slots <= G.fim && !melhor; s++)
          if (ev.participantes.every((p) => livre(oc, p, d, s, ev.slots, G))) melhor = { d, s }
    }
    if (melhor) {
      marcar(oc, ev, melhor.d, melhor.s)
      alocadas.push(ev)
    } else naoAlocadas.push(ev)
  })

  return { oc, alocadas, naoAlocadas }
}
