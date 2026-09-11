import { CLIENTES_PADRAO, ETAPAS_PADRAO, GERAL_PADRAO, PREM_PADRAO } from "./padroes"
import type {
  Config,
  Papel,
  PremissasCargo,
  PremissasCargoEntrada,
  PremissasGerais,
  UrgenciaEtapa,
} from "./tipos"

/**
 * Modelo de cálculo do §5:
 *   capacidade líquida = jornada × (1 − ausência) − institucional
 *   teto do alvo       = Cl × (1 − produtivo mínimo)
 *   teto efetivo       = min(teto do alvo, máximo absoluto de h/semana)
 *   limite aceitável   = min(Cl × (1 − alvo + tolerância), máximo absoluto)
 * A tolerância negocia o percentual, nunca o número absoluto declarado.
 */
export function premDe(
  cfg: Partial<Config> | undefined,
  papel: Papel,
  /** exceção da pessoa (§2.1): o nível mais específico vence */
  excecao?: Partial<PremissasCargoEntrada>
): PremissasCargo {
  const base = cfg?.papeis?.[papel] ?? PREM_PADRAO[papel] ?? PREM_PADRAO["Analista"]
  const p = excecao ? { ...base, ...excecao } : base
  const tol = p.tolerancia === undefined ? 0 : p.tolerancia
  const Cl = p.jornada * (1 - p.fatorAusencia / 100) - p.tempoInstitucional
  const semanaCap = p.maxHorasSemana === undefined ? 99 : p.maxHorasSemana
  const tetoAlvo = Cl * (1 - p.produtivoMin / 100)
  const tetoTol = Cl * (1 - Math.max(0, p.produtivoMin - tol) / 100)
  return {
    ...p,
    tolerancia: tol,
    duracaoMax: p.duracaoMax === undefined ? 4 : p.duracaoMax,
    maxHorasSemana: semanaCap,
    maxHorasMes: p.maxHorasMes === undefined ? 99 : p.maxHorasMes,
    Cl,
    tetoAlvo,
    teto: Math.min(tetoAlvo, semanaCap),
    tetoMax: Math.min(tetoTol, semanaCap),
    limitadoPorHoras: semanaCap < tetoAlvo - 1e-9,
  }
}

export function geralDe(cfg?: Partial<Config>): PremissasGerais {
  return { ...GERAL_PADRAO, ...(cfg?.geral ?? {}) }
}

export function etapaDe(cfg: Partial<Config> | undefined, fase: string): UrgenciaEtapa {
  return {
    ...(ETAPAS_PADRAO[fase] ?? { urgencia: 2, prazoDias: 15 }),
    ...(cfg?.etapas?.[fase] ?? {}),
  }
}

export function pesoCliente(cfg: Partial<Config> | undefined, prioridade: string): number {
  const t = { ...CLIENTES_PADRAO, ...(cfg?.clientes ?? {}) }
  return t[prioridade] === undefined ? 2 : t[prioridade]
}

/** Score que reordena a fila: urgência da etapa × peso do cliente (§2.5). */
export function scoreDe(cfg: Partial<Config> | undefined, fase: string, prioridade: string): number {
  return +(etapaDe(cfg, fase).urgencia * pesoCliente(cfg, prioridade)).toFixed(2)
}
