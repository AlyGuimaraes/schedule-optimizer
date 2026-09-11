import type { Cerimonia, Config, Mundo, Papel, Projeto, Simulacao } from "./tipos"

// Custo de cerimônia (§6, E08 e E24): horas de reunião vezes o custo por hora do cargo que
// ocupa cada cadeira. Tudo projetado para um mês a partir do horizonte simulado (× 4,33 / H).

/** Custo por hora-pessoa quando o cargo não tem valor cadastrado; é o número fixo do protótipo. */
export const CUSTO_HORA_PADRAO = 118

export const custoHoraDe = (cfg: Partial<Config> | undefined, papel: Papel): number =>
  cfg?.custoHora?.[papel] ?? CUSTO_HORA_PADRAO

/** Custo de uma ocorrência: a duração vezes o custo-hora de cada cadeira. */
export function custoCerimonia(ev: Pick<Cerimonia, "dur" | "papeis">, cfg?: Partial<Config>): number {
  return ev.papeis.reduce((s, pp) => s + (ev.dur / 60) * custoHoraDe(cfg, pp), 0)
}

/** Cliente do projeto: o cadastrado ou, na semente, o nome sem o último termo ("Agro Bandeirante I"). */
export function clienteDe(pr: Pick<Projeto, "nome" | "cliente">): string {
  if (pr.cliente) return pr.cliente
  const partes = pr.nome.trim().split(/\s+/)
  return partes.length > 1 ? partes.slice(0, -1).join(" ") : pr.nome
}

export const totalProdutos = (pr: Pick<Projeto, "produtos">) =>
  pr.produtos.relatorios + pr.produtos.dashboards + pr.produtos.integracoes

/** Faixas de volume do benchmark por produto (E24). */
export const FAIXAS_VOLUME = ["até 3 produtos", "4 a 6 produtos", "7 a 9 produtos", "10 ou mais"] as const
export function faixaVolume(n: number): (typeof FAIXAS_VOLUME)[number] {
  return n <= 3 ? FAIXAS_VOLUME[0] : n <= 6 ? FAIXAS_VOLUME[1] : n <= 9 ? FAIXAS_VOLUME[2] : FAIXAS_VOLUME[3]
}

export interface LinhaCusto {
  chave: string
  /** projetos distintos com cerimônia no recorte (no benchmark, todos os projetos da faixa) */
  projetos: number
  cerimonias: number
  pessoaHora: number
  custo: number
  /** só no benchmark: produtos somados dos projetos da faixa */
  produtos?: number
}

export interface AnaliseCustos {
  /** custo mensal projetado de todas as cerimônias alocadas */
  total: number
  porCliente: LinhaCusto[]
  porTipo: LinhaCusto[]
  porFase: LinhaCusto[]
  porVolume: LinhaCusto[]
}

type Acumulado = { projetos: Set<number>; cerimonias: number; pessoaHora: number; custo: number }

export function analisarCustos(sim: Simulacao, mundo: Mundo, cfg: Config, cenario: "base" | "otm" = "otm"): AnaliseCustos {
  const F = 4.33 / Math.max(1, sim.semanas.length)
  const cliente = new Map<string, Acumulado>()
  const tipo = new Map<string, Acumulado>()
  const fase = new Map<string, Acumulado>()
  const volume = new Map<string, Acumulado>()
  const somar = (m: Map<string, Acumulado>, k: string, ev: Cerimonia, custo: number) => {
    const a = m.get(k) ?? { projetos: new Set<number>(), cerimonias: 0, pessoaHora: 0, custo: 0 }
    a.projetos.add(ev.projetoId)
    a.cerimonias += F
    a.pessoaHora += (ev.dur / 60) * ev.participantes.length * F
    a.custo += custo * F
    m.set(k, a)
  }

  let total = 0
  sim.semanas.forEach((w) =>
    (cenario === "otm" ? w.otm : w.base).alocadas.forEach((ev) => {
      const pr = mundo.projetos[ev.projetoId]
      if (!pr) return
      const c = custoCerimonia(ev, cfg)
      total += c * F
      somar(cliente, clienteDe(pr), ev, c)
      somar(tipo, ev.tipo, ev, c)
      somar(fase, mundo.etapas[ev.fase]?.rotulo ?? ev.fase, ev, c)
      somar(volume, faixaVolume(totalProdutos(pr)), ev, c)
    })
  )

  const linhas = (m: Map<string, Acumulado>) =>
    [...m.entries()]
      .map(([chave, a]) => ({ chave, projetos: a.projetos.size, cerimonias: a.cerimonias, pessoaHora: a.pessoaHora, custo: a.custo }))
      .sort((x, y) => y.custo - x.custo)

  // no benchmark o denominador é a faixa inteira, inclusive projeto sem cerimônia no horizonte
  const porVolume: LinhaCusto[] = FAIXAS_VOLUME.map((faixa) => {
    const projs = mundo.projetos.filter((pr) => faixaVolume(totalProdutos(pr)) === faixa)
    const a = volume.get(faixa)
    return {
      chave: faixa,
      projetos: projs.length,
      produtos: projs.reduce((s, pr) => s + totalProdutos(pr), 0),
      cerimonias: a?.cerimonias ?? 0,
      pessoaHora: a?.pessoaHora ?? 0,
      custo: a?.custo ?? 0,
    }
  }).filter((l) => l.projetos > 0)

  return { total, porCliente: linhas(cliente), porTipo: linhas(tipo), porFase: linhas(fase), porVolume }
}
