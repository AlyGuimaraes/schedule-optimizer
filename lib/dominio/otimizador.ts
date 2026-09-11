import { posicaoNaSemana } from "./calendario"
import { almoco, livre, marcar, marcarBloqueios, novaOcupacao } from "./disponibilidade"
import { DIAS, GERAL_PADRAO, PERFIS } from "./padroes"
import { geralDe, premDe } from "./premissas"
import { membrosDoTime } from "./times"
import type {
  Cerimonia,
  Concessao,
  Config,
  Deficit,
  Health,
  Mundo,
  Ocupacao,
  Papel,
  Pessoa,
  PremissasGerais,
  ResultadoOtimizacao,
  TrocaCadeira,
} from "./tipos"

/** Penalidade de fragmentação do dia: tempo livre que não forma bloco de foco (§5). */
export function custoDia(
  oc: Ocupacao,
  p: number,
  d: number,
  blocoMin: number,
  G: PremissasGerais = GERAL_PADRAO
): { penal: number; foco: number; livres: number } {
  let blocos = 0
  let foco = 0
  let livres = 0
  let run = 0
  for (let t = G.inicio; t < G.fim; t++) {
    if (almoco(G, t)) {
      if (run >= blocoMin) foco += run
      if (run > 0) blocos++
      run = 0
      continue
    }
    if (oc[p][d][t] === null) {
      run++
      livres++
    } else {
      if (run >= blocoMin) foco += run
      if (run > 0) blocos++
      run = 0
    }
  }
  if (run >= blocoMin) foco += run
  if (run > 0) blocos++
  return { penal: livres - foco + blocos * 0.5, foco, livres }
}

/** Identidade de uma ocorrência entre execuções: projeto, cerimônia e semana do horizonte. */
export const chaveOcorrencia = (ev: Pick<Cerimonia, "projetoId" | "tipo">, semana: number) =>
  `${ev.projetoId}|${ev.tipo}|${semana}`

/** Identidade de uma série (todas as semanas), usada pelas âncoras. */
export const chaveSerie = (ev: Pick<Cerimonia, "projetoId" | "tipo">) => `${ev.projetoId}|${ev.tipo}`

/**
 * Solver em três camadas (§4.3):
 *   1. tudo dentro da premissa alvo
 *   2. rebalanceamento de cadeira, ainda dentro do alvo
 *   3. relaxamento controlado, só para cerimônia obrigatória e dentro da tolerância
 * O que não couber vira déficit estrutural em FTE por cargo.
 */
export function otimizar(
  demanda: Cerimonia[],
  pessoas: Pessoa[],
  cfg: Config,
  mundo?: Mundo
): ResultadoOtimizacao {
  const n = pessoas.length
  const oc = novaOcupacao(n)
  const PP = pessoas.map((p) => premDe(cfg, p.papel, cfg.excecoesPessoa?.[p.id]))
  const PF = PERFIS[cfg.perfil] || PERFIS.equilibrio
  const G = geralDe(cfg)
  const pref = new Set(G.preferidos)
  const acum = cfg.acumulado || new Array<number>(n).fill(0)
  const semanaIdx = cfg.semanaIdx || 1
  const tetoMes = (p: number) => (PP[p].maxHorasMes * semanaIdx) / 4.33
  const carga = new Array<number>(n).fill(0)
  const porDia = Array.from({ length: n }, () => new Array<number>(DIAS).fill(0))
  const hDia = Array.from({ length: n }, () => new Array<number>(DIAS).fill(0))
  const alocadas: Cerimonia[] = []
  const concessoes: Concessao[] = []

  // ausências e feriados da semana (E14): o dia sai da agenda da pessoa e o teto semanal encolhe
  // na mesma proporção. Sem calendário, `disp` é 1 para todos e nada muda.
  const indisp = cfg.calendario?.indisponivel?.[semanaIdx]
  const fora = (p: number, d: number) => !!indisp?.[p]?.[d]
  const disp = pessoas.map((_, p) => (DIAS - Object.keys(indisp?.[p] ?? {}).length) / DIAS)
  const teto = (p: number) => PP[p].teto * disp[p]
  // antecedência de 48h (§2.2): nas primeiras posições da semana 1 nada novo entra nem sai do lugar
  const congelado = semanaIdx === 1 ? (cfg.calendario?.congeladoAte ?? 0) : 0
  // agenda importada (E09): os compromissos de fora ocupam a grade antes de tudo. Assim `livre`
  // recusa a sobreposição e o intervalo obrigatório, e `custoDia` não conta esse tempo como foco.
  // Sem bloqueios, a ocupação nasce vazia como no protótipo.
  marcarBloqueios(oc, cfg.calendario?.bloqueios?.[semanaIdx])

  // nível 0 = premissa alvo; nível 1 = o máximo que o perfil autoriza ceder
  const tetoEf = (p: number, r: boolean) =>
    (r ? PP[p].teto + (PP[p].tetoMax - PP[p].teto) * PF.usaTolerancia : PP[p].teto) * disp[p]
  const reunEf = (p: number, r: boolean) => PP[p].maxReunioesDia + (r ? PF.extraReunioes : 0)
  const horasEf = (p: number, r: boolean) => PP[p].maxHorasDia + (r ? PF.extraHoras : 0)
  const janelaEf = (p: number, r: boolean) =>
    r && PF.cedeJanela ? Math.max(0, PP[p].focoProt - 2) : PP[p].focoProt
  const durEf = (p: number, r: boolean) => PP[p].duracaoMax + (r ? PF.extraDuracao : 0)

  // exceção do projeto (§2.1): janela combinada com o cliente e duração máxima própria
  const excProj = (ev?: Cerimonia) => (ev ? cfg.excecoesProjeto?.[ev.projetoId] : undefined)

  // toda restrição de cargo é avaliada participante a participante, e a mais restritiva vence (§4.2)
  function viavel(parts: number[], d: number, s: number, slots: number, h: number, r: boolean, ev?: Cerimonia) {
    const xp = excProj(ev)
    if (xp?.inicioMin !== undefined && s < xp.inicioMin) return false
    if (xp?.fimMax !== undefined && s + slots > xp.fimMax) return false
    for (const p of parts) {
      if (fora(p, d)) return false
      if (s < Math.max(G.inicio, janelaEf(p, r))) return false
      if (slots > (xp?.duracaoMax !== undefined ? xp.duracaoMax + (r ? PF.extraDuracao : 0) : durEf(p, r))) return false
      if (!livre(oc, p, d, s, slots, G, true)) return false
      if (porDia[p][d] + 1 > reunEf(p, r)) return false
      if (hDia[p][d] + h > horasEf(p, r) + 1e-9) return false
    }
    return true
  }

  function custo(parts: number[], d: number, s: number, slots: number, ev?: Cerimonia) {
    let c = 0
    parts.forEach((p) => {
      const antes = custoDia(oc, p, d, PP[p].blocoFocoMin, G).penal
      for (let i = 0; i < slots; i++) oc[p][d][s + i] = -1
      const depois = custoDia(oc, p, d, PP[p].blocoFocoMin, G).penal
      for (let i = 0; i < slots; i++) oc[p][d][s + i] = null
      c += (depois - antes) * PF.pesoFrag
      for (let i = 0; i < slots; i++) if (!pref.has(s + i)) c += G.pesoPreferencia
      c += porDia[p][d] === 0 ? 1.2 : 0.3 * porDia[p][d]
      const folga = teto(p) - carga[p]
      c += folga <= 0 ? 2.5 : Math.max(0, 1.4 - folga)
    })
    if (PF.ancorar && ev && d !== ev.projetoId % DIAS) c += 2.2
    // estabilidade (w6): sair do lugar do plano vigente tem custo; sem plano vigente, nada muda
    if (cfg.planoVigente && ev) {
      const v = cfg.planoVigente[chaveOcorrencia(ev, semanaIdx)]
      if (v && (v.dia !== d || v.slot !== s)) c += cfg.pesoEstabilidade ?? 3
    }
    // cerimônia com prazo curto é puxada para o começo da semana e do dia
    const urg = ev && ev.sla ? 2.4 : 0.02
    return c + s * (ev && ev.sla ? 0.06 : 0.01) + d * urg
  }

  function melhorSlot(parts: number[], slots: number, h: number, r: boolean, ev?: Cerimonia) {
    let m: { d: number; s: number; custo: number } | null = null
    for (let d = 0; d < DIAS; d++)
      for (let s = G.inicio; s + slots <= G.fim; s++) {
        if (posicaoNaSemana(d, s) < congelado) continue
        if (!viavel(parts, d, s, slots, h, r, ev)) continue
        const c = custo(parts, d, s, slots, ev)
        if (m === null || c < m.custo) m = { d, s, custo: c }
      }
    return m
  }

  /** Cada concessão vira registro auditável: pessoa, premissa, valor alvo e valor aplicado. */
  function registrar(ev: Cerimonia, parts: number[], d: number, s: number, h: number) {
    parts.forEach((p) => {
      const c = PP[p]
      const nome = pessoas[p].nome
      const cedidas: { premissa: string; alvo: number; valor: number; un: string }[] = []
      if (carga[p] + h > teto(p) + 1e-9)
        cedidas.push({ premissa: "teto de reunião", alvo: teto(p), valor: carga[p] + h, un: "h" })
      if (porDia[p][d] + 1 > c.maxReunioesDia)
        cedidas.push({ premissa: "máx. reuniões/dia", alvo: c.maxReunioesDia, valor: porDia[p][d] + 1, un: "" })
      if (hDia[p][d] + h > c.maxHorasDia + 1e-9)
        cedidas.push({ premissa: "máx. horas/dia", alvo: c.maxHorasDia, valor: hDia[p][d] + h, un: "h" })
      if (s < c.focoProt)
        cedidas.push({ premissa: "janela protegida", alvo: c.focoProt / 2, valor: s / 2, un: "h" })
      const durAlvo = excProj(ev)?.duracaoMax ?? c.duracaoMax
      if (ev.slots > durAlvo)
        cedidas.push({ premissa: "duração máx. da reunião", alvo: durAlvo / 2, valor: ev.slots / 2, un: "h" })
      cedidas.forEach((x) =>
        concessoes.push({
          evId: ev.id,
          pessoa: nome,
          pessoaId: p,
          papel: pessoas[p].papel,
          projeto: ev.projeto,
          cerimonia: ev.tipo,
          ...x,
        })
      )
    })
  }

  function confirmar(ev: Cerimonia, m: { d: number; s: number }, relaxado: boolean, camada: 1 | 2 | 3 = relaxado ? 3 : 1) {
    const h = ev.dur / 60
    if (relaxado) registrar(ev, ev.participantes, m.d, m.s, h)
    marcar(oc, ev, m.d, m.s)
    ev.relaxado = !!relaxado
    ev.camada = camada
    ev.participantes.forEach((p) => {
      carga[p] += h
      porDia[p][m.d]++
      hDia[p][m.d] += h
    })
    alocadas.push(ev)
  }

  // fila: prioridade da cerimônia corrigida pela urgência da etapa e pelo peso do cliente
  const risco: Record<Health, number> = { vermelho: 0, amarelo: 1, verde: 2 }
  const pesoUrg = PF.fila === "criticidade" ? 0.55 : 0.22
  const rank = (ev: Cerimonia) =>
    ev.prio -
    pesoUrg * ((ev.score || 4) / 3) -
    (PF.fila === "criticidade" ? (2 - risco[ev.health]) * 0.3 : 0)
  const ordem = [...demanda].sort(
    (a, b) =>
      rank(a) - rank(b) || b.participantes.length - a.participantes.length || b.dur - a.dur
  )

  // ---- âncoras: horário imposto pelo cliente é restrição rígida, alocado antes de tudo (§12) ----
  const ancoradas = new Set<number>()
  if (cfg.ancoras) {
    ordem.forEach((ev) => {
      const a = cfg.ancoras?.[chaveSerie(ev)]
      if (!a) return
      if (a.slot + ev.slots > G.fim) return
      if (ev.participantes.every((p) => !fora(p, a.dia) && livre(oc, p, a.dia, a.slot, ev.slots, G, true))) {
        confirmar(ev, { d: a.dia, s: a.slot }, false)
        ev.ancorada = true
        ancoradas.add(ev.id)
      }
    })
  }

  // ---- antecedência de 48h: o que o plano vigente já marcou na janela congelada fica onde está ----
  if (congelado > 0 && cfg.planoVigente) {
    ordem.forEach((ev) => {
      if (ancoradas.has(ev.id)) return
      const v = cfg.planoVigente?.[chaveOcorrencia(ev, semanaIdx)]
      if (!v || posicaoNaSemana(v.dia, v.slot) >= congelado || v.slot + ev.slots > G.fim) return
      // fica no lugar se ainda couber nas premissas de hoje; obrigatória pode usar a tolerância
      const h = ev.dur / 60
      const cabe = (r: boolean) =>
        ev.participantes.every(
          (p) => carga[p] + h <= tetoEf(p, r) + 1e-9 && acum[p] + carga[p] + h <= tetoMes(p) + 1e-9
        ) && viavel(ev.participantes, v.dia, v.slot, ev.slots, h, r, ev)
      if (cabe(false)) confirmar(ev, { d: v.dia, s: v.slot }, false)
      else if (ev.obrig && cabe(true)) confirmar(ev, { d: v.dia, s: v.slot }, true)
      else return
      ev.congelada = true
      ancoradas.add(ev.id)
    })
  }

  // ---- camada 1: tudo dentro da premissa alvo ----
  const sobra1: Cerimonia[] = []
  ordem.forEach((ev) => {
    if (ancoradas.has(ev.id)) return
    const h = ev.dur / 60
    if (
      ev.participantes.some(
        (p) =>
          carga[p] + h > tetoEf(p, false) + 1e-9 ||
          acum[p] + carga[p] + h > tetoMes(p) + 1e-9
      )
    ) {
      sobra1.push(ev)
      return
    }
    const m = melhorSlot(ev.participantes, ev.slots, h, false, ev)
    if (m) confirmar(ev, m, false)
    else sobra1.push(ev)
  })

  // ---- camada 2: troca de cadeira por outro do mesmo cargo com folga ----
  const trocas: { ev: Cerimonia; subs: TrocaCadeira[] }[] = []
  const sobra2: Cerimonia[] = []
  if (cfg.rebalancear !== false) {
    const porPapel: Record<Papel, number[]> = {}
    pessoas.forEach((p) => {
      ;(porPapel[p.papel] = porPapel[p.papel] || []).push(p.id)
    })
    const elegiveisDe = (ev: Cerimonia) => (mundo ? membrosDoTime(mundo, ev.timeId) : null)
    sobra1.forEach((ev) => {
      const h = ev.dur / 60
      const novos = ev.participantes.slice()
      const subs: TrocaCadeira[] = []
      ev.participantes.forEach((pid, i) => {
        if (carga[pid] + h <= teto(pid) + 1e-9 && acum[pid] + carga[pid] + h <= tetoMes(pid) + 1e-9)
          return
        const eleg = elegiveisDe(ev)
        const alt = (porPapel[ev.papeis[i]] || [])
          .filter(
            (x) =>
              novos.indexOf(x) < 0 &&
              (!eleg || eleg.indexOf(x) >= 0) &&
              carga[x] + h <= teto(x) - 0.3 &&
              acum[x] + carga[x] + h <= tetoMes(x) + 1e-9
          )
          .sort((a, b) => carga[a] / teto(a) - carga[b] / teto(b))[0]
        if (alt !== undefined) {
          subs.push({ de: pid, para: alt, papel: ev.papeis[i] })
          novos[i] = alt
        }
      })
      if (
        !subs.length ||
        novos.some(
          (p) => carga[p] + h > teto(p) + 1e-9 || acum[p] + carga[p] + h > tetoMes(p) + 1e-9
        )
      ) {
        sobra2.push(ev)
        return
      }
      const cand: Cerimonia = { ...ev, participantes: novos }
      const m = melhorSlot(novos, cand.slots, h, false, cand)
      if (m) {
        cand.trocas = subs
        confirmar(cand, m, false, 2)
        trocas.push({ ev: cand, subs })
      } else sobra2.push(ev)
    })
  } else sobra1.forEach((ev) => sobra2.push(ev))

  // ---- camada 3: relaxamento controlado, só para cerimônia obrigatória ----
  const adiadas: Cerimonia[] = []
  sobra2
    .sort((a, b) => a.prio - b.prio)
    .forEach((ev) => {
      const h = ev.dur / 60
      if (!ev.obrig) {
        adiadas.push({ ...ev, motivo: "opcional · sem folga no alvo" })
        return
      }
      if (ev.participantes.some((p) => acum[p] + carga[p] + h > tetoMes(p) + 1e-9)) {
        adiadas.push({ ...ev, motivo: "excede o teto mensal do cargo" })
        return
      }
      if (ev.participantes.some((p) => carga[p] + h > tetoEf(p, true) + 1e-9)) {
        adiadas.push({ ...ev, motivo: "excede o limite semanal aceitável" })
        return
      }
      const m = melhorSlot(ev.participantes, ev.slots, h, true, ev)
      if (m) confirmar(ev, m, true)
      else adiadas.push({ ...ev, motivo: "sem janela viável nem com tolerância" })
    })

  // ---- residual: o que não coube vira déficit estrutural em FTE por cargo ----
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
  const slaViolado = adiadas.filter((x) => x.sla)
  const obrigTotal = demanda.filter((x) => x.obrig).length
  const obrigAloc = alocadas.filter((x) => x.obrig).length
  const cobertura = {
    total: demanda.length ? +((alocadas.length / demanda.length) * 100).toFixed(1) : 100,
    obrigatoria: obrigTotal ? +((obrigAloc / obrigTotal) * 100).toFixed(1) : 100,
    relaxadas: alocadas.filter((x) => x.relaxado).length,
    sla: slaTotal ? +((slaAloc / slaTotal) * 100).toFixed(1) : 100,
    slaTotal,
    slaViolado,
  }

  // estabilidade do plano: quantas cerimônias comparáveis saíram do lugar do plano vigente
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
    oc,
    alocadas,
    adiadas,
    trocas,
    concessoes,
    deficit,
    cobertura,
    carga,
    acum,
    PP,
    perfil: PF,
    perfilId: cfg.perfil,
    estabilidade,
  }
}
