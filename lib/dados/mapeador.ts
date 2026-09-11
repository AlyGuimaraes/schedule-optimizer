import {
  dataDoDia,
  limiteCongelamento,
  posicaoNoHorizonte,
  proximaSegunda,
  semanaAbsoluta,
} from "@/lib/dominio/calendario"
import { GERAL_PADRAO } from "@/lib/dominio/padroes"
import type {
  Calendario,
  Config,
  DiaProtegido,
  Etapa,
  ExcecaoProjeto,
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
  /** ausências e feriados cadastrados, para a aba Ausências do Time */
  ausencias?: AusenciaBanco[]
}

/** Formato devolvido pela RPC `carregar_plano()`. */
export interface PlanoBanco {
  publicado: { id: string; nome: string; publicado_em: string; horizonte_inicio?: string } | null
  ancoras: { projeto_id: string; playbook_item_id: string; dia: number; slot: number }[]
  ocorrencias: { projeto_id: string; playbook_item_id: string; semana: number; dia: number; slot: number }[]
  /** exceções por pessoa (§2.1), campo e valor já na unidade do motor */
  excecoes?: { pessoa_id: string; campo: string; valor: number }[]
  /** exceções por projeto (§2.1): janela do cliente e duração máxima, em slots */
  excecoes_projeto?: { projeto_id: string; campo: string; valor: number }[]
  /** ausências e feriados (E14); pessoa nula vale para todos */
  ausencias?: AusenciaBanco[]
  /** início real de cada série (defeito 8) */
  series?: { projeto_id: string; playbook_item_id: string; inicio: string }[]
}

export type TipoAusencia = "ferias" | "ausencia" | "feriado_nacional" | "feriado_municipal"

export interface AusenciaBanco {
  id: string
  pessoa_id: string | null
  inicio: string
  fim: string
  tipo: TipoAusencia
  descricao: string
}

export const ROTULO_AUSENCIA: Record<TipoAusencia, string> = {
  ferias: "férias",
  ausencia: "ausência",
  feriado_nacional: "feriado nacional",
  feriado_municipal: "feriado municipal",
}

/** Horizonte máximo do Otimizador, o trimestre: até onde ausências e feriados são projetados. */
const SEMANAS_CALENDARIO = 13

/**
 * Calendário real do horizonte (E14): cadência a partir do início de cada série, ausências e
 * feriados por dia e a janela congelada pela antecedência de 48h (§2.2).
 */
function montarCalendario(dados: DadosMundo, plano: PlanoBanco, agoraMs: number): Calendario {
  const inicio = proximaSegunda(agoraMs)
  const semana0 = semanaAbsoluta(inicio)
  const projeto = new Map(dados.indices.projetos.map((id, i) => [id, i]))
  const item = new Map(
    Object.entries(dados.indices.playbook).map(([chave, id]) => {
      const corte = chave.indexOf("|")
      return [id, { fase: chave.slice(0, corte), tipo: chave.slice(corte + 1) }]
    })
  )

  // só vale a série do item da fase atual do projeto; as de fases anteriores ficam de histórico
  const inicioSerie: Record<string, number> = {}
  ;(plano.series ?? []).forEach((s) => {
    const i = projeto.get(s.projeto_id)
    const it = item.get(s.playbook_item_id)
    if (i === undefined || !it || dados.mundo.projetos[i]?.fase !== it.fase) return
    inicioSerie[`${i}|${it.tipo}`] = semanaAbsoluta(s.inicio)
  })

  const pessoa = new Map(dados.indices.pessoas.map((id, i) => [id, i]))
  const indisponivel: NonNullable<Calendario["indisponivel"]> = {}
  const feriados: NonNullable<Calendario["feriados"]> = {}
  const marcar = (semana: number, p: number, dia: number, motivo: string) => {
    const s = (indisponivel[semana] ??= {})
    ;(s[p] ??= {})[dia] = motivo
  }
  const fimHorizonte = dataDoDia(inicio, SEMANAS_CALENDARIO, 4)
  ;(plano.ausencias ?? []).forEach((a) => {
    if (a.fim < inicio || a.inicio > fimHorizonte) return
    const motivo = a.descricao ? `${ROTULO_AUSENCIA[a.tipo]}: ${a.descricao}` : ROTULO_AUSENCIA[a.tipo]
    for (let t = Date.parse(`${a.inicio}T00:00:00Z`); t <= Date.parse(`${a.fim}T00:00:00Z`); t += 86_400_000) {
      const pos = posicaoNoHorizonte(inicio, new Date(t).toISOString().slice(0, 10))
      if (!pos || pos.semana > SEMANAS_CALENDARIO) continue
      if (a.pessoa_id === null) {
        ;(feriados[pos.semana] ??= {})[pos.dia] = a.descricao || ROTULO_AUSENCIA[a.tipo]
        dados.mundo.pessoas.forEach((_, p) => marcar(pos.semana, p, pos.dia, motivo))
      } else {
        const p = pessoa.get(a.pessoa_id)
        if (p !== undefined) marcar(pos.semana, p, pos.dia, motivo)
      }
    }
  })

  const congeladoAte = limiteCongelamento(inicio, agoraMs)
  return {
    inicio,
    semana0,
    inicioSerie,
    ...(congeladoAte > 0 ? { congeladoAte } : {}),
    ...(Object.keys(indisponivel).length ? { indisponivel } : {}),
    ...(Object.keys(feriados).length ? { feriados } : {}),
  }
}

/**
 * Leva ao motor o plano vigente (termo de estabilidade) e as âncoras, com as chaves do domínio:
 * `projeto|cerimônia|semana` e `projeto|cerimônia`.
 */
export function aplicarPlano(dados: DadosMundo, plano: PlanoBanco, agoraMs = Date.now()): DadosMundo {
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
  const calendario = montarCalendario(dados, plano, agoraMs)
  // o plano vigente foi gerado para o horizonte dele: a semana k de lá é a semana k − deslocamento daqui
  const deslocamento = plano.publicado?.horizonte_inicio
    ? calendario.semana0 - semanaAbsoluta(plano.publicado.horizonte_inicio)
    : 0
  const vigente: Record<string, { dia: number; slot: number }> = {}
  plano.ocorrencias.forEach((o) => {
    const k = chave(o.projeto_id, o.playbook_item_id)
    const semana = o.semana - deslocamento
    if (k && semana >= 1) vigente[`${k}|${semana}`] = { dia: o.dia, slot: o.slot }
  })

  const pessoa = new Map(dados.indices.pessoas.map((id, i) => [id, i]))
  const excecoes: Record<number, Partial<PremissasCargoEntrada>> = {}
  ;(plano.excecoes ?? []).forEach((x) => {
    const i = pessoa.get(x.pessoa_id)
    if (i === undefined || typeof x.valor !== "number") return
    excecoes[i] = { ...(excecoes[i] ?? {}), [x.campo]: x.valor }
  })

  const excecoesProjeto: Record<number, ExcecaoProjeto> = {}
  ;(plano.excecoes_projeto ?? []).forEach((x) => {
    const i = projeto.get(x.projeto_id)
    if (i === undefined || typeof x.valor !== "number") return
    excecoesProjeto[i] = { ...(excecoesProjeto[i] ?? {}), [x.campo]: x.valor }
  })

  return {
    ...dados,
    config: {
      ...dados.config,
      ancoras: Object.keys(ancoras).length ? ancoras : undefined,
      excecoesProjeto: Object.keys(excecoesProjeto).length ? excecoesProjeto : undefined,
      planoVigente: Object.keys(vigente).length ? vigente : undefined,
      pesoEstabilidade: 3,
      excecoesPessoa: Object.keys(excecoes).length ? excecoes : undefined,
      calendario,
    },
    ausencias: plano.ausencias ?? [],
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
      atrasoDias: pr.atraso_dias ?? 0,
      cliente: pr.cliente,
    }
  })

  const papeis: Record<Papel, PremissasCargoEntrada> = {}
  const custoHora: Record<Papel, number> = {}
  cargos.forEach((c) => {
    const p = b.premissas_cargo[c.id]
    if (p) papeis[c.nome] = mapearPremissa(p)
    if (p?.custo_hora !== undefined && p.custo_hora !== null) custoHora[c.nome] = Number(p.custo_hora)
  })

  const config: Config = {
    horizonte: opcoes.horizonte ?? 4,
    perfil: opcoes.perfil ?? "equilibrio",
    rebalancear: opcoes.rebalancear ?? true,
    papeis,
    geral: mapearGerais(b.premissas_gerais),
    etapas: urgencias,
    clientes: { ...b.prioridades },
    custoHora,
    ...(b.premissas_gerais.modificadores_automaticos === true ? { modificadores: true } : {}),
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
