"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import { instanteSlot, justificativa, proximaSegunda, simular, validarPlano, type PerfilId } from "@/lib/dominio"
import { registrar } from "@/lib/log"

import { clienteAdmin } from "./admin"
import { aplicarPlano, mapearMundo, type MundoBanco, type PlanoBanco } from "./mapeador"
import type { CenarioLista, DiffCenario, Resultado, ResumoCenario } from "./tipos-acoes"

// Cenários (E13, §10 "simulação de cenário"): o gestor salva execuções, compara lado a lado,
// publica uma como plano vigente e o próximo replanejamento respeita esse plano (estabilidade).

type Resposta = { data: unknown; error: { message: string } | null }
function checar<R extends Resposta>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message)
  return r.data as NonNullable<R["data"]>
}

const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e))
const lotes = <T,>(linhas: T[], tamanho = 500) =>
  Array.from({ length: Math.ceil(linhas.length / tamanho) }, (_, i) => linhas.slice(i * tamanho, (i + 1) * tamanho))
const r2 = (v: number) => Math.round(v * 100) / 100

/** Instante real de um slot do motor, em ISO. */
const instante = (inicio: string, semana: number, dia: number, slot: number) =>
  new Date(instanteSlot(inicio, semana, dia, slot)).toISOString()

export async function salvarCenario(e: {
  nome: string
  perfil: PerfilId
  horizonte: number
  rebalancear: boolean
}): Promise<Resultado<string>> {
  try {
    const nome = e.nome.trim()
    if (!nome) throw new Error("Informe o nome do cenário.")
    const sb = clienteAdmin()
    const [m, p] = await Promise.all([sb.rpc("carregar_mundo"), sb.rpc("carregar_plano")])
    if (m.error) throw new Error(m.error.message)
    let dados = mapearMundo(m.data as unknown as MundoBanco, {
      perfil: e.perfil,
      horizonte: e.horizonte,
      rebalancear: e.rebalancear,
    })
    if (!p.error && p.data) dados = aplicarPlano(dados, p.data as unknown as PlanoBanco)
    const { mundo, config, indices } = dados

    const t0 = performance.now()
    const sim = simular(mundo, config)
    const solverMs = Math.round(performance.now() - t0)

    const id = randomUUID()
    const inicio = config.calendario?.inicio ?? proximaSegunda()
    const ocorrencias: Record<string, unknown>[] = []
    const participantes: Record<string, unknown>[] = []
    const concessoes: Record<string, unknown>[] = []
    const trocas: Record<string, unknown>[] = []
    const naoAtendidas: Record<string, unknown>[] = []
    const kpis: Record<string, unknown>[] = []

    sim.semanas.forEach((w) => {
      const porEv = new Map<number, string>()
      w.otm.alocadas.forEach((ev) => {
        const oid = randomUUID()
        porEv.set(ev.id, oid)
        const dia = ev.dia ?? 0
        const slot = ev.slot ?? 0
        ocorrencias.push({
          id: oid,
          cenario_id: id,
          projeto_id: indices.projetos[ev.projetoId],
          playbook_item_id: indices.playbook[`${ev.fase}|${ev.tipo}`],
          semana: w.semana,
          dia,
          slot,
          inicio: instante(inicio, w.semana, dia, slot),
          fim: instante(inicio, w.semana, dia, slot + ev.slots),
          relaxada: !!ev.relaxado,
          camada: ev.camada ?? 1,
          sla: ev.sla,
          justificativa: justificativa(ev, w.otm, mundo, config).join(" "),
        })
        const substituiu = new Map((ev.trocas ?? []).map((s) => [s.para, s.de]))
        ev.participantes.forEach((pid, i) => {
          const de = substituiu.get(pid)
          participantes.push({
            ocorrencia_id: oid,
            pessoa_id: indices.pessoas[pid],
            cargo_id: indices.cargos[ev.papeis[i]],
            substituiu_pessoa_id: de === undefined ? null : indices.pessoas[de],
          })
        })
      })
      w.otm.concessoes.forEach((c) =>
        concessoes.push({
          cenario_id: id,
          ocorrencia_id: porEv.get(c.evId) ?? null,
          pessoa_id: indices.pessoas[c.pessoaId],
          cargo_id: indices.cargos[c.papel],
          premissa: c.premissa,
          valor_alvo: r2(c.alvo),
          valor_aplicado: r2(c.valor),
          unidade: c.un,
        })
      )
      w.otm.trocas.forEach((t) =>
        t.subs.forEach((s) =>
          trocas.push({
            cenario_id: id,
            ocorrencia_id: porEv.get(t.ev.id) ?? null,
            cargo_id: indices.cargos[s.papel],
            de_pessoa_id: indices.pessoas[s.de],
            para_pessoa_id: indices.pessoas[s.para],
          })
        )
      )
      w.otm.adiadas.forEach((a) =>
        naoAtendidas.push({
          cenario_id: id,
          projeto_id: indices.projetos[a.projetoId],
          playbook_item_id: indices.playbook[`${a.fase}|${a.tipo}`],
          semana: w.semana,
          motivo: a.motivo ?? "",
          obrigatoria: a.obrig,
          sla: a.sla,
        })
      )
      w.otm.kpi.porPessoa.forEach((k) =>
        kpis.push({
          cenario_id: id,
          pessoa_id: indices.pessoas[k.id],
          semana: w.semana,
          taxa: k.taxa,
          horas: k.horas,
          reunioes: k.reunioes,
          fragmentacao: k.frag,
          blocos_foco: k.blocosFoco,
          produtivo: k.produtivo,
        })
      )
    })

    const w1 = sim.semanas[0]
    const estab = sim.semanas
      .map((w) => w.otm.estabilidade?.pct)
      .filter((x): x is number => x !== undefined)
    const resumo: ResumoCenario = {
      demanda: w1.demanda.length,
      alocadas: w1.otm.alocadas.length,
      adiadas: w1.otm.adiadas.length,
      cobertura: w1.otm.cobertura.total,
      obrigatoria: w1.otm.cobertura.obrigatoria,
      sla: w1.otm.cobertura.sla,
      aderencia: w1.otm.kpi.aderencia,
      produtivo: w1.otm.kpi.produtivoMedio,
      deficitFte: r2(Object.values(w1.otm.deficit).reduce((s, x) => s + x.fteObrig, 0)),
      concessoes: w1.otm.concessoes.length,
      trocas: w1.otm.trocas.reduce((s, t) => s + t.subs.length, 0),
      horasMes: sim.mes.otm.horas,
      reunioesMes: sim.mes.otm.reunioes,
      estabilidade: estab.length ? r2(estab.reduce((s, x) => s + x, 0) / estab.length) : null,
      solverMs,
      ocorrencias: ocorrencias.length,
      // o validador independente roda em toda execução salva (critério 3 do MVP)
      violacoes: sim.semanas.reduce(
        (s, w) => s + validarPlano(w.otm, w.demanda, mundo.pessoas, { ...config, semanaIdx: w.semana }, mundo).length,
        0
      ),
    }

    const premissas = {
      perfil: config.perfil,
      horizonte: config.horizonte,
      rebalancear: config.rebalancear,
      papeis: config.papeis,
      geral: config.geral,
      etapas: config.etapas,
      clientes: config.clientes,
    }

    checar(
      await sb.from("cenarios").insert({
        id,
        nome,
        horizonte_inicio: inicio,
        horizonte_semanas: config.horizonte,
        perfil: config.perfil,
        rebalancear: config.rebalancear,
        status: "simulado",
        snapshot_premissas: JSON.parse(JSON.stringify(premissas)),
        solver: "guloso",
        duracao_ms: solverMs,
        resumo: JSON.parse(JSON.stringify(resumo)),
      })
    )
    for (const lote of lotes(ocorrencias)) checar(await sb.from("ocorrencias").insert(lote as never))
    for (const lote of lotes(participantes)) checar(await sb.from("participantes").insert(lote as never))
    for (const lote of lotes(concessoes)) checar(await sb.from("concessoes").insert(lote as never))
    for (const lote of lotes(trocas)) checar(await sb.from("trocas_cadeira").insert(lote as never))
    for (const lote of lotes(naoAtendidas)) checar(await sb.from("demanda_nao_atendida").insert(lote as never))
    for (const lote of lotes(kpis)) checar(await sb.from("kpis_snapshot").insert(lote as never))

    return { ok: true, dados: id }
  } catch (e) {
    registrar("erro", "cenario_salvar_falhou", { erro: erroDe(e) })
    return { ok: false, erro: erroDe(e) }
  }
}

export async function listarCenarios(): Promise<Resultado<CenarioLista[]>> {
  try {
    const sb = clienteAdmin()
    const linhas = checar(
      await sb
        .from("cenarios")
        .select("id, nome, status, perfil, horizonte_semanas, horizonte_inicio, criado_em, publicado_em, resumo, snapshot_premissas")
        .neq("status", "arquivado")
        .order("criado_em", { ascending: false })
        .limit(30)
    )
    return {
      ok: true,
      dados: linhas.map((c) => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        perfil: c.perfil,
        horizonte: c.horizonte_semanas,
        horizonteInicio: c.horizonte_inicio,
        criadoEm: c.criado_em,
        publicadoEm: c.publicado_em,
        resumo: (c.resumo as unknown as ResumoCenario) ?? null,
        premissas: (c.snapshot_premissas as Record<string, unknown>) ?? null,
      })),
    }
  } catch (e) {
    return { ok: false, erro: erroDe(e) }
  }
}

export async function publicarCenario(id: string): Promise<Resultado> {
  try {
    const sb = clienteAdmin()
    checar(await sb.from("cenarios").update({ status: "arquivado" }).eq("status", "publicado"))
    checar(
      await sb.from("cenarios").update({ status: "publicado", publicado_em: new Date().toISOString() }).eq("id", id)
    )
    // o plano vigente muda, e o próximo replanejamento passa a respeitá-lo
    revalidatePath("/", "layout")
    return { ok: true, dados: null }
  } catch (e) {
    return { ok: false, erro: erroDe(e) }
  }
}

export async function excluirCenario(id: string): Promise<Resultado> {
  try {
    const sb = clienteAdmin()
    const c = checar(await sb.from("cenarios").select("status").eq("id", id).single())
    if (c.status === "publicado") throw new Error("O plano vigente não pode ser excluído. Publique outro cenário antes.")
    checar(await sb.from("cenarios").delete().eq("id", id))
    return { ok: true, dados: null }
  } catch (e) {
    return { ok: false, erro: erroDe(e) }
  }
}

type OcorrenciaDiff = {
  projeto_id: string
  playbook_item_id: string
  semana: number
  dia: number | null
  slot: number | null
  participantes: { pessoa_id: string }[]
}

/** Diff de publicação por pessoa: cerimônias novas, movidas e canceladas contra o plano vigente (§10). */
export async function diffComVigente(id: string): Promise<Resultado<DiffCenario>> {
  try {
    const sb = clienteAdmin()
    const pub = checar(await sb.from("cenarios").select("id").eq("status", "publicado").limit(1))
    const vazio: DiffCenario = { semVigente: true, novas: 0, movidas: 0, canceladas: 0, mantidas: 0, porPessoa: [] }
    if (!pub.length || pub[0].id === id) return { ok: true, dados: { ...vazio, semVigente: !pub.length } }

    const campos = "projeto_id, playbook_item_id, semana, dia, slot, participantes(pessoa_id)"
    const [novo, atual, pessoas] = await Promise.all([
      sb.from("ocorrencias").select(campos).eq("cenario_id", id),
      sb.from("ocorrencias").select(campos).eq("cenario_id", pub[0].id),
      sb.from("pessoas").select("id, nome"),
    ])
    const agrupar = (lista: OcorrenciaDiff[]) => {
      const mapa = new Map<string, OcorrenciaDiff>()
      const contagem = new Map<string, number>()
      lista.forEach((o) => {
        const base = `${o.projeto_id}|${o.playbook_item_id}|${o.semana}`
        const n = (contagem.get(base) ?? 0) + 1
        contagem.set(base, n)
        mapa.set(`${base}|${n}`, o)
      })
      return mapa
    }
    const a = agrupar(checar(novo) as unknown as OcorrenciaDiff[])
    const b = agrupar(checar(atual) as unknown as OcorrenciaDiff[])
    const nomes = new Map(checar(pessoas).map((p) => [p.id, p.nome]))
    const porPessoa = new Map<string, { novas: number; movidas: number; canceladas: number }>()
    const somar = (o: OcorrenciaDiff, campo: "novas" | "movidas" | "canceladas") =>
      o.participantes.forEach((pp) => {
        const atualP = porPessoa.get(pp.pessoa_id) ?? { novas: 0, movidas: 0, canceladas: 0 }
        atualP[campo]++
        porPessoa.set(pp.pessoa_id, atualP)
      })

    let novas = 0
    let movidas = 0
    let canceladas = 0
    let mantidas = 0
    a.forEach((o, k) => {
      const v = b.get(k)
      if (!v) {
        novas++
        somar(o, "novas")
      } else if (v.dia !== o.dia || v.slot !== o.slot) {
        movidas++
        somar(o, "movidas")
      } else mantidas++
    })
    b.forEach((o, k) => {
      if (!a.has(k)) {
        canceladas++
        somar(o, "canceladas")
      }
    })

    return {
      ok: true,
      dados: {
        semVigente: false,
        novas,
        movidas,
        canceladas,
        mantidas,
        porPessoa: [...porPessoa.entries()]
          .map(([pid, v]) => ({ nome: nomes.get(pid) ?? pid, ...v }))
          .sort((x, y) => y.novas + y.movidas + y.canceladas - (x.novas + x.movidas + x.canceladas)),
      },
    }
  } catch (e) {
    return { ok: false, erro: erroDe(e) }
  }
}

export async function ancorar(e: {
  projetoId: string
  itemId: string
  dia: number
  slot: number
}): Promise<Resultado> {
  try {
    const sb = clienteAdmin()
    checar(
      await sb
        .from("ancoras")
        .upsert(
          { projeto_id: e.projetoId, playbook_item_id: e.itemId, dia: e.dia, slot: e.slot },
          { onConflict: "projeto_id,playbook_item_id" }
        )
    )
    revalidatePath("/", "layout")
    return { ok: true, dados: null }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}

export async function removerAncora(projetoId: string, itemId: string): Promise<Resultado> {
  try {
    const sb = clienteAdmin()
    checar(await sb.from("ancoras").delete().eq("projeto_id", projetoId).eq("playbook_item_id", itemId))
    revalidatePath("/", "layout")
    return { ok: true, dados: null }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}
