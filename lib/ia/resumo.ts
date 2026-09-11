import {
  PERFIS,
  etapaDe,
  geralDe,
  premDe,
  type Config,
  type KpiCenario,
  type Mundo,
  type Papel,
  type Simulacao,
} from "@/lib/dominio"

import type { ContextoOperacao, Indicadores, ResumoExecucao } from "./entradas"

// Funções puras que transformam o estado da tela em entrada dos agentes. Rodam no cliente (a
// leitura determinística do Otimizador) e no servidor (o Narrador), sem estado global.

interface Base {
  mundo: Mundo
  config: Config
  /** cargos na ordem cadastrada (`papeisDe`) */
  papeis: Papel[]
}

const indicadores = (k: KpiCenario, cobertura: number): Indicadores => ({
  produtivoMedio: k.produtivoMedio,
  aderencia: k.aderencia,
  cobertura,
  acimaTeto: k.acimaTeto,
  acimaLimite: k.acimaLimite,
  blocosFocoMedio: k.blocosFocoMedio,
  fragMedia: k.fragMedia,
  horasTotais: k.horasTotais,
})

/**
 * Resumo da execução, com as mesmas contas que a tela do Otimizador fazia para a leitura do
 * agente: déficit somado só nos cargos com gente, concessões por premissa e gargalo pela ordem de
 * inserção (objetos, como no protótipo, para que a ordem do texto não mude).
 */
export function resumirExecucao({ mundo, config, papeis, simulacao }: Base & { simulacao: Simulacao }): ResumoExecucao {
  const w = simulacao.semanas[0]
  const b = w.base.kpi
  const o = w.otm.kpi
  const R = w.otm
  const perfilId = PERFIS[config.perfil] ? config.perfil : "equilibrio"
  const perfil = PERFIS[perfilId]
  const conc = R.concessoes
  const adi = R.adiadas

  const porCargo = papeis
    .map((pp) => {
      const ps = o.porPessoa.filter((x) => x.papel === pp)
      if (!ps.length) return null
      const def = R.deficit[pp]
      return {
        cargo: pp,
        pessoas: ps.length,
        noAlvo: ps.filter((x) => x.noAlvo).length,
        concessoes: conc.filter((x) => x.papel === pp).length,
        fte: def ? def.fteObrig : 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const porPremissa: Record<string, number> = {}
  conc.forEach((c) => (porPremissa[c.premissa] = (porPremissa[c.premissa] || 0) + 1))
  const gargalo: Record<string, number> = {}
  adi.forEach((a) => a.papeis.forEach((pp) => (gargalo[pp] = (gargalo[pp] || 0) + 1)))
  const gargaloTop = Object.entries(gargalo).sort((a, c) => c[1] - a[1])[0]

  return {
    perfil: { id: perfilId, rotulo: perfil.rotulo, desc: perfil.desc },
    horizonte: config.horizonte,
    projetos: mundo.projetos.length,
    pessoas: mundo.pessoas.length,
    demanda: w.demanda.length,
    alocadas: R.alocadas.length,
    cobertura: {
      total: R.cobertura.total,
      obrigatoria: R.cobertura.obrigatoria,
      relaxadas: R.cobertura.relaxadas,
      sla: R.cobertura.sla,
      slaTotal: R.cobertura.slaTotal,
    },
    pessoasNoAlvo: o.porPessoa.filter((x) => x.noAlvo).length,
    concessoes: {
      total: conc.length,
      porPremissa: Object.entries(porPremissa).map(([premissa, qtd]) => ({ premissa, qtd })),
    },
    adiadas: {
      total: adi.length,
      obrigatorias: adi.filter((a) => a.obrig).length,
      sla: adi.filter((a) => a.sla).length,
    },
    trocas: R.trocas.length,
    deficit: {
      fte: porCargo.reduce((s, x) => s + x.fte, 0),
      gargalo: gargaloTop ? gargaloTop[0] : null,
      porCargo,
    },
    estabilidade: R.estabilidade ? R.estabilidade.pct : null,
    indicadores: {
      atual: indicadores(b, (100 * w.base.alocadas.length) / w.demanda.length),
      otimizado: indicadores(o, R.cobertura.total),
    },
  }
}

/**
 * Premissas vigentes, etapas e playbook em arrays de ordem fixa. É o bloco do prompt que vai para
 * o cache: a mesma configuração precisa gerar exatamente os mesmos bytes.
 */
export function contextoDaOperacao({ mundo, config, papeis }: Base): ContextoOperacao {
  const g = geralDe(config)
  return {
    premissasGerais: {
      inicio: g.inicio,
      fim: g.fim,
      almocoInicio: g.almocoInicio,
      almocoDur: g.almocoDur,
      buffer: g.buffer,
      preferidos: [...g.preferidos],
      pesoPreferencia: g.pesoPreferencia,
      diaProtegido: g.diaProtegido,
    },
    premissasCargo: papeis.map((cargo) => {
      const c = premDe(config, cargo)
      return {
        cargo,
        jornada: c.jornada,
        fatorAusencia: c.fatorAusencia,
        tempoInstitucional: c.tempoInstitucional,
        produtivoMin: c.produtivoMin,
        tolerancia: c.tolerancia,
        maxReunioesDia: c.maxReunioesDia,
        maxHorasDia: c.maxHorasDia,
        maxHorasSemana: c.maxHorasSemana,
        maxHorasMes: c.maxHorasMes,
        blocoFocoMin: c.blocoFocoMin,
        focoProt: c.focoProt,
        duracaoMax: c.duracaoMax,
        teto: c.teto,
        tetoMax: c.tetoMax,
      }
    }),
    etapas: Object.keys(mundo.etapas).map((id) => {
      const u = etapaDe(config, id)
      return { id, rotulo: mundo.etapas[id].rotulo, urgencia: u.urgencia, prazoDias: u.prazoDias }
    }),
    playbook: Object.keys(mundo.playbook).map((fase) => ({
      fase,
      itens: mundo.playbook[fase].map((i) => ({
        tipo: i.tipo,
        dur: i.dur,
        cada: i.cada,
        papeis: [...i.papeis],
        obrig: i.obrig,
        prio: i.prio,
        ...(i.origem ? { origem: i.origem } : {}),
      })),
    })),
  }
}
