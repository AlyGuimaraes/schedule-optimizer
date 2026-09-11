import type { Cerimonia, KpiCenario, Simulacao } from "@/lib/dominio"

// Recorte comparável da simulação: tudo que o produto usa em tela.
const chaveCerimonia = (ev: Cerimonia) =>
  `${ev.id}|d${ev.dia}|s${ev.slot}|${ev.participantes.join("-")}|${ev.relaxado ? "cedida" : "alvo"}`

function kpiResumo(k: KpiCenario) {
  return {
    agregado: [
      k.ClMedio, k.tetoMedio, k.produtivoMedio, k.alvoMedio, k.taxaMedia, k.horasTotais,
      k.reunioesTotais, k.blocosFocoMedio, k.fragMedia, k.acimaTeto, k.acimaLimite, k.aderencia,
    ],
    pessoas: k.porPessoa.map((p) => [
      p.id, p.horas, p.reunioes, p.taxa, p.produtivo, p.folga, p.blocosFoco, p.frag,
      p.diasComReuniao, p.acimaTeto, p.acimaLimite, p.noAlvo,
    ]),
  }
}

export function resumo(sim: Simulacao) {
  return {
    semanas: sim.semanas.map((w) => ({
      semana: w.semana,
      demanda: w.demanda.length,
      base: {
        alocadas: w.base.alocadas.map(chaveCerimonia).sort(),
        naoAlocadas: w.base.naoAlocadas.map((e) => e.id).sort((a, b) => a - b),
        kpi: kpiResumo(w.base.kpi),
      },
      otm: {
        alocadas: w.otm.alocadas.map(chaveCerimonia).sort(),
        adiadas: w.otm.adiadas.map((a) => `${a.id}|${a.motivo}`).sort(),
        concessoes: w.otm.concessoes
          .map((c) => `${c.pessoaId}|${c.premissa}|${c.alvo}|${c.valor}|${c.cerimonia}`)
          .sort(),
        trocas: w.otm.trocas
          .map((t) => `${t.ev.id}|${t.subs.map((s) => `${s.papel}:${s.de}>${s.para}`).join(",")}`)
          .sort(),
        deficit: Object.entries(w.otm.deficit)
          .map(([k, d]) => `${k}|${d.horas}|${d.cerimonias}|${d.obrigatorias}|${d.fte}|${d.fteObrig}`)
          .sort(),
        cobertura: {
          total: w.otm.cobertura.total,
          obrigatoria: w.otm.cobertura.obrigatoria,
          relaxadas: w.otm.cobertura.relaxadas,
          sla: w.otm.cobertura.sla,
          slaTotal: w.otm.cobertura.slaTotal,
          slaViolado: w.otm.cobertura.slaViolado.map((x) => x.id).sort((a, b) => a - b),
        },
        kpi: kpiResumo(w.otm.kpi),
      },
    })),
    mes: sim.mes,
  }
}
