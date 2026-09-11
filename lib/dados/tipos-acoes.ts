import type { Health, PremissasCargoEntrada, PremissasGerais, Prioridade } from "@/lib/dominio"

export type Resultado<T = null> = { ok: true; dados: T } | { ok: false; erro: string }

export interface ProjetoEntrada {
  id?: string | null
  nome: string
  cliente: string
  etapaId: string
  timeId: string
  mes: number
  health: Health
  prioridade: Prioridade
  produtos: { relatorios: number; dashboards: number; integracoes: number }
  /** cadeiras escolhidas à mão, por uuid de cargo; as demais ficam em automático */
  squad: Record<string, string>
}

export interface PessoaEntrada {
  id?: string | null
  nome: string
  cargoId: string
}

export interface TimeEntrada {
  id?: string | null
  nome: string
  membros: string[]
}

export interface CargoEntrada {
  id?: string | null
  nome: string
  copiarDe?: string | null
}

export interface EtapaEntrada {
  id?: string | null
  rotulo: string
  urgencia: number
  prazoDias: number
}

export interface CerimoniaEntrada {
  id?: string | null
  etapaId: string
  tipo: string
  dur: number
  cada: number
  prio: number
  obrig: boolean
  /** uuids dos cargos obrigatórios, na ordem do quórum */
  cargos: string[]
}

export type CampoCerimonia = "dur" | "cada" | "prio" | "obrig"

export type PremissaCargoParcial = Partial<PremissasCargoEntrada>
export type PremissasGeraisParcial = Partial<PremissasGerais>
