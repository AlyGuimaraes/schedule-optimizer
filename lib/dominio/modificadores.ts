import type { ItemPlaybook, Mundo, Papel, Projeto } from "./tipos"

// Modificadores automáticos do playbook (§3.3). Só entram quando a configuração liga
// `modificadores`; desligados, a demanda é exatamente a do protótipo.

/** O cargo para quem a sala de guerra escala. */
export const PAPEL_ESCALA: Papel = "Líder Técnico"
/** O cargo que conduz o checkpoint executivo mensal dos clientes prioritários. */
export const PAPEL_CHECKPOINT: Papel = "Gerente de Projeto"

const totalProdutos = (pr: Projeto) => pr.produtos.relatorios + pr.produtos.dashboards + pr.produtos.integracoes
const ehStatus = (c: ItemPlaybook) => c.tipo.startsWith("Status Report")
const ehValidacao = (c: ItemPlaybook) => c.tipo.startsWith("Validação")

export function medianaProdutos(mundo: Mundo): number {
  const v = mundo.projetos.map(totalProdutos).sort((a, b) => a - b)
  if (!v.length) return 0
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** Quem participa da sala de guerra: os cargos do status report da fase, escalando ao Líder Técnico. */
export function papeisSalaDeGuerra(mundo: Mundo, fase: string): Papel[] {
  const itens = mundo.playbook[fase] ?? []
  const base = itens.find(ehStatus)?.papeis ?? itens[0]?.papeis ?? []
  return [...new Set([...base, PAPEL_ESCALA])]
}

/** Cargos que os modificadores acrescentam ao squad do projeto. */
export function papeisModificadores(mundo: Mundo, pr: Projeto): Papel[] {
  const extra: Papel[] = []
  if (pr.health === "vermelho") extra.push(...papeisSalaDeGuerra(mundo, pr.fase))
  if (pr.prioridade === "alta") extra.push(PAPEL_CHECKPOINT)
  return extra
}

/**
 * Playbook do projeto com os modificadores do §3.3:
 *   volume de produtos: mais uma sessão de validação a cada 3 produtos acima da mediana
 *   health amarelo: status report passa a ser semanal
 *   health vermelho: sala de guerra semanal, escalada ao Líder Técnico
 *   cliente de prioridade alta: checkpoint executivo mensal, em todas as fases
 *   atraso acima de 10 dias: dobra a cadência do status report
 * Cada cerimônia acrescentada ou alterada carrega a `origem`, mostrada na interface.
 */
export function itensDoProjeto(mundo: Mundo, pr: Projeto, mediana: number): ItemPlaybook[] {
  const base = mundo.playbook[pr.fase] ?? []
  const atrasado = (pr.atrasoDias ?? 0) > 10

  const itens: ItemPlaybook[] = base.map((c) => {
    if (!ehStatus(c)) return c
    let cada = c.cada
    let origem = c.origem
    if (pr.health === "amarelo" && cada > 1) {
      cada = 1
      origem = "health amarelo"
    }
    if (atrasado && cada > 1) {
      cada = Math.max(1, Math.floor(cada / 2))
      origem = origem ?? "atraso de cronograma"
    }
    return cada === c.cada ? c : { ...c, cada, origem }
  })

  const excedente = totalProdutos(pr) - mediana
  if (excedente >= 3) {
    const extras = Math.floor(excedente / 3)
    base.filter(ehValidacao).forEach((c) => {
      for (let i = 1; i <= extras; i++)
        itens.push({ ...c, tipo: `${c.tipo} extra${extras > 1 ? ` ${i}` : ""}`, origem: "volume de produtos" })
    })
  }

  if (pr.health === "vermelho")
    itens.push({
      tipo: "Sala de Guerra",
      dur: 60,
      cada: 1,
      papeis: papeisSalaDeGuerra(mundo, pr.fase),
      obrig: true,
      prio: 1,
      origem: "health vermelho",
    })

  if (pr.prioridade === "alta")
    itens.push({
      tipo: "Checkpoint Executivo",
      dur: 45,
      cada: 4,
      papeis: [PAPEL_CHECKPOINT],
      obrig: true,
      prio: 2,
      origem: "cliente prioridade alta",
    })

  return itens
}
