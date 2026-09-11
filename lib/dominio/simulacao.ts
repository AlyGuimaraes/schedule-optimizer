import { agendarBaseline } from "./baseline"
import { gerarDemanda } from "./demanda"
import { kpis } from "./kpis"
import { otimizar } from "./otimizador"
import { geralDe } from "./premissas"
import type { Cerimonia, Config, Mundo, ResultadoOtimizacao, ResumoMes, SemanaSimulada, Simulacao } from "./tipos"

const acimaDoLimite = (r: ResultadoOtimizacao, limite: number) =>
  !!r.estabilidade && r.estabilidade.movidas > r.estabilidade.comparaveis * limite + 1e-9

/**
 * Limite de movidas por ciclo (§2.2), restrição relaxável com registro. Com plano vigente, se mais
 * de 20% das cerimônias comparáveis saírem do lugar, o peso da estabilidade é reforçado (×3, até
 * três vezes). Se nem assim couber, fica a tentativa mais estável, marcada como relaxada.
 */
function comLimiteDeMovidas(dem: Cerimonia[], mundo: Mundo, cfg: Config): ResultadoOtimizacao {
  const rodar = (c: Config) => otimizar(dem.map((e) => ({ ...e })), mundo.pessoas, c, mundo)
  const primeiro = rodar(cfg)
  if (!cfg.planoVigente) return primeiro
  const limite = cfg.limiteMovidas ?? 0.2
  if (!acimaDoLimite(primeiro, limite)) return primeiro

  let melhor = primeiro
  let pesoMelhor = cfg.pesoEstabilidade ?? 3
  let peso = pesoMelhor
  for (let i = 0; i < 3; i++) {
    peso = Math.max(peso, 1) * 3
    const t = rodar({ ...cfg, pesoEstabilidade: peso })
    if ((t.estabilidade?.pct ?? 0) > (melhor.estabilidade?.pct ?? 0)) {
      melhor = t
      pesoMelhor = peso
    }
    if (!acimaDoLimite(t, limite)) break
  }
  if (melhor.estabilidade)
    melhor.estabilidade = { ...melhor.estabilidade, peso: pesoMelhor, relaxada: acimaDoLimite(melhor, limite) }
  return melhor
}

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
    const otm = comLimiteDeMovidas(dem, mundo, cfgW)
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
