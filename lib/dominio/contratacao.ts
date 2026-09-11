import { clonar } from "./padroes"
import { simular } from "./simulacao"
import { montarSquad, rebalancearAlocacao } from "./squads"
import type { Config, Mundo, Papel, Projeto, Simulacao } from "./tipos"

// Simulação de contratação e déficit (E22, Parte IV.1). Hipóteses sobre o mundo atual, sem gravar
// nada: cada uma devolve os mesmos indicadores para ficarem lado a lado com a situação de hoje.

export interface Metricas {
  pessoas: number
  projetos: number
  /** cerimônias por semana, média do horizonte */
  demanda: number
  alocadas: number
  /** % da demanda alocada no horizonte */
  cobertura: number
  /** % das obrigatórias alocadas no horizonte */
  obrigatoria: number
  aderencia: number
  /** déficit estrutural das obrigatórias em FTE, média por semana */
  deficitFte: number
  horasSemana: number
}

export function metricas(sim: Simulacao, mundo: Mundo): Metricas {
  const S = sim.semanas
  const n = Math.max(1, S.length)
  const soma = (f: (w: (typeof S)[number]) => number) => S.reduce((s, w) => s + f(w), 0)
  const demanda = soma((w) => w.demanda.length)
  const alocadas = soma((w) => w.otm.alocadas.length)
  const obrigTotal = soma((w) => w.demanda.filter((d) => d.obrig).length)
  const obrigAloc = soma((w) => w.otm.alocadas.filter((d) => d.obrig).length)
  return {
    pessoas: mundo.pessoas.length,
    projetos: mundo.projetos.length,
    demanda: demanda / n,
    alocadas: alocadas / n,
    cobertura: demanda ? (alocadas / demanda) * 100 : 100,
    obrigatoria: obrigTotal ? (obrigAloc / obrigTotal) * 100 : 100,
    aderencia: soma((w) => w.otm.kpi.aderencia) / n,
    deficitFte: soma((w) => Object.values(w.otm.deficit).reduce((s, d) => s + d.fteObrig, 0)) / n,
    horasSemana: soma((w) => w.otm.kpi.horasTotais) / n,
  }
}

/** Quem entra também folga no feriado: a pessoa nova herda os dias de feriado do calendário. */
function comFeriados(cfg: Config, ids: number[]): Config {
  const cal = cfg.calendario
  if (!cal?.feriados || !ids.length) return cfg
  const indisponivel = clonar(cal.indisponivel ?? {})
  Object.entries(cal.feriados).forEach(([s, dias]) => {
    const semana = (indisponivel[Number(s)] ??= {})
    ids.forEach((id) => {
      semana[id] = { ...(semana[id] ?? {}), ...dias }
    })
  })
  return { ...cfg, calendario: { ...cal, indisponivel } }
}

export interface Contratacao {
  papel: Papel
  timeId: number
  quantidade: number
}

/**
 * Mundo com pessoas novas do cargo no time escolhido. Os squads são sempre redistribuídos pela
 * menor carga, inclusive com zero contratações, para a comparação medir só o efeito de quem entra.
 */
export function comContratacao(mundo: Mundo, cfg: Config, h: Contratacao): { mundo: Mundo; cfg: Config } {
  const m = clonar(mundo)
  const novos: number[] = []
  for (let i = 0; i < h.quantidade; i++) {
    const id = m.pessoas.length
    m.pessoas.push({ id, nome: `Contratação ${i + 1}`, papel: h.papel, iniciais: `C${i + 1}` })
    m.times.find((t) => t.id === h.timeId)?.membros.push(id)
    novos.push(id)
  }
  rebalancearAlocacao(m, cfg)
  return { mundo: m, cfg: comFeriados(cfg, novos) }
}

export type PontoCurva = Metricas & { adicionais: number }

/** Curva de cobertura por pessoa a mais do cargo, de zero até `maximo`. */
export function curvaContratacao(mundo: Mundo, cfg: Config, papel: Papel, timeId: number, maximo = 4): PontoCurva[] {
  return Array.from({ length: maximo + 1 }, (_, n) => {
    const h = comContratacao(mundo, cfg, { papel, timeId, quantidade: n })
    return { adicionais: n, ...metricas(simular(h.mundo, h.cfg), h.mundo) }
  })
}

export interface DispensaCargo {
  fase: string
  papel: Papel
}

/** "E se o kickoff não exigir Líder Técnico": o cargo sai das cerimônias da fase. */
export function semCargoNaFase(mundo: Mundo, cfg: Config, h: DispensaCargo): Mundo {
  const m = clonar(mundo)
  m.playbook[h.fase] = (m.playbook[h.fase] ?? [])
    .map((c) => ({ ...c, papeis: c.papeis.filter((pp) => pp !== h.papel) }))
    .filter((c) => c.papeis.length > 0)
  rebalancearAlocacao(m, cfg)
  return m
}

export interface ResultadoDispensa {
  base: Metricas
  hipotese: Metricas
  /** horas de reunião por semana de quem ocupa o cargo, antes e depois */
  horasCargo: { antes: number; depois: number }
}

export function compararDispensa(mundo: Mundo, cfg: Config, h: DispensaCargo): ResultadoDispensa {
  const base = clonar(mundo)
  rebalancearAlocacao(base, cfg)
  const hipotese = semCargoNaFase(mundo, cfg, h)
  const sb = simular(base, cfg)
  const sh = simular(hipotese, cfg)
  const horasDoCargo = (s: Simulacao) =>
    s.semanas.reduce(
      (acc, w) => acc + w.otm.kpi.porPessoa.filter((p) => p.papel === h.papel).reduce((x, p) => x + p.horas, 0),
      0
    ) / Math.max(1, s.semanas.length)
  return {
    base: metricas(sb, base),
    hipotese: metricas(sh, hipotese),
    horasCargo: { antes: horasDoCargo(sb), depois: horasDoCargo(sh) },
  }
}

export interface Previsao {
  novosPorMes: number
  fase: string
  timeId: number
  meses?: number
}

export type PontoProjecao = Metricas & { mes: number; novos: number }

/**
 * Projeção de três meses: a cada mês entram `novosPorMes` projetos previstos na fase de entrada,
 * no time escolhido, com squad montado pela menor carga. Os previstos ficam na fase de entrada
 * durante a projeção, uma leitura conservadora da demanda dos primeiros meses.
 */
export function projecaoTrimestre(mundo: Mundo, cfg: Config, p: Previsao): PontoProjecao[] {
  const meses = p.meses ?? 3
  const modelo = mundo.projetos.find((pr) => pr.fase === p.fase)
  return Array.from({ length: meses + 1 }, (_, k) => {
    const m = clonar(mundo)
    const novos = k * p.novosPorMes
    for (let i = 0; i < novos; i++) {
      const pr: Projeto = {
        id: m.projetos.length,
        nome: `Projeto previsto ${i + 1}`,
        fase: p.fase,
        squad: {},
        health: "verde",
        prioridade: "media",
        produtos: modelo ? { ...modelo.produtos } : { relatorios: 2, dashboards: 1, integracoes: 1 },
        mes: 1,
        timeId: p.timeId,
      }
      m.projetos.push(pr)
      montarSquad(m, pr, cfg)
    }
    return { mes: k, novos, ...metricas(simular(m, cfg), m) }
  })
}

export type PedidoSimulacao =
  | ({ tipo: "curva" } & { papel: Papel; timeId: number; maximo: number })
  | ({ tipo: "dispensa" } & DispensaCargo)
  | ({ tipo: "projecao" } & Previsao)

/** Ponto único de entrada, usado pelo worker de hipóteses. */
export function executarHipotese(mundo: Mundo, cfg: Config, pedido: PedidoSimulacao) {
  if (pedido.tipo === "curva") return curvaContratacao(mundo, cfg, pedido.papel, pedido.timeId, pedido.maximo)
  if (pedido.tipo === "dispensa") return compararDispensa(mundo, cfg, pedido)
  return projecaoTrimestre(mundo, cfg, pedido)
}
