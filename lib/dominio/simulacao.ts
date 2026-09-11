import { agendarBaseline } from "./baseline"
import { gerarDemanda } from "./demanda"
import { kpis } from "./kpis"
import { otimizar } from "./otimizador"
import { geralDe } from "./premissas"
import type { Config, Mundo, ResumoMes, SemanaSimulada, Simulacao } from "./tipos"

/**
 * Roda o horizonte inteiro. O orçamento mensal é acumulado semana a semana,
 * então uma semana pesada reduz o que sobra para as seguintes (§2.4).
 */
export function simular(mundo: Mundo, cfg: Config): Simulacao {
  const H = Math.max(1, cfg.horizonte || 4)
  const semanas: SemanaSimulada[] = []
  const acumulado = new Array<number>(mundo.pessoas.length).fill(0)

  for (let w = 1; w <= H; w++) {
    const dem = gerarDemanda(mundo, w, cfg)
    const base = agendarBaseline(
      dem.map((e) => ({ ...e })),
      mundo.pessoas.length,
      20 + w,
      geralDe(cfg)
    )
    const cfgW: Config = { ...cfg, acumulado: acumulado.slice(), semanaIdx: w }
    const otm = otimizar(dem.map((e) => ({ ...e })), mundo.pessoas, cfgW, mundo)
    otm.alocadas.forEach((ev) =>
      ev.participantes.forEach((p) => {
        acumulado[p] += ev.dur / 60
      })
    )
    semanas.push({
      semana: w,
      demanda: dem,
      base: { ...base, kpi: kpis(base.oc, base.alocadas, mundo.pessoas, cfg) },
      otm: { ...otm, kpi: kpis(otm.oc, otm.alocadas, mundo.pessoas, cfg) },
    })
  }

  // projeção mensal a partir do horizonte simulado
  const F = 4.33 / H
  const mes = { base: {} as ResumoMes, otm: {} as ResumoMes }
  ;(["base", "otm"] as const).forEach((k) => {
    mes[k].reunioes = Math.round(semanas.reduce((s, w) => s + w[k].alocadas.length, 0) * F)
    mes[k].horas = +(semanas.reduce((s, w) => s + w[k].kpi.horasTotais, 0) * F).toFixed(1)
    mes[k].produtivo = +(semanas.reduce((s, w) => s + w[k].kpi.produtivoMedio, 0) / H).toFixed(1)
    mes[k].acimaTeto = Math.max(...semanas.map((w) => w[k].kpi.acimaTeto))
    mes[k].porPessoa = mundo.pessoas.map((p) => ({
      id: p.id,
      reunioes: Math.round(semanas.reduce((s, w) => s + w[k].kpi.porPessoa[p.id].reunioes, 0) * F),
      horas: +(semanas.reduce((s, w) => s + w[k].kpi.porPessoa[p.id].horas, 0) * F).toFixed(1),
    }))
  })

  return { semanas, mes }
}
