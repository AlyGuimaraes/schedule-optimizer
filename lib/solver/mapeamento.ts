// Tradução entre o motor de domínio e o contrato do solver CP-SAT. Funções puras, sem rede e sem
// segredo: servem ao cliente do servidor (cliente.ts), ao script de comparação e aos testes.

import {
  chaveOcorrencia,
  chaveSerie,
  DIAS,
  geralDe,
  marcar,
  membrosDoTime,
  novaOcupacao,
  PERFIS,
  premDe,
  SLOTS_DIA,
  type Cerimonia,
  type Concessao,
  type Config,
  type Deficit,
  type Mundo,
  type Ocupacao,
  type Papel,
  type Perfil,
  type Pessoa,
  type ResultadoOtimizacao,
  type TrocaCadeira,
} from "@/lib/dominio"

import { VERSAO_CONTRATO } from "./contrato"
import type * as C from "./contrato"

export interface ExtrasRequisicao {
  /** solução gulosa da mesma semana: vira warm start (`AddHint`) e referência do objetivo */
  dica?: ResultadoOtimizacao
  opcoes?: C.Opcoes
}

/**
 * Premissas da pessoa já resolvidas: cargo com a exceção dela (§2.1), no alvo e no máximo que o
 * perfil autoriza ceder, com as mesmas fórmulas de `otimizar` e de `validarPlano`. Os limites em
 * slots e em contagem são arredondados na direção da regra, porque início, duração e número de
 * reuniões são inteiros: `slot ≥ janela` equivale a `slot ≥ ⌈janela⌉` e `slots ≤ máx` a `slots ≤ ⌊máx⌋`.
 */
function pessoaDoContrato(p: Pessoa, cfg: Config, PF: Perfil, semana: number, acumulado: number): C.Pessoa {
  const c = premDe(cfg, p.papel, cfg.excecoesPessoa?.[p.id])
  const janelaRelaxada = PF.cedeJanela ? Math.max(0, c.focoProt - 2) : c.focoProt
  return {
    id: p.id,
    nome: p.nome,
    papel: p.papel,
    acumulado,
    premissas: {
      teto: c.teto,
      tetoRelaxado: c.teto + (c.tetoMax - c.teto) * PF.usaTolerancia,
      maxReunioesDia: Math.floor(c.maxReunioesDia),
      maxReunioesDiaRelaxado: Math.floor(c.maxReunioesDia + PF.extraReunioes),
      maxHorasDia: c.maxHorasDia,
      maxHorasDiaRelaxado: c.maxHorasDia + PF.extraHoras,
      focoProt: Math.max(0, Math.ceil(c.focoProt)),
      focoProtRelaxado: Math.max(0, Math.ceil(janelaRelaxada)),
      duracaoMax: Math.max(0, Math.floor(c.duracaoMax)),
      duracaoMaxRelaxada: Math.max(0, Math.floor(c.duracaoMax + PF.extraDuracao)),
      blocoFocoMin: Math.max(0, Math.ceil(c.blocoFocoMin)),
      orcamentoMensal: (c.maxHorasMes * semana) / 4.33,
    },
  }
}

/** Requisição de uma semana a partir dos objetos do domínio, na mesma forma que `otimizar` recebe. */
export function montarRequisicao(
  demanda: Cerimonia[],
  pessoas: Pessoa[],
  cfg: Config,
  mundo?: Mundo,
  extras: ExtrasRequisicao = {}
): C.RequisicaoSemana {
  const G = geralDe(cfg)
  const PF = PERFIS[cfg.perfil] || PERFIS.equilibrio
  const semana = cfg.semanaIdx || 1
  const acum = cfg.acumulado || []
  const permitirTroca = cfg.rebalancear !== false

  // camada 2 como no guloso: mesmo cargo, fora da cerimônia e, com o mundo, só gente do time
  const porPapel: Record<Papel, number[]> = {}
  pessoas.forEach((p) => {
    ;(porPapel[p.papel] = porPapel[p.papel] || []).push(p.id)
  })
  const candidatos = (ev: Cerimonia, papel: Papel) => {
    if (!permitirTroca) return []
    const eleg = mundo ? membrosDoTime(mundo, ev.timeId) : null
    return (porPapel[papel] ?? []).filter(
      (x) => !ev.participantes.includes(x) && (!eleg || eleg.includes(x))
    )
  }

  const cerimonias: C.Cerimonia[] = demanda.map((ev) => {
    const ancora = cfg.ancoras?.[chaveSerie(ev)]
    const vigente = cfg.planoVigente?.[chaveOcorrencia(ev, semana)]
    return {
      id: ev.id,
      projetoId: ev.projetoId,
      projeto: ev.projeto,
      tipo: ev.tipo,
      dur: ev.dur,
      slots: ev.slots,
      cadeiras: ev.participantes.map((pid, i) => ({
        papel: ev.papeis[i],
        titular: pid,
        candidatos: candidatos(ev, ev.papeis[i]),
      })),
      obrigatoria: ev.obrig,
      prio: ev.prio,
      sla: ev.sla,
      score: ev.score,
      ...(ancora ? { ancora: { dia: ancora.dia, slot: ancora.slot } } : {}),
      ...(vigente ? { vigente: { dia: vigente.dia, slot: vigente.slot } } : {}),
    }
  })

  const req: C.RequisicaoSemana = {
    versao: VERSAO_CONTRATO,
    semana,
    grade: { dias: DIAS, slotsDia: SLOTS_DIA },
    geral: {
      inicio: G.inicio,
      fim: G.fim,
      almocoInicio: G.almocoInicio,
      almocoDur: G.almocoDur,
      buffer: G.buffer,
      preferidos: [...G.preferidos],
      pesoPreferencia: G.pesoPreferencia,
      diaProtegido: G.diaProtegido,
    },
    perfil: { id: cfg.perfil, pesoFrag: PF.pesoFrag, ancorar: PF.ancorar },
    pesoEstabilidade: cfg.pesoEstabilidade ?? 3,
    permitirTroca,
    permitirRelaxar: true,
    pessoas: pessoas.map((p) => pessoaDoContrato(p, cfg, PF, semana, acum[p.id] ?? 0)),
    cerimonias,
  }
  if (extras.dica) {
    req.dica = extras.dica.alocadas
      .filter((ev) => ev.dia !== undefined && ev.slot !== undefined)
      .map((ev) => ({
        cerimoniaId: ev.id,
        dia: ev.dia as number,
        slot: ev.slot as number,
        relaxada: !!ev.relaxado,
        participantes: [...ev.participantes],
      }))
  }
  if (extras.opcoes) req.opcoes = extras.opcoes
  return req
}

interface Parcial {
  oc: Ocupacao
  alocadas: Cerimonia[]
  adiadas: Cerimonia[]
  trocas: ResultadoOtimizacao["trocas"]
  concessoes: Concessao[]
  carga: number[]
}

/**
 * Déficit, cobertura e estabilidade calculados exatamente como no fim de `otimizar`, para que o
 * resultado do CP-SAT seja comparável ao do guloso em todas as telas.
 */
export function consolidar(
  demanda: Cerimonia[],
  parcial: Parcial,
  pessoas: Pessoa[],
  cfg: Config
): ResultadoOtimizacao {
  const { alocadas, adiadas } = parcial
  const PF = PERFIS[cfg.perfil] || PERFIS.equilibrio
  const semanaIdx = cfg.semanaIdx || 1

  const deficit: Record<Papel, Deficit> = {}
  adiadas.forEach((ev) =>
    ev.papeis.forEach((pp) => {
      deficit[pp] = deficit[pp] || { horas: 0, cerimonias: 0, obrigatorias: 0, fte: 0, horasObrig: 0, fteObrig: 0 }
      deficit[pp].horas += ev.dur / 60
      deficit[pp].cerimonias++
      if (ev.obrig) deficit[pp].obrigatorias++
    })
  )
  adiadas.forEach((ev) => {
    if (ev.obrig)
      ev.papeis.forEach((pp) => {
        deficit[pp].horasObrig = (deficit[pp].horasObrig || 0) + ev.dur / 60
      })
  })
  Object.keys(deficit).forEach((pp) => {
    const c = premDe(cfg, pp)
    deficit[pp].horasObrig = deficit[pp].horasObrig || 0
    deficit[pp].fte = c.teto > 0 ? +(deficit[pp].horas / c.teto).toFixed(2) : 0
    deficit[pp].fteObrig = c.teto > 0 ? +(deficit[pp].horasObrig / c.teto).toFixed(2) : 0
  })

  const slaTotal = demanda.filter((x) => x.sla).length
  const slaAloc = alocadas.filter((x) => x.sla).length
  const obrigTotal = demanda.filter((x) => x.obrig).length
  const obrigAloc = alocadas.filter((x) => x.obrig).length
  const cobertura = {
    total: demanda.length ? +((alocadas.length / demanda.length) * 100).toFixed(1) : 100,
    obrigatoria: obrigTotal ? +((obrigAloc / obrigTotal) * 100).toFixed(1) : 100,
    relaxadas: alocadas.filter((x) => x.relaxado).length,
    sla: slaTotal ? +((slaAloc / slaTotal) * 100).toFixed(1) : 100,
    slaTotal,
    slaViolado: adiadas.filter((x) => x.sla),
  }

  let estabilidade: ResultadoOtimizacao["estabilidade"]
  if (cfg.planoVigente) {
    let comparaveis = 0
    let movidas = 0
    alocadas.forEach((ev) => {
      const v = cfg.planoVigente?.[chaveOcorrencia(ev, semanaIdx)]
      if (!v) return
      comparaveis++
      if (v.dia !== ev.dia || v.slot !== ev.slot) {
        movidas++
        ev.movida = true
      }
    })
    estabilidade = { comparaveis, movidas, pct: comparaveis ? +((1 - movidas / comparaveis) * 100).toFixed(1) : 100 }
  }

  return {
    ...parcial,
    deficit,
    cobertura,
    acum: cfg.acumulado || new Array<number>(pessoas.length).fill(0),
    PP: pessoas.map((p) => premDe(cfg, p.papel, cfg.excecoesPessoa?.[p.id])),
    perfil: PF,
    perfilId: cfg.perfil,
    estabilidade,
  }
}

/** Resposta do solver de volta para `ResultadoOtimizacao`. Lança erro se a resposta sair do contrato. */
export function mapearResposta(
  resp: C.RespostaSemana,
  demanda: Cerimonia[],
  pessoas: Pessoa[],
  cfg: Config
): ResultadoOtimizacao {
  const porId = new Map(demanda.map((ev) => [ev.id, ev]))
  const origem = (id: number) => {
    const ev = porId.get(id)
    if (!ev) throw new Error(`cerimônia ${id} não está na demanda da semana`)
    return ev
  }
  const pessoaValida = (id: number) => {
    if (!Number.isInteger(id) || id < 0 || id >= pessoas.length) throw new Error(`pessoa ${id} fora do cadastro`)
    return pessoas[id]
  }

  const oc = novaOcupacao(pessoas.length)
  const carga = new Array<number>(pessoas.length).fill(0)
  const alocadas: Cerimonia[] = []
  const trocas: ResultadoOtimizacao["trocas"] = []
  const vistas = new Set<number>()

  resp.alocadas.forEach((a) => {
    const base = origem(a.cerimoniaId)
    if (vistas.has(base.id)) throw new Error(`cerimônia ${base.id} alocada duas vezes`)
    vistas.add(base.id)
    if (a.participantes.length !== base.participantes.length)
      throw new Error(`cerimônia ${base.id} voltou sem o quórum da demanda`)
    if (a.dia < 0 || a.dia >= DIAS || a.slot < 0 || a.slot + base.slots > SLOTS_DIA)
      throw new Error(`cerimônia ${base.id} fora da grade`)
    a.participantes.forEach(pessoaValida)

    const ev: Cerimonia = {
      ...base,
      participantes: [...a.participantes],
      relaxado: a.relaxada,
      camada: a.camada,
    }
    if (a.ancorada) ev.ancorada = true
    if (a.trocas.length) {
      const subs: TrocaCadeira[] = a.trocas.map((t) => ({ de: t.de, para: t.para, papel: t.papel }))
      ev.trocas = subs
      trocas.push({ ev, subs })
    }
    marcar(oc, ev, a.dia, a.slot)
    ev.participantes.forEach((p) => {
      carga[p] += ev.dur / 60
    })
    alocadas.push(ev)
  })

  const motivos = new Map(resp.naoAlocadas.map((n) => [n.cerimoniaId, n.motivo]))
  const adiadas = demanda
    .filter((ev) => !vistas.has(ev.id))
    .sort((a, b) => a.prio - b.prio)
    .map((ev) => ({ ...ev, motivo: motivos.get(ev.id) ?? "sem resposta do solver" }))

  const concessoes: Concessao[] = resp.concessoes.map((c) => {
    const ev = origem(c.cerimoniaId)
    const p = pessoaValida(c.pessoaId)
    return {
      evId: ev.id,
      pessoa: p.nome,
      pessoaId: p.id,
      papel: p.papel,
      projeto: ev.projeto,
      cerimonia: ev.tipo,
      premissa: c.premissa,
      alvo: c.alvo,
      valor: c.valor,
      un: c.un,
    }
  })

  return consolidar(demanda, { oc, alocadas, adiadas, trocas, concessoes, carga }, pessoas, cfg)
}
