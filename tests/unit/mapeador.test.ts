import { describe, expect, it } from "vitest"

import { mapearMundo, type MundoBanco } from "@/lib/dados/mapeador"
import {
  CLIENTES_PADRAO,
  ETAPAS_PADRAO,
  GERAL_PADRAO,
  PREM_PADRAO,
  construirMundo,
  criarConfig,
  montarSquad,
  simular,
  type Mundo,
} from "@/lib/dominio"

import { resumo } from "../paridade/resumo"

/** A base do banco: semente 7 com os squads remontados pelo time (defeito 15 corrigido). */
function mundoDaBase(): Mundo {
  const mundo = construirMundo()
  mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
  return mundo
}

/**
 * Monta o JSON que `carregar_mundo()` devolve, a partir do mundo do domínio,
 * embaralhando de propósito o que o banco não garante: ordem das chaves do squad
 * e ordem dos membros dos times.
 */
function comoOBancoDevolve(mundo: Mundo): MundoBanco {
  const cargos = Object.keys(PREM_PADRAO)
  const idCargo = (nome: string) => `cargo-${cargos.indexOf(nome)}`
  const idPessoa = (i: number) => `pessoa-${i}`
  const etapas = Object.keys(mundo.etapas)

  return {
    cargos: cargos.map((nome, i) => ({ id: idCargo(nome), nome, ordem: i })).reverse(),
    pessoas: mundo.pessoas.map((p) => ({
      id: idPessoa(p.id),
      nome: p.nome,
      iniciais: p.iniciais,
      cargo_id: idCargo(p.papel),
    })),
    times: mundo.times.map((t) => ({
      id: `time-${t.id}`,
      nome: t.nome,
      membros: [...t.membros].reverse().map(idPessoa),
    })),
    etapas: etapas.map((chave, i) => ({
      id: `etapa-${chave}`,
      chave,
      rotulo: mundo.etapas[chave].rotulo,
      urgencia: ETAPAS_PADRAO[chave].urgencia,
      prazo_dias: ETAPAS_PADRAO[chave].prazoDias,
      hue: mundo.etapas[chave].hue,
      ordem: i,
    })),
    playbook: etapas.flatMap((chave) =>
      mundo.playbook[chave].map((c, i) => ({
        id: `item-${chave}-${i}`,
        etapa_id: `etapa-${chave}`,
        tipo: c.tipo,
        hue: 220,
        duracao_min: c.dur,
        cadencia_semanas: c.cada,
        prioridade: c.prio,
        obrigatoria: c.obrig,
        cargos: c.papeis.map(idCargo),
      }))
    ),
    // o banco devolve em ordem de sequência, mas o mapeador não deve depender disso
    projetos: [...mundo.projetos].reverse().map((pr) => ({
      id: `projeto-${pr.id}`,
      nome: pr.nome,
      cliente_id: `cliente-${pr.id}`,
      cliente: pr.nome,
      prioridade: pr.prioridade,
      etapa_id: `etapa-${pr.fase}`,
      time_id: `time-${pr.timeId}`,
      mes: pr.mes,
      health: pr.health,
      atraso_dias: 0,
      sequencia: pr.id,
      produtos: pr.produtos,
      squad: Object.fromEntries(
        Object.entries(pr.squad)
          .filter(([, id]) => id !== undefined)
          .reverse()
          .map(([papel, id]) => [idCargo(papel), idPessoa(id as number)])
      ),
    })),
    premissas_cargo: Object.fromEntries(
      cargos.map((nome) => {
        const p = PREM_PADRAO[nome]
        return [
          idCargo(nome),
          {
            cargo_id: idCargo(nome),
            jornada: p.jornada,
            fator_ausencia: p.fatorAusencia,
            tempo_institucional: p.tempoInstitucional,
            produtivo_min: p.produtivoMin,
            tolerancia: p.tolerancia,
            max_reunioes_dia: p.maxReunioesDia,
            max_horas_dia: p.maxHorasDia,
            max_horas_semana: p.maxHorasSemana,
            max_horas_mes: p.maxHorasMes,
            duracao_max_min: p.duracaoMax * 30,
            bloco_foco_min_min: p.blocoFocoMin * 30,
            janela_protegida_min: p.focoProt * 30,
          },
        ]
      })
    ),
    premissas_gerais: {
      inicio_jornada: GERAL_PADRAO.inicio,
      fim_jornada: GERAL_PADRAO.fim,
      almoco_inicio: GERAL_PADRAO.almocoInicio,
      almoco_duracao: GERAL_PADRAO.almocoDur,
      intervalo_entre_reunioes: GERAL_PADRAO.buffer,
      horarios_preferidos: GERAL_PADRAO.preferidos,
      peso_preferencia: GERAL_PADRAO.pesoPreferencia,
      dia_protegido: GERAL_PADRAO.diaProtegido,
      quorum_minimo_pct: 100,
      antecedencia_horas: 48,
      estabilidade_max_pct: 20,
    },
    prioridades: { ...CLIENTES_PADRAO },
  }
}

describe("mapeador do banco para o motor", () => {
  const base = mundoDaBase()
  const { mundo, config, indices } = mapearMundo(comoOBancoDevolve(base))

  it("preserva contagens e o caminho de volta para os uuids", () => {
    expect(mundo.pessoas).toHaveLength(20)
    expect(mundo.projetos).toHaveLength(112)
    expect(mundo.times.map((t) => t.membros.length)).toEqual([9, 8, 8, 7])
    expect(indices.projetos[0]).toBe("projeto-0")
    expect(indices.pessoas[19]).toBe("pessoa-19")
    expect(indices.cargos["Gerente de Projeto"]).toBe("cargo-5")
  })

  it("converte minutos em slots e as chaves das premissas gerais", () => {
    expect(config.papeis["Arquiteto de Dados"].focoProt).toBe(6)
    expect(config.papeis["Arquiteto de Dados"].duracaoMax).toBe(2)
    expect(config.geral).toEqual(GERAL_PADRAO)
    expect(config.clientes).toEqual(CLIENTES_PADRAO)
  })

  it("o mundo do banco simula exatamente como a semente, apesar da ordem embaralhada", () => {
    expect(resumo(simular(mundo, config))).toEqual(resumo(simular(base, criarConfig())))
  })
})

describe("números de referência da base com a regra do time (§2.0)", () => {
  // Estes são os números que o banco produz, depois da correção do defeito 15.
  const { mundo, config } = mapearMundo(comoOBancoDevolve(mundoDaBase()))
  const sim = simular(mundo, config)
  const w = sim.semanas[0]

  it("mesma demanda do protótipo", () => {
    expect(sim.semanas.map((s) => s.demanda.length)).toEqual([58, 59, 58, 58])
  })

  it("cobertura mais apertada e SLA de etapa em 100%", () => {
    expect(w.otm.alocadas.length).toBe(52)
    expect(w.otm.adiadas.length).toBe(6)
    expect(w.otm.cobertura.total).toBe(89.7)
    expect(w.otm.cobertura.obrigatoria).toBe(94.2)
    expect(w.otm.cobertura.sla).toBe(100)
    expect(w.otm.kpi.aderencia).toBe(85)
    expect(w.otm.kpi.horasTotais).toBe(106)
    const fte = Object.values(w.otm.deficit).reduce((s, x) => s + x.fteObrig, 0)
    expect(+fte.toFixed(2)).toBe(0.61)
    expect(sim.mes.otm.horas).toBe(453.6)
  })

  it("todo participante pertence ao time do projeto", () => {
    sim.semanas.forEach((s) =>
      s.otm.alocadas.forEach((ev) => {
        const time = mundo.times[ev.timeId]
        ev.participantes.forEach((p) => expect(time.membros).toContain(p))
      })
    )
  })
})
