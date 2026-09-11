import type { Config, KpiPessoa, Mundo, SemanaSimulada } from "@/lib/dominio"
import type { Cenario } from "@/lib/estado/cadencia"
import type { Tom } from "@/components/cadencia/primitivas"

/** Resultado da semana no cenário escolhido no cabeçalho. */
export const resultadoDe = (w: SemanaSimulada, cenario: Cenario) =>
  cenario === "otm" ? w.otm : w.base

/** Cargos na ordem cadastrada (o protótipo usava Object.keys(PREM)). */
export const papeisDe = (config: Config) => Object.keys(config.papeis)

export const pessoasDo = (mundo: Mundo, papel: string) =>
  mundo.pessoas.filter((p) => p.papel === papel)

/** Situação da pessoa contra o teto do próprio cargo, como no protótipo. */
export function situacaoPessoa(k: KpiPessoa): [Tom, string] {
  if (k.acimaLimite) return ["ruim", "acima do limite"]
  if (k.acimaTeto) return ["aviso", "concessão"]
  if (k.horas > k.teto * 0.85) return ["acento", "no alvo, apertado"]
  if (k.horas < k.teto * 0.45) return ["neutro", "folga"]
  return ["ok", "no alvo"]
}

/** Fator que projeta o horizonte simulado para um mês. */
export const fatorMes = (config: Config) => 4.33 / config.horizonte

/** Pessoa-hora de uma cerimônia: duração vezes participantes. */
export const pessoaHora = (ev: { dur: number; participantes: number[] }) =>
  (ev.dur / 60) * ev.participantes.length
