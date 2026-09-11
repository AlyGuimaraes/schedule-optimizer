import { custoDia } from "./otimizador"
import { almoco } from "./disponibilidade"
import { DIAS } from "./padroes"
import { geralDe, premDe } from "./premissas"
import type { Cerimonia, Config, KpiCenario, KpiPessoa, Ocupacao, Pessoa } from "./tipos"

/**
 * Indicadores por pessoa e do cenário (§5 e §6):
 *   taxa de reunião τ = R / Cl · tempo produtivo π = 1 − τ · fragmentação φ = 1 − F / L
 */
export function kpis(
  oc: Ocupacao,
  alocadas: Cerimonia[],
  pessoas: Pessoa[],
  cfg?: Partial<Config>
): KpiCenario {
  const G = geralDe(cfg)
  const porPessoa: KpiPessoa[] = pessoas.map((p) => {
    const c = premDe(cfg, p.papel)
    let horas = 0
    let reunioes = 0
    let foco = 0
    let livres = 0
    let blocosFoco = 0
    const dias = new Set<number>()
    for (let d = 0; d < DIAS; d++) {
      const r = custoDia(oc, p.id, d, c.blocoFocoMin, G)
      foco += r.foco
      livres += r.livres
      let run = 0
      for (let t = G.inicio; t < G.fim; t++) {
        if (almoco(G, t)) {
          if (run >= c.blocoFocoMin) blocosFoco++
          run = 0
          continue
        }
        if (oc[p.id][d][t] === null) run++
        else {
          if (run >= c.blocoFocoMin) blocosFoco++
          run = 0
        }
      }
      if (run >= c.blocoFocoMin) blocosFoco++
    }
    alocadas.forEach((ev) => {
      if (ev.participantes.includes(p.id)) {
        horas += ev.dur / 60
        reunioes++
        dias.add(ev.dia as number)
      }
    })
    const tx = horas / c.Cl
    return {
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      iniciais: p.iniciais,
      Cl: +c.Cl.toFixed(2),
      teto: +c.teto.toFixed(2),
      tetoPct: 100 - c.produtivoMin,
      produtivoMin: c.produtivoMin,
      horas: +horas.toFixed(2),
      reunioes,
      taxa: +(tx * 100).toFixed(1),
      produtivo: +((1 - tx) * 100).toFixed(1),
      folga: +(c.teto - horas).toFixed(2),
      blocosFoco,
      frag: livres > 0 ? +(1 - foco / livres).toFixed(2) : 0,
      diasComReuniao: dias.size,
      tetoMax: +c.tetoMax.toFixed(2),
      tolerancia: c.tolerancia,
      tetoAlvo: +c.tetoAlvo.toFixed(2),
      maxHorasSemana: c.maxHorasSemana,
      maxHorasMes: c.maxHorasMes,
      limitadoPorHoras: c.limitadoPorHoras,
      acimaTeto: horas > c.teto + 1e-9,
      acimaLimite: horas > c.tetoMax + 1e-9,
      noAlvo: horas <= c.teto + 1e-9,
    }
  })

  const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
  return {
    porPessoa,
    ClMedio: +media(porPessoa.map((x) => x.Cl)).toFixed(1),
    tetoMedio: +media(porPessoa.map((x) => x.teto)).toFixed(1),
    produtivoMedio: +media(porPessoa.map((x) => x.produtivo)).toFixed(1),
    alvoMedio: +media(porPessoa.map((x) => x.produtivoMin)).toFixed(1),
    taxaMedia: +media(porPessoa.map((x) => x.taxa)).toFixed(1),
    horasTotais: +porPessoa.reduce((s, x) => s + x.horas, 0).toFixed(1),
    reunioesTotais: alocadas.length,
    blocosFocoMedio: +media(porPessoa.map((x) => x.blocosFoco)).toFixed(1),
    fragMedia: +media(porPessoa.map((x) => x.frag)).toFixed(2),
    acimaTeto: porPessoa.filter((x) => x.acimaTeto).length,
    acimaLimite: porPessoa.filter((x) => x.acimaLimite).length,
    aderencia: +((porPessoa.filter((x) => x.noAlvo).length / porPessoa.length) * 100).toFixed(1),
  }
}
