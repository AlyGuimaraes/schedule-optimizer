// Formatação do protótipo: vírgula decimal, uma casa, unidade separada do número.

export const DIAS_LB = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const

/** Slot de 30 minutos a partir das 08:00 para "HH:MM". */
export const hhmm = (s: number) =>
  String(8 + Math.floor(s / 2)).padStart(2, "0") + ":" + (s % 2 ? "30" : "00")

export const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",")
export const n0 = (v: number) => String(Math.round(v))
export const pc = (v: number) => n1(v) + "%"
export const primeiro = (nome: string) => nome.split(" ")[0]

export function iniciaisDe(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
