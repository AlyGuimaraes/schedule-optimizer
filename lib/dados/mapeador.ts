import { GERAL_PADRAO } from "@/lib/dominio/padroes"
import type {
  Config,
  DiaProtegido,
  Etapa,
  Health,
  ItemPlaybook,
  Mundo,
  Papel,
  PerfilId,
  PremissasCargoEntrada,
  PremissasGerais,
  Prioridade,
  Projeto,
  UrgenciaEtapa,
} from "@/lib/dominio"

/** Formato devolvido pela RPC `carregar_mundo()` (supabase/migrations). */
export interface MundoBanco {
  cargos: { id: string; nome: string; ordem: number }[]
  pessoas: { id: string; nome: string; iniciais: string; cargo_id: string; email?: string | null }[]
  times: { id: string; nome: string; membros: string[] }[]
  etapas: {
    id: string
    chave: string
    rotulo: string
    urgencia: number
    prazo_dias: number
    hue: number
    ordem: number
  }[]
  playbook: {
    id: string
    etapa_id: string
    tipo: string
    hue: number
    duracao_min: number
    cadencia_semanas: number
    prioridade: number
    obrigatoria: boolean
    cargos: string[]
  }[]
  projetos: {
    id: string
    nome: string
    cliente_id: string
    cliente: string
    prioridade: Prioridade
    etapa_id: string
    time_id: string
    mes: number
    health: Health
    atraso_dias: number
    sequencia?: number
    produtos: { relatorios: number; dashboards: number; integracoes: number }
    squad: Record<string, string>
  }[]
  premissas_cargo: Record<string, PremissaCargoBanco>
  premissas_gerais: Record<string, unknown>
  prioridades: Record<string, number>
}

export interface PremissaCargoBanco {
  cargo_id: string
  jornada: number
  fator_ausencia: number
  tempo_institucional: number
  produtivo_min: number
  tolerancia: number
  max_reunioes_dia: number
  max_horas_dia: number
  max_horas_semana: number
  max_horas_mes: number
  duracao_max_min: number
  bloco_foco_min_min: number
  janela_protegida_min: number
  custo_hora?: number
}

/**
 * O motor trabalha com índices de array para pessoas, projetos e times, como no protótipo.
 * Os índices guardam o caminho de volta para os uuids do banco.
 */
export interface Indices {
  pessoas: string[]
  projetos: string[]
  times: string[]
  cargos: Record<Papel, string>
  etapas: Record<string, string>
  clientes: string[]
  /** `chave da etapa|tipo da cerimônia` → uuid do item do playbook */
  playbook: Record<string, string>
}

export interface DadosMundo {
  mundo: Mundo
  config: Config
  indices: Indices
  /** cenário publicado, cujo plano segura a estabilidade do replanejamento (E13) */
  vigente?: { id: string; nome: string; publicadoEm: string } | null
}

/** Formato devolvido pela RPC `carregar_plano()`. */
export interface PlanoBanco {
  publicado: { id: string; nome: string; publicado_em: string } | null
  ancoras: { projeto_id: string; playbook_item_id: string; dia: number; slot: number }[]
  ocorrencias: { projeto_id: string; playbook_item_id: string; semana: number; dia: number; slot: number }[]
}

/**
 * Leva ao motor o plano vigente (termo de estabilidade) e as âncoras, com as chaves do domínio:
 * `projeto|cerimônia|semana` e `projeto|cerimônia`.
 */
export function aplicarPlano(dados: DadosMundo, plano: PlanoBanco): DadosMundo {
  const projeto = new Map(dados.indices.projetos.map((id, i) => [id, i]))
  const tipo = new Map(
    Object.entries(dados.indices.playbook).map(([chave, id]) => [id, chave.slice(chave.indexOf("|") + 1)])
  )
  const chave = (p: string, item: string) => {
    const i = projeto.get(p)
    const t = tipo.get(item)
    return i === undefined || t === undefined ? null : `${i}|${t}`
  }

  const ancoras: Record<string, { dia: number; slot: number }> = {}
  plano.ancoras.forEach((a) => {
    const k = chave(a.projeto_id, a.playbook_item_id)
    if (k) ancoras[k] = { dia: a.dia, slot: a.slot }
  })
  const vigente: Record<string, { dia: number; slot: number }> = {}
  plano.ocorrencias.forEach((o) => {
    const k = chave(o.projeto_id, o.playbook_item_id)
    if (k) vigente[`${k}|${o.semana}`] = { dia: o.dia, slot: o.slot }
  })

  return {
    ...dados,
    config: {
      ...dados.config,
      ancoras: Object.keys(ancoras).length ? ancoras : undefined,
      planoVigente: Object.keys(vigente).length ? vigente : undefined,
      pesoEstabilidade: 3,
    },
    vigente: plano.publicado
      ? { id: plano.publicado.id, nome: plano.publicado.nome, publicadoEm: plano.publicado.publicado_em }
      : null,
  }
}

/** Minutos do banco para slots de 30 minutos do motor. */
const slots = (minutos: number) => minutos / 30

const numero = (v: unknown, padrao: number) => (typeof v === "number" ? v : padrao)

function mapearGerais(g: Record<string, unknown>): PremissasGerais {
  return {
    inicio: numero(g.inicio_jornada, GERAL_PADRAO.inicio),
    fim: numero(g.fim_jornada, GERAL_PADRAO.fim),
    almocoInicio: numero(g.almoco_inicio, GERAL_PADRAO.almocoInicio),
    almocoDur: numero(g.almoco_duracao, GERAL_PADRAO.almocoDur),
    buffer: numero(g.intervalo_entre_reunioes, GERAL_PADRAO.buffer),
    preferidos: Array.isArray(g.horarios_preferidos)
      ? (g.horarios_preferidos as number[])
      : [...GERAL_PADRAO.preferidos],
    pesoPreferencia: numero(g.peso_preferencia, GERAL_PADRAO.pesoPreferencia),
    diaProtegido: (typeof g.dia_protegido === "string"
      ? g.dia_protegido
      : GERAL_PADRAO.diaProtegido) as DiaProtegido,
  }
}

function mapearPremissa(p: PremissaCargoBanco): PremissasCargoEntrada {
  return {
    jornada: Number(p.jornada),
    fatorAusencia: Number(p.fator_ausencia),
    tempoInstitucional: Number(p.tempo_institucional),
    produtivoMin: Number(p.produtivo_min),
    tolerancia: Number(p.tolerancia),
    maxReunioesDia: Number(p.max_reunioes_dia),
    maxHorasDia: Number(p.max_horas_dia),
    maxHorasSemana: Number(p.max_horas_semana),
    maxHorasMes: Number(p.max_horas_mes),
    duracaoMax: slots(Number(p.duracao_max_min)),
    blocoFocoMin: slots(Number(p.bloco_foco_min_min)),
    focoProt: slots(Number(p.janela_protegida_min)),
  }
}

/**
 * Converte o mundo do banco no mundo do motor.
 * A ordem importa: a posição do projeto faseia a cadência (`(id + semana) % cada`, até a E14)
 * e a ordem dos cargos define a ordem dos participantes. Por isso projetos seguem `sequencia`
 * e cargos do quórum seguem a ordem gravada no playbook.
 */
export function mapearMundo(
  b: MundoBanco,
  opcoes: { perfil?: PerfilId; horizonte?: number; rebalancear?: boolean } = {}
): DadosMundo {
  const cargos = [...b.cargos].sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome))
  const nomeDoCargo = new Map(cargos.map((c) => [c.id, c.nome]))
  const cargoNome = (id: string) => {
    const nome = nomeDoCargo.get(id)
    if (!nome) throw new Error(`cargo ${id} não encontrado no mundo carregado`)
    return nome
  }

  const indicePessoa = new Map(b.pessoas.map((p, i) => [p.id, i]))
  const pessoas = b.pessoas.map((p, i) => ({
    id: i,
    nome: p.nome,
    papel: cargoNome(p.cargo_id),
    iniciais: p.iniciais,
  }))

  const indiceTime = new Map(b.times.map((t, i) => [t.id, i]))
  const times = b.times.map((t, i) => ({
    id: i,
    nome: t.nome,
    membros: t.membros
      .map((id) => indicePessoa.get(id))
      .filter((x): x is number => x !== undefined)
      .sort((x, y) => x - y),
  }))

  const etapasOrd = [...b.etapas].sort((x, y) => x.ordem - y.ordem)
  const chaveDaEtapa = new Map(etapasOrd.map((e) => [e.id, e.chave]))

  const projetosOrd = [...b.projetos].sort(
    (x, y) => (x.sequencia ?? 0) - (y.sequencia ?? 0)
  )

  const playbook: Record<string, ItemPlaybook[]> = {}
  etapasOrd.forEach((e) => {
    playbook[e.chave] = b.playbook
      .filter((i) => i.etapa_id === e.id)
      .map((i) => ({
        tipo: i.tipo,
        dur: i.duracao_min,
        cada: i.cadencia_semanas,
        papeis: i.cargos.map(cargoNome),
        obrig: i.obrigatoria,
        prio: i.prioridade,
      }))
  })

  const etapas: Record<string, Etapa> = {}
  const urgencias: Record<string, UrgenciaEtapa> = {}
  etapasOrd.forEach((e) => {
    etapas[e.chave] = {
      rotulo: e.rotulo,
      qtd: projetosOrd.filter((p) => p.etapa_id === e.id).length,
      hue: e.hue,
    }
    urgencias[e.chave] = { urgencia: e.urgencia, prazoDias: e.prazo_dias }
  })

  const projetos: Projeto[] = projetosOrd.map((pr, i) => {
    const fase = chaveDaEtapa.get(pr.etapa_id)
    if (!fase) throw new Error(`etapa ${pr.etapa_id} do projeto ${pr.nome} não está ativa`)
    // chaves do squad na ordem em que a fase exige os cargos
    const exigidos = [...new Set((playbook[fase] ?? []).flatMap((c) => c.papeis))]
    const porCargo = new Map(
      Object.entries(pr.squad).map(([cargoId, pessoaId]) => [cargoNome(cargoId), indicePessoa.get(pessoaId)])
    )
    const squad: Record<Papel, number | undefined> = {}
    exigidos.forEach((papel) => {
      squad[papel] = porCargo.get(papel)
    })
    porCargo.forEach((pessoa, papel) => {
      if (!(papel in squad)) squad[papel] = pessoa
    })
    const timeId = indiceTime.get(pr.time_id)
    if (timeId === undefined) throw new Error(`time ${pr.time_id} do projeto ${pr.nome} não está ativo`)
    return {
      id: i,
      nome: pr.nome,
      fase,
      squad,
      health: pr.health,
      prioridade: pr.prioridade,
      produtos: {
        relatorios: Number(pr.produtos.relatorios),
        dashboards: Number(pr.produtos.dashboards),
        integracoes: Number(pr.produtos.integracoes),
      },
      mes: pr.mes,
      timeId,
    }
  })

  const papeis: Record<Papel, PremissasCargoEntrada> = {}
  cargos.forEach((c) => {
    const p = b.premissas_cargo[c.id]
    if (p) papeis[c.nome] = mapearPremissa(p)
  })

  const config: Config = {
    horizonte: opcoes.horizonte ?? 4,
    perfil: opcoes.perfil ?? "equilibrio",
    rebalancear: opcoes.rebalancear ?? true,
    papeis,
    geral: mapearGerais(b.premissas_gerais),
    etapas: urgencias,
    clientes: { ...b.prioridades },
  }

  const indices: Indices = {
    pessoas: b.pessoas.map((p) => p.id),
    projetos: projetosOrd.map((p) => p.id),
    times: b.times.map((t) => t.id),
    cargos: Object.fromEntries(cargos.map((c) => [c.nome, c.id])),
    etapas: Object.fromEntries(etapasOrd.map((e) => [e.chave, e.id])),
    clientes: projetosOrd.map((p) => p.cliente_id),
    playbook: Object.fromEntries(
      b.playbook.map((i) => [`${chaveDaEtapa.get(i.etapa_id)}|${i.tipo}`, i.id])
    ),
  }

  return { mundo: { pessoas, projetos, times, etapas, playbook }, config, indices }
}
