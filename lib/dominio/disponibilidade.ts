import { DIAS, GERAL_PADRAO, SLOTS_DIA } from "./padroes"
import type { Cerimonia, Ocupacao, PremissasGerais } from "./tipos"

export function novaOcupacao(nPessoas: number): Ocupacao {
  const o: Ocupacao = []
  for (let p = 0; p < nPessoas; p++) {
    o.push(Array.from({ length: DIAS }, () => new Array<number | null>(SLOTS_DIA).fill(null)))
  }
  return o
}

export function almoco(G: PremissasGerais, t: number): boolean {
  return t >= G.almocoInicio && t < G.almocoInicio + G.almocoDur
}

export function diaBloqueado(G: PremissasGerais, d: number, s: number, len: number): boolean {
  if (G.diaProtegido === "sexta" && d === DIAS - 1) return true
  if (G.diaProtegido === "sexta-tarde" && d === DIAS - 1 && s + len > G.almocoInicio + G.almocoDur)
    return true
  return false
}

/**
 * A pessoa está livre no bloco? Cobre janela de trabalho, almoço, dia protegido e,
 * com `comBuffer`, o respiro obrigatório antes e depois (R4, R5, R13).
 */
export function livre(
  oc: Ocupacao,
  pessoa: number,
  d: number,
  s: number,
  len: number,
  G: PremissasGerais = GERAL_PADRAO,
  comBuffer = false
): boolean {
  if (s < G.inicio || s + len > G.fim) return false
  if (diaBloqueado(G, d, s, len)) return false
  for (let i = 0; i < len; i++) {
    const t = s + i
    if (t >= SLOTS_DIA || almoco(G, t)) return false
    if (oc[pessoa][d][t] !== null) return false
  }
  if (comBuffer && G.buffer > 0) {
    for (let i = 1; i <= G.buffer; i++) {
      const a = s - i
      const b = s + len + i - 1
      if (a >= G.inicio && !almoco(G, a) && oc[pessoa][d][a] !== null) return false
      if (b < G.fim && !almoco(G, b) && oc[pessoa][d][b] !== null) return false
    }
  }
  return true
}

export function marcar(oc: Ocupacao, ev: Cerimonia, d: number, s: number): void {
  ev.participantes.forEach((p) => {
    for (let i = 0; i < ev.slots; i++) oc[p][d][s + i] = ev.id
  })
  ev.dia = d
  ev.slot = s
}
