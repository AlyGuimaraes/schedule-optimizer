import { posicaoNaSemana } from "./calendario"
import { almoco, diaBloqueado } from "./disponibilidade"
import { chaveOcorrencia } from "./otimizador"
import { DIAS, PERFIS } from "./padroes"
import { geralDe, premDe } from "./premissas"
import type { Cerimonia, Config, Mundo, Pessoa, ResultadoOtimizacao } from "./tipos"

export interface Violacao {
  regra: string
  descricao: string
  pessoa?: string
  cerimonia?: string
  valor?: number
  limite?: number
}

/**
 * Validador independente das restrições rígidas do §4.1 (R1 a R13). Roda sobre qualquer plano,
 * venha do solver guloso ou do CP-SAT, e é o que sustenta o critério 3 do MVP.
 */
export function validarPlano(
  resultado: ResultadoOtimizacao,
  demanda: Cerimonia[],
  pessoas: Pessoa[],
  cfg: Config,
  mundo?: Mundo,
  /**
   * `conferirTime` checa a regra §2.0 (o squad só usa gente do time). Fica desligada por padrão
   * porque a semente do protótipo já nasce violando: `construirMundo` sorteia as cadeiras por cargo
   * sem filtrar pelo time. Ver defeito 15 em docs/PLANO-DE-EXECUCAO.md, corrigido na E03.
   */
  opcoes: { conferirTime?: boolean } = {}
): Violacao[] {
  const v: Violacao[] = []
  const G = geralDe(cfg)
  const PF = PERFIS[cfg.perfil] || PERFIS.equilibrio
  // premissas da pessoa: as do cargo com as exceções dela (§2.1)
  const prem = (id: number) => premDe(cfg, pessoas[id].papel, cfg.excecoesPessoa?.[id])
  const nome = (id: number) => pessoas[id]?.nome ?? `pessoa ${id}`
  const acum = resultado.acum ?? new Array<number>(pessoas.length).fill(0)
  const semanaIdx = cfg.semanaIdx || 1

  // R1: cada cerimônia aparece no máximo uma vez
  const vistas = new Set<number>()
  resultado.alocadas.forEach((ev) => {
    if (vistas.has(ev.id))
      v.push({ regra: "R1", descricao: "cerimônia alocada mais de uma vez", cerimonia: ev.tipo })
    vistas.add(ev.id)
  })

  // R12: quórum de 100% dos cargos obrigatórios
  const porId = new Map(demanda.map((d) => [d.id, d]))
  resultado.alocadas.forEach((ev) => {
    const origem = porId.get(ev.id)
    if (origem && ev.participantes.length !== origem.papeis.length)
      v.push({ regra: "R12", descricao: "quórum diferente do exigido pelo playbook", cerimonia: ev.tipo })
  })

  // ocupação reconstruída a partir do plano
  const ocupado = new Map<string, number>()
  const porPessoaDia = new Map<string, { reunioes: number; horas: number }>()
  const horasSemana = new Array<number>(pessoas.length).fill(0)

  resultado.alocadas.forEach((ev) => {
    const d = ev.dia as number
    const s = ev.slot as number
    const h = ev.dur / 60
    const relaxada = !!ev.relaxado
    const xp = cfg.excecoesProjeto?.[ev.projetoId]

    // §2.1: janela combinada com o cliente do projeto
    if ((xp?.inicioMin !== undefined && s < xp.inicioMin) || (xp?.fimMax !== undefined && s + ev.slots > xp.fimMax))
      v.push({ regra: "§2.1", descricao: "fora da janela combinada com o cliente", cerimonia: ev.tipo })

    ev.participantes.forEach((p) => {
      const c = prem(p)

      // R4: janela de trabalho e almoço
      if (s < G.inicio || s + ev.slots > G.fim)
        v.push({ regra: "R4", descricao: "fora da janela de trabalho", pessoa: nome(p), cerimonia: ev.tipo })
      for (let i = 0; i < ev.slots; i++)
        if (almoco(G, s + i))
          v.push({ regra: "R4", descricao: "sobre o horário de almoço", pessoa: nome(p), cerimonia: ev.tipo })

      // R13: dia protegido
      if (diaBloqueado(G, d, s, ev.slots))
        v.push({ regra: "R13", descricao: "cai em dia protegido", pessoa: nome(p), cerimonia: ev.tipo })

      // R3: sem sobreposição, e R5: intervalo obrigatório
      for (let i = -G.buffer; i < ev.slots + G.buffer; i++) {
        const t = s + i
        if (t < G.inicio || t >= G.fim || almoco(G, t)) continue
        const chave = `${p}|${d}|${t}`
        const dono = ocupado.get(chave)
        const dentro = i >= 0 && i < ev.slots
        if (dono !== undefined && dono !== ev.id) {
          v.push({
            regra: dentro ? "R3" : "R5",
            descricao: dentro ? "duas cerimônias no mesmo horário" : "sem o intervalo obrigatório entre cerimônias",
            pessoa: nome(p),
            cerimonia: ev.tipo,
          })
        }
        if (dentro) ocupado.set(chave, ev.id)
      }

      // R6: janela protegida do cargo
      const janela = relaxada && PF.cedeJanela ? Math.max(0, c.focoProt - 2) : c.focoProt
      if (s < Math.max(G.inicio, janela))
        v.push({ regra: "R6", descricao: "invade a janela protegida", pessoa: nome(p), cerimonia: ev.tipo, valor: s, limite: janela })

      // R7: duração máxima da cerimônia para o cargo
      const durMax = (xp?.duracaoMax ?? c.duracaoMax) + (relaxada ? PF.extraDuracao : 0)
      if (ev.slots > durMax)
        v.push({ regra: "R7", descricao: "cerimônia mais longa que o máximo do cargo", pessoa: nome(p), cerimonia: ev.tipo, valor: ev.slots / 2, limite: durMax / 2 })

      const chaveDia = `${p}|${d}`
      const dia = porPessoaDia.get(chaveDia) ?? { reunioes: 0, horas: 0 }
      dia.reunioes++
      dia.horas += h
      porPessoaDia.set(chaveDia, dia)
      horasSemana[p] += h
    })
  })

  // R8 e R9: limites diários por cargo
  porPessoaDia.forEach((dia, chave) => {
    const p = Number(chave.split("|")[0])
    const c = prem(p)
    const temRelaxada = resultado.alocadas.some(
      (ev) => ev.relaxado && ev.participantes.includes(p) && ev.dia === Number(chave.split("|")[1])
    )
    const maxReunioes = c.maxReunioesDia + (temRelaxada ? PF.extraReunioes : 0)
    const maxHoras = c.maxHorasDia + (temRelaxada ? PF.extraHoras : 0)
    if (dia.reunioes > maxReunioes)
      v.push({ regra: "R8", descricao: "reuniões no dia acima do máximo do cargo", pessoa: nome(p), valor: dia.reunioes, limite: maxReunioes })
    if (dia.horas > maxHoras + 1e-9)
      v.push({ regra: "R9", descricao: "horas no dia acima do máximo do cargo", pessoa: nome(p), valor: dia.horas, limite: maxHoras })
  })

  // R10 e R11: teto semanal efetivo e orçamento mensal pró-rata
  pessoas.forEach((p) => {
    const c = prem(p.id)
    const temRelaxada = resultado.alocadas.some((ev) => ev.relaxado && ev.participantes.includes(p.id))
    const teto = temRelaxada ? c.teto + (c.tetoMax - c.teto) * PF.usaTolerancia : c.teto
    if (horasSemana[p.id] > teto + 1e-9)
      v.push({ regra: "R10", descricao: "horas na semana acima do teto efetivo", pessoa: p.nome, valor: horasSemana[p.id], limite: teto })
    const orcamento = (c.maxHorasMes * semanaIdx) / 4.33
    if (acum[p.id] + horasSemana[p.id] > orcamento + 1e-9)
      v.push({ regra: "R11", descricao: "acumulado acima do orçamento mensal pró-rata", pessoa: p.nome, valor: acum[p.id] + horasSemana[p.id], limite: orcamento })
  })

  // Ausências e feriados (E14): ninguém é convocado num dia em que está fora
  const indisp = cfg.calendario?.indisponivel?.[semanaIdx]
  if (indisp)
    resultado.alocadas.forEach((ev) =>
      ev.participantes.forEach((p) => {
        const motivo = indisp[p]?.[ev.dia as number]
        if (motivo)
          v.push({ regra: "§2.1", descricao: `convocada num dia de ausência (${motivo})`, pessoa: nome(p), cerimonia: ev.tipo })
      })
    )

  // Antecedência de 48h (§2.2): na janela congelada só fica o que já estava no plano vigente
  const congelado = semanaIdx === 1 ? (cfg.calendario?.congeladoAte ?? 0) : 0
  if (congelado > 0)
    resultado.alocadas.forEach((ev) => {
      if (ev.ancorada || posicaoNaSemana(ev.dia as number, ev.slot as number) >= congelado) return
      const v0 = cfg.planoVigente?.[chaveOcorrencia(ev, semanaIdx)]
      if (!v0 || v0.dia !== ev.dia || v0.slot !== ev.slot)
        v.push({ regra: "§2.2", descricao: "alocada ou movida a menos de 48h do início", cerimonia: ev.tipo })
    })

  // R2 é objetivo, não invariante: o que não coube é reportado como déficit, não como violação.
  if (mundo && opcoes.conferirTime) {
    resultado.alocadas.forEach((ev) => {
      const time = mundo.times.find((t) => t.id === ev.timeId)
      if (!time) return
      ev.participantes.forEach((p) => {
        if (!time.membros.includes(p))
          v.push({ regra: "§2.0", descricao: "participante fora do time do projeto", pessoa: nome(p), cerimonia: ev.tipo })
      })
    })
  }

  return v
}

/** Blocos de foco por pessoa na semana, para o critério 4 do MVP. */
export function blocosDeFocoPorPessoa(resultado: ResultadoOtimizacao, pessoas: Pessoa[], cfg: Config) {
  const kpi = resultado.kpi
  if (!kpi) return []
  return kpi.porPessoa.map((p) => ({ pessoa: p.nome, blocos: p.blocosFoco, minimo: premDe(cfg, p.papel).blocoFocoMin / 2 }))
}

export const DIAS_UTEIS = DIAS
