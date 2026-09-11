export * from "./tipos"
export * from "./padroes"
export * from "./aleatorio"
export * from "./premissas"
export * from "./semente"
export * from "./times"
export * from "./squads"
export * from "./demanda"
export * from "./disponibilidade"
export * from "./baseline"
export * from "./otimizador"
export * from "./kpis"
export * from "./capacidade"
export * from "./simulacao"
export * from "./validador"
export * from "./justificativa"
export * from "./modificadores"
export * from "./calendario"
export * from "./custos"
export * from "./contratacao"

import { clonar, CLIENTES_PADRAO, ETAPAS_PADRAO, GERAL_PADRAO, PREM_PADRAO } from "./padroes"
import type { Config } from "./tipos"

/** Configuração padrão: alvos, premissas gerais, urgência por etapa e pesos de cliente. */
export function criarConfig(parcial: Partial<Config> = {}): Config {
  return {
    horizonte: 4,
    perfil: "equilibrio",
    rebalancear: true,
    papeis: clonar(PREM_PADRAO),
    geral: clonar(GERAL_PADRAO),
    etapas: clonar(ETAPAS_PADRAO),
    clientes: { ...CLIENTES_PADRAO },
    ...parcial,
  }
}
