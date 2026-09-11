import type { CSSProperties } from "react"

import type { Etapa } from "@/lib/dominio"

/** Hue por tipo de cerimônia, igual ao protótipo. Tipos novos ganham hue por hash do nome. */
export const HUE_CER: Record<string, number> = {
  "Kickoff Executivo": 300,
  "Levantamento de Requisitos": 250,
  "Reunião de Trabalho": 145,
  "Status Report": 85,
  "Validação de Dados": 225,
  "Validação de Produto": 210,
  "Sessão de Homologação": 35,
  "Acompanhamento Pós Go-live": 170,
  "Treinamento de Usuários": 60,
  "Check-in de Sustentação": 110,
}

export function hueDeTexto(t: string) {
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360
  return h
}

export const hueCer = (tipo: string) => HUE_CER[tipo] ?? hueDeTexto(tipo)

export const hueFase = (etapas: Record<string, Etapa>, fase: string) =>
  etapas[fase]?.hue ?? hueCer(fase)

/** Variável `--fh` que os chips por hue do CSS usam. */
export const estiloHue = (h: number) => ({ "--fh": h }) as CSSProperties
