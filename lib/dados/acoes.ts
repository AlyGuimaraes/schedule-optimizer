"use server"

import { revalidatePath } from "next/cache"

import { hueCer, hueDeTexto } from "@/lib/cores"
import {
  CLIENTES_PADRAO,
  ETAPAS_PADRAO,
  GERAL_PADRAO,
  PLAYBOOK_PADRAO,
  PREM_PADRAO,
} from "@/lib/dominio"
import { iniciaisDe } from "@/lib/formato"

import { clienteAdmin } from "./admin"
import { remontarSquads } from "./squads-servidor"
import type {
  CampoCerimonia,
  CargoEntrada,
  CerimoniaEntrada,
  EtapaEntrada,
  PessoaEntrada,
  PremissaCargoParcial,
  PremissasGeraisParcial,
  ProjetoEntrada,
  Resultado,
  TimeEntrada,
} from "./tipos-acoes"

// Gravações do Cadência. Todas passam pelo servidor, remontam os squads quando a estrutura muda
// e revalidam o layout, que recarrega o mundo do banco. Enquanto o login da E03 não existe, usam
// a service role (ver lib/dados/admin.ts); com o login, passam ao cliente da sessão e ao RLS.

type Sb = ReturnType<typeof clienteAdmin>

async function executar<T>(
  fn: (sb: Sb) => Promise<T>,
  // edições em linha (células) gravam sem revalidar: o estado do cliente já tem o valor, e uma
  // recarga no meio da digitação devolveria um valor anterior
  opcoes: { remontar?: boolean; rebalancear?: boolean; revalidar?: boolean } = {}
): Promise<Resultado<T>> {
  try {
    const sb = clienteAdmin()
    const dados = await fn(sb)
    if (opcoes.remontar || opcoes.rebalancear) await remontarSquads(sb, { rebalancear: opcoes.rebalancear })
    if (opcoes.revalidar !== false) revalidatePath("/", "layout")
    return { ok: true, dados }
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e)
    console.error("[cadência] gravação falhou:", erro)
    return { ok: false, erro: traduzirErro(erro) }
  }
}

function traduzirErro(erro: string): string {
  if (erro.includes("duplicate key")) return "Já existe um registro com esse nome."
  if (erro.includes("violates foreign key")) return "Há registros que dependem deste. Remova ou mova-os antes."
  if (erro.includes("violates check constraint")) return "Um dos valores está fora do intervalo permitido."
  return erro
}

type Resposta = { data: unknown; error: { message: string } | null }

function checar<R extends Resposta>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message)
  return r.data as NonNullable<R["data"]>
}

/** Para buscas com `maybeSingle`, em que "não encontrado" é um resultado válido. */
function checarTalvez<R extends Resposta>(r: R): R["data"] {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const texto = (v: unknown, campo: string) => {
  const s = String(v ?? "").trim()
  if (!s) throw new Error(`Informe ${campo}.`)
  return s
}

function slug(t: string) {
  return (
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "etapa"
  )
}

// ─────────────────────── projetos ───────────────────────

export async function salvarProjeto(d: ProjetoEntrada): Promise<Resultado<string>> {
  return executar(
    async (sb) => {
      const nome = texto(d.nome, "o nome do cliente ou projeto")
      const nomeCliente = texto(d.cliente || nome, "o cliente")
      const existente = checarTalvez(await sb.from("clientes").select("id").eq("nome", nomeCliente).maybeSingle())
      const clienteId =
        existente?.id ??
        checar(
          await sb.from("clientes").insert({ nome: nomeCliente, prioridade: d.prioridade }).select("id").single()
        ).id

      const linha = {
        cliente_id: clienteId,
        nome,
        etapa_id: d.etapaId,
        time_id: d.timeId,
        mes: Math.min(Math.max(1, Math.round(d.mes)), 48),
        health: d.health,
        prioridade: d.prioridade,
      }
      const id = d.id
        ? (checar(await sb.from("projetos").update(linha).eq("id", d.id).select("id").single()).id as string)
        : (checar(await sb.from("projetos").insert(linha).select("id").single()).id as string)

      // produtos: a tela edita contagens por tipo
      checar(await sb.from("produtos").delete().eq("projeto_id", id))
      const produtos = [
        ...Array.from({ length: Math.max(0, d.produtos.relatorios) }, () => ({ projeto_id: id, tipo: "relatorio" as const })),
        ...Array.from({ length: Math.max(0, d.produtos.dashboards) }, () => ({ projeto_id: id, tipo: "dashboard" as const })),
        ...Array.from({ length: Math.max(0, d.produtos.integracoes) }, () => ({ projeto_id: id, tipo: "integracao" as const })),
      ]
      if (produtos.length) checar(await sb.from("produtos").insert(produtos))

      // cadeiras escolhidas à mão; as demais o montarSquad preenche pela menor carga
      const cadeiras = Object.entries(d.squad).map(([cargo_id, pessoa_id]) => ({
        projeto_id: id,
        cargo_id,
        pessoa_id,
        origem: "manual",
      }))
      if (cadeiras.length) checar(await sb.rpc("salvar_squads", { p_cadeiras: cadeiras }))
      return id
    },
    { remontar: true }
  )
}

export async function excluirProjeto(id: string): Promise<Resultado> {
  return executar(async (sb) => {
    checar(await sb.from("projetos").delete().eq("id", id))
    return null
  })
}

// ─────────────────────── pessoas ───────────────────────

export async function salvarPessoa(d: PessoaEntrada): Promise<Resultado<string>> {
  return executar(
    async (sb) => {
      const nome = texto(d.nome, "o nome")
      const linha = { nome, iniciais: iniciaisDe(nome), cargo_id: d.cargoId }
      if (d.id) return checar(await sb.from("pessoas").update(linha).eq("id", d.id).select("id").single()).id as string
      return checar(await sb.from("pessoas").insert(linha).select("id").single()).id as string
    },
    { remontar: true }
  )
}

export async function excluirPessoa(id: string): Promise<Resultado> {
  return executar(
    async (sb) => {
      // as cadeiras dela são liberadas e reatribuídas pela menor carga na remontagem
      checar(await sb.from("alocacoes").delete().eq("pessoa_id", id))
      checar(await sb.from("pessoas").delete().eq("id", id))
      return null
    },
    { remontar: true }
  )
}

export async function redistribuirAlocacao(): Promise<Resultado> {
  return executar(async () => null, { rebalancear: true })
}

// ─────────────────────── times ───────────────────────

export async function salvarTime(d: TimeEntrada): Promise<Resultado<string>> {
  return executar(
    async (sb) => {
      const nome = texto(d.nome, "o nome do time")
      if (!d.membros.length) throw new Error("Escolha ao menos uma pessoa.")
      const id = d.id
        ? (checar(await sb.from("times").update({ nome }).eq("id", d.id).select("id").single()).id as string)
        : (checar(await sb.from("times").insert({ nome }).select("id").single()).id as string)
      checar(await sb.from("time_membros").delete().eq("time_id", id))
      checar(await sb.from("time_membros").insert(d.membros.map((pessoa_id) => ({ time_id: id, pessoa_id }))))
      return id
    },
    { remontar: true }
  )
}

export async function excluirTime(id: string, destino: string): Promise<Resultado> {
  return executar(
    async (sb) => {
      checar(await sb.rpc("excluir_time", { p_time: id, p_destino: destino }))
      return null
    },
    { remontar: true }
  )
}

// ─────────────────────── cargos ───────────────────────

export async function salvarCargo(d: CargoEntrada): Promise<Resultado<string>> {
  return executar(
    async (sb) => {
      const nome = texto(d.nome, "o nome do cargo")
      // renomear é trivial: pessoas, squads e playbook apontam para o cargo por id (R47)
      if (d.id) return checar(await sb.from("cargos").update({ nome }).eq("id", d.id).select("id").single()).id as string

      const ultimo = checar(await sb.from("cargos").select("ordem").order("ordem", { ascending: false }).limit(1))
      const ordem = (ultimo?.[0]?.ordem ?? -1) + 1
      const id = checar(await sb.from("cargos").insert({ nome, ordem }).select("id").single()).id as string
      if (d.copiarDe) {
        const base = checar(
          await sb.from("premissas_cargo").select("*").eq("cargo_id", d.copiarDe).is("vigencia_fim", null).single()
        )
        const { id: _id, criado_em: _c, autor: _a, vigencia_inicio: _vi, vigencia_fim: _vf, ...valores } = base
        void _id; void _c; void _a; void _vi; void _vf
        checar(await sb.from("premissas_cargo").insert({ ...valores, cargo_id: id }))
      }
      return id
    },
    { remontar: false }
  )
}

export async function excluirCargo(id: string): Promise<Resultado> {
  return executar(
    async (sb) => {
      const pessoas = checar(await sb.from("pessoas").select("id").eq("cargo_id", id))
      if (pessoas.length) throw new Error(`O cargo tem ${pessoas.length} pessoa(s). Mova-as antes de excluir.`)
      // corrige o defeito 3 do protótipo: o cargo sai também do playbook e das cadeiras
      checar(await sb.from("playbook_item_cargos").delete().eq("cargo_id", id))
      checar(await sb.from("alocacoes").delete().eq("cargo_id", id))
      checar(await sb.from("cargos").delete().eq("id", id))
      return null
    },
    { remontar: true }
  )
}

// ─────────────────────── etapas e prioridades ───────────────────────

export async function salvarEtapa(d: EtapaEntrada): Promise<Resultado<string>> {
  return executar(async (sb) => {
    const rotulo = texto(d.rotulo, "o nome da etapa")
    const valores = {
      rotulo,
      urgencia: Math.min(Math.max(1, Math.round(d.urgencia)), 5),
      prazo_dias: Math.min(Math.max(1, Math.round(d.prazoDias)), 60),
    }
    if (d.id) return checar(await sb.from("etapas").update(valores).eq("id", d.id).select("id").single()).id as string

    const existentes = checar(await sb.from("etapas").select("chave, ordem"))
    let chave = slug(rotulo)
    if (existentes.some((e) => e.chave === chave)) {
      let n = 2
      while (existentes.some((e) => e.chave === `${chave}-${n}`)) n++
      chave = `${chave}-${n}`
    }
    const ordem = Math.max(-1, ...existentes.map((e) => e.ordem)) + 1
    return checar(
      await sb.from("etapas").insert({ ...valores, chave, ordem, hue: hueDeTexto(chave) }).select("id").single()
    ).id as string
  })
}

export async function removerEtapa(id: string, destino: string): Promise<Resultado> {
  return executar(
    async (sb) => {
      checar(await sb.rpc("remover_etapa", { p_etapa: id, p_destino: destino }))
      return null
    },
    { remontar: true }
  )
}

export async function definirUrgenciaEtapa(id: string, urgencia: number, prazoDias: number): Promise<Resultado> {
  return executar(async (sb) => {
    checar(
      await sb
        .from("etapas")
        .update({ urgencia: Math.min(Math.max(1, urgencia), 5), prazo_dias: Math.min(Math.max(1, prazoDias), 60) })
        .eq("id", id)
    )
    return null
  }, { revalidar: false })
}

export async function definirPesoCliente(nivel: "alta" | "media" | "baixa", peso: number): Promise<Resultado> {
  return executar(async (sb) => {
    checar(await sb.from("prioridades_cliente").update({ peso: Math.min(Math.max(1, peso), 5) }).eq("nivel", nivel))
    return null
  }, { revalidar: false })
}

// ─────────────────────── playbook ───────────────────────

async function tipoCerimonia(sb: Sb, nome: string): Promise<string> {
  const existente = checarTalvez(await sb.from("tipos_cerimonia").select("id").eq("nome", nome).maybeSingle())
  if (existente) return existente.id
  return checar(await sb.from("tipos_cerimonia").insert({ nome, hue: hueCer(nome) }).select("id").single()).id
}

async function gravarCargosDoItem(sb: Sb, itemId: string, cargos: string[]) {
  checar(await sb.from("playbook_item_cargos").delete().eq("playbook_item_id", itemId))
  if (cargos.length)
    checar(
      await sb
        .from("playbook_item_cargos")
        .insert(cargos.map((cargo_id, ordem) => ({ playbook_item_id: itemId, cargo_id, ordem })))
    )
}

export async function salvarCerimonia(d: CerimoniaEntrada): Promise<Resultado<string>> {
  return executar(
    async (sb) => {
      const nome = texto(d.tipo, "o nome da cerimônia")
      if (!d.cargos.length) throw new Error("Escolha ao menos um cargo obrigatório.")
      const tipoId = await tipoCerimonia(sb, nome)
      const valores = {
        tipo_cerimonia_id: tipoId,
        duracao_min: Math.min(Math.max(15, Math.round(d.dur / 15) * 15), 240),
        cadencia_semanas: Math.min(Math.max(1, d.cada), 12),
        prioridade: Math.min(Math.max(1, d.prio), 5),
        obrigatoria: d.obrig,
      }
      let id: string
      if (d.id) {
        id = checar(await sb.from("playbook_itens").update(valores).eq("id", d.id).select("id").single()).id
      } else {
        const itens = checar(await sb.from("playbook_itens").select("ordem").eq("etapa_id", d.etapaId))
        const ordem = Math.max(-1, ...itens.map((i) => i.ordem)) + 1
        id = checar(
          await sb.from("playbook_itens").insert({ ...valores, etapa_id: d.etapaId, ordem }).select("id").single()
        ).id
      }
      await gravarCargosDoItem(sb, id, d.cargos)
      return id
    },
    { remontar: true }
  )
}

export async function editarCerimoniaCampo(id: string, campo: CampoCerimonia, valor: number): Promise<Resultado> {
  return executar(async (sb) => {
    const coluna =
      campo === "dur"
        ? { duracao_min: Math.min(Math.max(15, Math.round(valor / 15) * 15), 240) }
        : campo === "cada"
          ? { cadencia_semanas: Math.min(Math.max(1, valor), 12) }
          : campo === "prio"
            ? { prioridade: Math.min(Math.max(1, valor), 5) }
            : { obrigatoria: valor === 1 }
    checar(await sb.from("playbook_itens").update(coluna).eq("id", id))
    return null
  }, { revalidar: false })
}

export async function excluirCerimonia(id: string): Promise<Resultado> {
  return executar(
    async (sb) => {
      checar(await sb.from("playbook_itens").delete().eq("id", id))
      return null
    },
    { remontar: true }
  )
}

/** Volta o playbook ao catálogo do §3.1 nas etapas padrão; etapas criadas depois ficam sem cerimônia. */
export async function restaurarPlaybook(): Promise<Resultado> {
  return executar(
    async (sb) => {
      const etapas = checar(await sb.from("etapas").select("id, chave"))
      const cargos = checar(await sb.from("cargos").select("id, nome"))
      const cargoId = new Map(cargos.map((c) => [c.nome, c.id]))
      checar(await sb.from("playbook_itens").delete().not("id", "is", null))
      for (const e of etapas) {
        const itens = PLAYBOOK_PADRAO[e.chave] ?? []
        for (const [ordem, c] of itens.entries()) {
          const tipoId = await tipoCerimonia(sb, c.tipo)
          const item = checar(
            await sb
              .from("playbook_itens")
              .insert({
                etapa_id: e.id,
                tipo_cerimonia_id: tipoId,
                duracao_min: c.dur,
                cadencia_semanas: c.cada,
                prioridade: c.prio,
                obrigatoria: c.obrig,
                ordem,
              })
              .select("id")
              .single()
          )
          await gravarCargosDoItem(
            sb,
            item.id,
            c.papeis.map((p) => cargoId.get(p)).filter((x): x is string => !!x)
          )
        }
      }
      return null
    },
    { remontar: true }
  )
}

// ─────────────────────── premissas ───────────────────────

/** Valores do motor (slots de 30 min) para colunas do banco (minutos). */
function colunasPremissa(p: PremissaCargoParcial) {
  const c: Record<string, number> = {}
  if (p.jornada !== undefined) c.jornada = p.jornada
  if (p.fatorAusencia !== undefined) c.fator_ausencia = p.fatorAusencia
  if (p.tempoInstitucional !== undefined) c.tempo_institucional = p.tempoInstitucional
  if (p.produtivoMin !== undefined) c.produtivo_min = p.produtivoMin
  if (p.tolerancia !== undefined) c.tolerancia = p.tolerancia
  if (p.maxReunioesDia !== undefined) c.max_reunioes_dia = p.maxReunioesDia
  if (p.maxHorasDia !== undefined) c.max_horas_dia = p.maxHorasDia
  if (p.maxHorasSemana !== undefined) c.max_horas_semana = p.maxHorasSemana
  if (p.maxHorasMes !== undefined) c.max_horas_mes = p.maxHorasMes
  if (p.duracaoMax !== undefined) c.duracao_max_min = Math.round(p.duracaoMax * 30)
  if (p.blocoFocoMin !== undefined) c.bloco_foco_min_min = Math.round(p.blocoFocoMin * 30)
  if (p.focoProt !== undefined) c.janela_protegida_min = Math.round(p.focoProt * 30)
  return c
}

export async function definirPremissaCargo(cargoId: string, valores: PremissaCargoParcial): Promise<Resultado> {
  return executar(async (sb) => {
    checar(await sb.rpc("definir_premissa_cargo", { p_cargo_id: cargoId, p_valores: colunasPremissa(valores) }))
    return null
  }, { revalidar: false })
}

const CHAVE_GERAL: Record<string, string> = {
  inicio: "inicio_jornada",
  fim: "fim_jornada",
  almocoInicio: "almoco_inicio",
  almocoDur: "almoco_duracao",
  buffer: "intervalo_entre_reunioes",
  preferidos: "horarios_preferidos",
  pesoPreferencia: "peso_preferencia",
  diaProtegido: "dia_protegido",
}

async function gravarGeral(sb: Sb, chave: string, valor: unknown) {
  checar(await sb.from("premissas_gerais").update({ vigencia_fim: new Date().toISOString().slice(0, 10) }).eq("chave", chave).is("vigencia_fim", null))
  checar(await sb.from("premissas_gerais").insert({ chave, valor: valor as never }))
}

export async function definirPremissasGerais(parcial: PremissasGeraisParcial): Promise<Resultado> {
  return executar(async (sb) => {
    for (const [campo, valor] of Object.entries(parcial)) {
      const chave = CHAVE_GERAL[campo]
      if (chave) await gravarGeral(sb, chave, valor)
    }
    return null
  }, { revalidar: false })
}

/** Restaura as premissas por cargo ao padrão do §2.3, nos cargos que existem no padrão. */
export async function restaurarPremissasCargo(): Promise<Resultado> {
  return executar(async (sb) => {
    const cargos = checar(await sb.from("cargos").select("id, nome"))
    for (const c of cargos) {
      const p = PREM_PADRAO[c.nome]
      if (p) checar(await sb.rpc("definir_premissa_cargo", { p_cargo_id: c.id, p_valores: colunasPremissa(p) }))
    }
    return null
  })
}

/** Restaura gerais, urgência das etapas e pesos de cliente ao padrão. */
export async function restaurarPremissasGerais(): Promise<Resultado> {
  return executar(async (sb) => {
    for (const [campo, valor] of Object.entries(GERAL_PADRAO)) await gravarGeral(sb, CHAVE_GERAL[campo], valor)
    const etapas = checar(await sb.from("etapas").select("id, chave"))
    for (const e of etapas) {
      const u = ETAPAS_PADRAO[e.chave]
      if (u) checar(await sb.from("etapas").update({ urgencia: u.urgencia, prazo_dias: u.prazoDias }).eq("id", e.id))
    }
    for (const [nivel, peso] of Object.entries(CLIENTES_PADRAO))
      checar(await sb.from("prioridades_cliente").update({ peso }).eq("nivel", nivel as "alta" | "media" | "baixa"))
    return null
  })
}
