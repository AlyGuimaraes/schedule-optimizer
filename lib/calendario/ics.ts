import type { ClassificacaoEvento } from "@/lib/dados/mapeador"
import { dataLocal, pedacosNosDias } from "@/lib/dominio/calendario"
import { SLOTS_DIA } from "@/lib/dominio/padroes"

import type { EventoImportado } from "./importacao"

// Leitura de arquivos .ics (RFC 5545) para a importação da agenda atual (E09). Funções puras, que
// rodam no navegador: o arquivo nunca sai do dispositivo, só os eventos normalizados e sem título.
//
// Cobre o que as exportações do Outlook e do Google produzem:
// - VEVENT com DTSTART e DTEND ou DURATION; dia inteiro (VALUE=DATE) vira bloqueio do dia todo
// - horário em UTC (sufixo Z); com TZID, pelo nome IANA (via Intl), pelos nomes do Windows mais
//   comuns no Outlook, por "(UTC-03:00) ..." ou pelo deslocamento do VTIMEZONE do próprio arquivo;
//   sem fuso (horário flutuante), no fuso X-WR-TIMEZONE do calendário ou em São Paulo
// - linhas dobradas, texto escapado, ATTENDEE e ORGANIZER (salas e recursos não contam)
// - STATUS:CANCELLED, TRANSP:TRANSPARENT e X-MICROSOFT-CDO-BUSYSTATUS:FREE ficam de fora
// - RRULE com FREQ=DAILY ou WEEKLY (INTERVAL, BYDAY, COUNT, UNTIL, WKST), RDATE, EXDATE e
//   ocorrências alteradas (RECURRENCE-ID), expandidas só dentro da janela pedida
//
// Limites conhecidos: FREQ=MONTHLY e YEARLY não são expandidas (entra só a primeira ocorrência,
// com aviso); BYMONTHDAY, BYSETPOS e afins são ignorados; um VTIMEZONE com horário de verão e nome
// desconhecido vale pelo deslocamento padrão (STANDARD), sem a troca de horário; convite recusado
// pela própria pessoa (PARTSTAT=DECLINED) ainda conta como compromisso.

const DIA_MS = 86_400_000
/** Teto de eventos por arquivo, depois da expansão: acima disso a leitura para, com aviso. */
export const MAX_EVENTOS_ARQUIVO = 5000

/** Intervalo real em milissegundos, com `fim` exclusivo. */
export interface Janela {
  inicio: number
  fim: number
}

/** Um evento (ou uma ocorrência de série) lido do arquivo. */
export interface EventoIcs {
  uid: string
  /** UID mais a ocorrência: estável entre importações do mesmo arquivo */
  externalId: string
  /** só em memória, no navegador: serve à classificação e ao hash, nunca é gravado */
  titulo: string
  inicio: number
  fim: number
  diaInteiro: boolean
  /** e-mails de organizador e convidados, sem repetição */
  participantes: string[]
  recorrente: boolean
}

export interface LeituraIcs {
  eventos: EventoIcs[]
  avisos: string[]
  /** eventos do arquivo que ficaram de fora antes da expansão */
  ignorados: { cancelados: number; livres: number; semData: number }
}

// ─────────────────────── linhas e componentes ───────────────────────

interface Propriedade {
  nome: string
  params: Record<string, string>
  valor: string
}

interface Componente {
  tipo: string
  props: Propriedade[]
  filhos: Componente[]
}

/** Desdobra as linhas (RFC 5545 §3.1): quebra seguida de espaço ou tab continua a linha anterior. */
export function desdobrarLinhas(texto: string): string[] {
  return texto
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0)
}

/** Texto escapado (§3.3.11): \n, \, \; e \\. */
export function desescapar(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c))
}

function dividir(s: string, sep: string): string[] {
  const partes: string[] = []
  let atual = ""
  let aspas = false
  for (const c of s) {
    if (c === '"') aspas = !aspas
    if (c === sep && !aspas) {
      partes.push(atual)
      atual = ""
    } else atual += c
  }
  partes.push(atual)
  return partes
}

function lerLinha(linha: string): Propriedade | null {
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') aspas = !aspas
    else if (c === ":" && !aspas) {
      const [nome, ...resto] = dividir(linha.slice(0, i), ";")
      const params: Record<string, string> = {}
      resto.forEach((p) => {
        const eq = p.indexOf("=")
        if (eq > 0) params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).replace(/^"(.*)"$/, "$1")
      })
      return { nome: nome.trim().toUpperCase(), params, valor: linha.slice(i + 1) }
    }
  }
  return null
}

function lerComponentes(linhas: string[]): Componente {
  const raiz: Componente = { tipo: "RAIZ", props: [], filhos: [] }
  const pilha = [raiz]
  for (const l of linhas) {
    const p = lerLinha(l)
    if (!p) continue
    const topo = pilha[pilha.length - 1]
    if (p.nome === "BEGIN") {
      const c: Componente = { tipo: p.valor.trim().toUpperCase(), props: [], filhos: [] }
      topo.filhos.push(c)
      pilha.push(c)
    } else if (p.nome === "END") {
      const i = pilha.map((c) => c.tipo).lastIndexOf(p.valor.trim().toUpperCase())
      if (i > 0) pilha.length = i
    } else topo.props.push(p)
  }
  return raiz
}

const prop = (c: Componente, nome: string) => c.props.find((p) => p.nome === nome)
const todas = (c: Componente, nome: string) => c.props.filter((p) => p.nome === nome)

function componentes(c: Componente, tipo: string, saida: Componente[] = []): Componente[] {
  c.filhos.forEach((f) => {
    if (f.tipo === tipo) saida.push(f)
    else componentes(f, tipo, saida)
  })
  return saida
}

// ─────────────────────── fusos ───────────────────────

type Fuso = { tipo: "iana"; zona: string } | { tipo: "fixo"; minutos: number }

const UTC: Fuso = { tipo: "fixo", minutos: 0 }
/** O fuso do motor (lib/dominio/calendario.ts): UTC−3 fixo, sem horário de verão desde 2019. */
const SAO_PAULO: Fuso = { tipo: "fixo", minutos: -180 }

/** Nomes do Windows que o Outlook grava no TZID, para os fusos IANA equivalentes. */
const FUSOS_WINDOWS: Record<string, string> = {
  "E. South America Standard Time": "America/Sao_Paulo",
  "SA Eastern Standard Time": "America/Fortaleza",
  "Bahia Standard Time": "America/Bahia",
  "Tocantins Standard Time": "America/Araguaina",
  "Central Brazilian Standard Time": "America/Cuiaba",
  "SA Western Standard Time": "America/Manaus",
  "SA Pacific Standard Time": "America/Bogota",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "Pacific SA Standard Time": "America/Santiago",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Coordinated Universal Time": "UTC",
  "UTC": "UTC",
}

const formatadores = new Map<string, Intl.DateTimeFormat>()

function formatador(zona: string): Intl.DateTimeFormat {
  let f = formatadores.get(zona)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    formatadores.set(zona, f)
  }
  return f
}

function zonaIana(zona: string): boolean {
  try {
    formatador(zona)
    return true
  } catch {
    return false
  }
}

/** Deslocamento do fuso IANA em minutos (negativo a oeste de Greenwich) num instante. */
function deslocamento(zona: string, ms: number): number {
  const partes = formatador(zona).formatToParts(new Date(ms))
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value)
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"))
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000)
}

/** "-0300", "+0530" ou "-030000" em minutos. */
function lerDeslocamento(v: string): number | null {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(v.trim())
  if (!m) return null
  const min = Number(m[2]) * 60 + Number(m[3])
  return m[1] === "-" ? -min : min
}

interface Contexto {
  flutuante: Fuso
  /** VTIMEZONE do arquivo: deslocamento padrão e se há horário de verão */
  definidos: Record<string, { minutos: number; comVerao: boolean }>
  avisos: Set<string>
}

function resolverFuso(tzid: string, ctx: Contexto): Fuso {
  const nome = tzid.trim().replace(/^\/+/, "")
  if (/^(utc|gmt|z)$/i.test(nome)) return UTC
  if (zonaIana(nome)) return { tipo: "iana", zona: nome }
  const windows = FUSOS_WINDOWS[nome]
  if (windows) return { tipo: "iana", zona: windows }
  const m = /(?:UTC|GMT)\s*([+-])(\d{1,2}):?(\d{2})/i.exec(nome)
  if (m) {
    const min = Number(m[2]) * 60 + Number(m[3])
    return { tipo: "fixo", minutos: m[1] === "-" ? -min : min }
  }
  const def = ctx.definidos[nome]
  if (def) {
    if (def.comVerao) ctx.avisos.add(`Fuso "${nome}" tem horário de verão; os horários foram lidos pelo deslocamento padrão.`)
    return { tipo: "fixo", minutos: def.minutos }
  }
  ctx.avisos.add(`Fuso "${nome}" desconhecido; os horários foram lidos como São Paulo.`)
  return SAO_PAULO
}

// ─────────────────────── datas ───────────────────────

interface Local {
  a: number
  m: number
  d: number
  h: number
  mi: number
  s: number
}

interface Instante {
  ms: number
  local: Local
  diaInteiro: boolean
  fuso: Fuso
}

/** Dia do calendário local como número (dias desde 1970-01-01), para a aritmética da recorrência. */
const diaDe = (l: Local) => Math.round(Date.UTC(l.a, l.m - 1, l.d) / DIA_MS)
const diaDaSemana = (dia: number) => new Date(dia * DIA_MS).getUTCDay()

function comDia(l: Local, dia: number): Local {
  const x = new Date(dia * DIA_MS)
  return { ...l, a: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }
}

/** Hora de parede num fuso para o instante real. Com IANA, corrige na troca de horário de verão. */
function paraMs(l: Local, fuso: Fuso): number {
  const ingenuo = Date.UTC(l.a, l.m - 1, l.d, l.h, l.mi, l.s)
  if (fuso.tipo === "fixo") return ingenuo - fuso.minutos * 60_000
  const t = ingenuo - deslocamento(fuso.zona, ingenuo) * 60_000
  return ingenuo - deslocamento(fuso.zona, t) * 60_000
}

/**
 * DATE (20260915) ou DATE-TIME (20260915T090000, com Z ou TZID). Dia inteiro é lido no fuso do
 * motor, para a data do arquivo cair na mesma data da grade. `padrao` é o fuso do DTSTART, que vale
 * para EXDATE, UNTIL e RECURRENCE-ID sem TZID.
 */
function lerInstante(valor: string, params: Record<string, string>, ctx: Contexto, padrao?: Fuso): Instante | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(valor.trim())
  if (!m) return null
  const diaInteiro = !m[4] || params.VALUE === "DATE"
  const local: Local = {
    a: Number(m[1]),
    m: Number(m[2]),
    d: Number(m[3]),
    h: diaInteiro ? 0 : Number(m[4]),
    mi: diaInteiro ? 0 : Number(m[5]),
    s: diaInteiro || !m[6] ? 0 : Number(m[6]),
  }
  const fuso = diaInteiro
    ? SAO_PAULO
    : m[7]
      ? UTC
      : params.TZID
        ? resolverFuso(params.TZID, ctx)
        : (padrao ?? ctx.flutuante)
  return { ms: paraMs(local, fuso), local, diaInteiro, fuso }
}

/** DURATION (§3.3.6): P1D, PT1H30M, P1W. */
function lerDuracao(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(v.trim())
  if (!m) return null
  const n = (i: number) => Number(m[i] ?? 0)
  const ms = ((n(2) * 7 + n(3)) * 86_400 + n(4) * 3600 + n(5) * 60 + n(6)) * 1000
  return m[1] === "-" ? -ms : ms
}

/** Carimbo da ocorrência no id externo: data local no dia inteiro, UTC compacto no resto. */
function carimbo(ms: number, diaInteiro: boolean): string {
  return diaInteiro
    ? dataLocal(ms).replace(/-/g, "")
    : new Date(ms).toISOString().replace(/\.\d{3}/, "").replace(/[-:]/g, "")
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

// ─────────────────────── recorrência ───────────────────────

const DIAS_SEMANA: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

interface Regra {
  freq: string
  intervalo: number
  count?: number
  ate?: Instante
  byday?: number[]
  wkst: number
}

function lerRegra(v: string, ctx: Contexto, padrao: Fuso): Regra {
  const p: Record<string, string> = {}
  v.split(";").forEach((x) => {
    const eq = x.indexOf("=")
    if (eq > 0) p[x.slice(0, eq).trim().toUpperCase()] = x.slice(eq + 1).trim()
  })
  const byday = p.BYDAY
    ? p.BYDAY.split(",")
        .map((d) => DIAS_SEMANA[d.replace(/^[+-]?\d+/, "").trim().toUpperCase()])
        .filter((d): d is number => d !== undefined)
    : []
  const count = p.COUNT !== undefined ? parseInt(p.COUNT, 10) : NaN
  return {
    freq: (p.FREQ ?? "").toUpperCase(),
    intervalo: Math.max(1, parseInt(p.INTERVAL ?? "1", 10) || 1),
    count: Number.isFinite(count) ? Math.max(0, count) : undefined,
    ate: p.UNTIL ? (lerInstante(p.UNTIL, {}, ctx, padrao) ?? undefined) : undefined,
    byday: byday.length ? [...new Set(byday)] : undefined,
    wkst: DIAS_SEMANA[(p.WKST ?? "MO").toUpperCase()] ?? 1,
  }
}

/** Datas candidatas da regra, em ordem, a partir do dia do DTSTART e até `limite`. */
function* datasDaRegra(regra: Regra, d0: number, limite: number): Generator<number> {
  if (regra.freq === "DAILY") {
    for (let d = d0; d <= limite; d += regra.intervalo)
      if (!regra.byday || regra.byday.includes(diaDaSemana(d))) yield d
    return
  }
  // WEEKLY: semanas começam no WKST; sem BYDAY, o dia da semana do DTSTART
  const deslocs = (regra.byday ?? [diaDaSemana(d0)]).map((w) => (w - regra.wkst + 7) % 7).sort((a, b) => a - b)
  const base0 = d0 - ((diaDaSemana(d0) - regra.wkst + 7) % 7)
  for (let base = base0; base <= limite; base += 7 * regra.intervalo)
    for (const o of deslocs) if (base + o >= d0 && base + o <= limite) yield base + o
}

/**
 * Início de cada ocorrência (ms) que toca a janela. COUNT conta desde o DTSTART, inclusive as
 * ocorrências tiradas por EXDATE, como manda o §3.8.5.3.
 */
function expandir(
  inicio: Instante,
  dur: number,
  regra: Regra,
  janela: Janela,
  excluida: (ms: number, dia: number) => boolean
): number[] {
  const limite = Math.floor(janela.fim / DIA_MS) + 2
  const diaMin = Math.floor((janela.inicio - dur) / DIA_MS) - 2
  const saida: number[] = []
  let n = 0
  for (const dia of datasDaRegra(regra, diaDe(inicio.local), limite)) {
    // sem COUNT, o que termina antes da janela nem precisa virar instante
    if (regra.count === undefined && dia < diaMin) continue
    const ms = paraMs(comDia(inicio.local, dia), inicio.fuso)
    if (regra.ate && (regra.ate.diaInteiro ? dia > diaDe(regra.ate.local) : ms > regra.ate.ms)) break
    n++
    if (regra.count !== undefined && n > regra.count) break
    if (ms >= janela.fim) break
    if (excluida(ms, dia)) continue
    if (ms + dur > janela.inicio) saida.push(ms)
    if (saida.length >= MAX_EVENTOS_ARQUIVO) break
  }
  return saida
}

// ─────────────────────── eventos ───────────────────────

interface Bruto {
  uid: string
  titulo: string
  inicio: Instante
  dur: number
  participantes: string[]
  cancelado: boolean
  livre: boolean
  rrule?: string
  rdates: Instante[]
  exdates: Instante[]
  recurrenceId?: Instante
}

function lerDatas(c: Componente, nome: string, ctx: Contexto, padrao: Fuso): Instante[] {
  return todas(c, nome).flatMap((p) =>
    p.valor
      .split(",")
      .map((v) => lerInstante(v.split("/")[0], p.params, ctx, padrao))
      .filter((x): x is Instante => x !== null)
  )
}

function lerEvento(c: Componente, ctx: Contexto): Bruto | null {
  const dtstart = prop(c, "DTSTART")
  const inicio = dtstart ? lerInstante(dtstart.valor, dtstart.params, ctx) : null
  if (!dtstart || !inicio) return null

  const dtend = prop(c, "DTEND")
  const duration = prop(c, "DURATION")
  let fim = inicio.diaInteiro ? inicio.ms + DIA_MS : inicio.ms
  if (dtend) fim = lerInstante(dtend.valor, dtend.params, ctx, inicio.fuso)?.ms ?? fim
  else if (duration) fim = inicio.ms + (lerDuracao(duration.valor) ?? 0)

  const emails = new Set<string>()
  ;[...todas(c, "ORGANIZER"), ...todas(c, "ATTENDEE")].forEach((p) => {
    const tipo = (p.params.CUTYPE ?? "").toUpperCase()
    if (tipo === "ROOM" || tipo === "RESOURCE") return
    const bruto = /^mailto:/i.test(p.valor) ? p.valor.replace(/^mailto:/i, "") : (p.params.EMAIL ?? p.valor)
    const email = bruto.trim().toLowerCase()
    if (email.includes("@")) emails.add(email)
  })

  const titulo = desescapar(prop(c, "SUMMARY")?.valor ?? "").trim()
  const uid = prop(c, "UID")?.valor.trim() || `sem-uid-${fnv1a(`${dtstart.valor}|${titulo}`)}`
  const recId = prop(c, "RECURRENCE-ID")
  const status = (prop(c, "STATUS")?.valor ?? "").trim().toUpperCase()
  const transp = (prop(c, "TRANSP")?.valor ?? "").trim().toUpperCase()
  const ocupacao = (prop(c, "X-MICROSOFT-CDO-BUSYSTATUS")?.valor ?? "").trim().toUpperCase()

  return {
    uid,
    titulo,
    inicio,
    dur: Math.max(0, fim - inicio.ms),
    participantes: [...emails],
    cancelado: status === "CANCELLED",
    livre: transp === "TRANSPARENT" || ocupacao === "FREE",
    rrule: prop(c, "RRULE")?.valor,
    rdates: lerDatas(c, "RDATE", ctx, inicio.fuso),
    exdates: lerDatas(c, "EXDATE", ctx, inicio.fuso),
    recurrenceId: recId ? (lerInstante(recId.valor, recId.params, ctx, inicio.fuso) ?? undefined) : undefined,
  }
}

function lerFusosDefinidos(raiz: Componente): Contexto["definidos"] {
  const definidos: Contexto["definidos"] = {}
  componentes(raiz, "VTIMEZONE").forEach((tz) => {
    const nome = prop(tz, "TZID")?.valor.trim().replace(/^\/+/, "")
    if (!nome) return
    const padrao = tz.filhos.find((f) => f.tipo === "STANDARD") ?? tz.filhos[0]
    const minutos = padrao ? lerDeslocamento(prop(padrao, "TZOFFSETTO")?.valor ?? "") : null
    if (minutos === null) return
    const outros = tz.filhos.map((f) => lerDeslocamento(prop(f, "TZOFFSETTO")?.valor ?? ""))
    definidos[nome] = { minutos, comVerao: outros.some((x) => x !== null && x !== minutos) }
  })
  return definidos
}

/**
 * Lê um .ics e devolve os eventos que tocam a janela, com as séries expandidas. Nada é descartado
 * em silêncio: cancelados, livres e sem data voltam contados, e o que não foi entendido vira aviso.
 */
export function lerIcs(texto: string, janela: Janela): LeituraIcs {
  const raiz = lerComponentes(desdobrarLinhas(texto))
  const avisos = new Set<string>()
  const ignorados = { cancelados: 0, livres: 0, semData: 0 }
  const ctx: Contexto = { flutuante: SAO_PAULO, definidos: lerFusosDefinidos(raiz), avisos }
  const xwr = componentes(raiz, "VCALENDAR")
    .map((c) => prop(c, "X-WR-TIMEZONE")?.valor)
    .find((v) => !!v)
  if (xwr) ctx.flutuante = resolverFuso(xwr, ctx)

  const mestres: Bruto[] = []
  const alteradas = new Map<string, Bruto[]>()
  componentes(raiz, "VEVENT").forEach((c) => {
    const ev = lerEvento(c, ctx)
    if (!ev) {
      ignorados.semData++
      return
    }
    if (ev.recurrenceId) alteradas.set(ev.uid, [...(alteradas.get(ev.uid) ?? []), ev])
    else mestres.push(ev)
  })

  const eventos: EventoIcs[] = []
  const toca = (ms: number, dur: number) => ms < janela.fim && ms + Math.max(dur, 1) > janela.inicio
  const emitir = (b: Bruto, ms: number, externalId: string, recorrente: boolean) => {
    if (!toca(ms, b.dur) || b.dur <= 0) return
    eventos.push({
      uid: b.uid,
      externalId,
      titulo: b.titulo,
      inicio: ms,
      fim: ms + b.dur,
      diaInteiro: b.inicio.diaInteiro,
      participantes: b.participantes,
      recorrente,
    })
  }
  const pular = (b: Bruto) => {
    if (b.cancelado) ignorados.cancelados++
    else if (b.livre) ignorados.livres++
    return b.cancelado || b.livre
  }

  mestres.forEach((m) => {
    const excecoes = alteradas.get(m.uid) ?? []
    alteradas.delete(m.uid)
    if (pular(m)) return
    const serie = !!m.rrule || m.rdates.length > 0
    if (!serie) {
      emitir(m, m.inicio.ms, m.uid, false)
      return
    }
    const id = (ms: number) => `${m.uid}|${carimbo(ms, m.inicio.diaInteiro)}`
    const fora = new Set([...m.exdates.map((x) => x.ms), ...excecoes.flatMap((x) => (x.recurrenceId ? [x.recurrenceId.ms] : []))])
    const foraDias = new Set(m.exdates.filter((x) => x.diaInteiro).map((x) => diaDe(x.local)))
    const excluida = (ms: number, dia: number) => fora.has(ms) || (!m.inicio.diaInteiro && foraDias.has(dia))

    if (m.rrule) {
      const regra = lerRegra(m.rrule, ctx, m.inicio.fuso)
      if (regra.freq === "DAILY" || regra.freq === "WEEKLY") {
        expandir(m.inicio, m.dur, regra, janela, excluida).forEach((ms) => emitir(m, ms, id(ms), true))
      } else {
        avisos.add(`Recorrência ${regra.freq || "sem FREQ"} não é expandida: entrou só a primeira ocorrência.`)
        if (!excluida(m.inicio.ms, diaDe(m.inicio.local))) emitir(m, m.inicio.ms, id(m.inicio.ms), true)
      }
    } else if (!excluida(m.inicio.ms, diaDe(m.inicio.local))) emitir(m, m.inicio.ms, id(m.inicio.ms), true)

    m.rdates.forEach((r) => {
      const ms = paraMs({ ...r.local, h: m.inicio.local.h, mi: m.inicio.local.mi, s: m.inicio.local.s }, m.inicio.fuso)
      const inst = r.diaInteiro && !m.inicio.diaInteiro ? ms : r.ms
      if (!excluida(inst, diaDe(r.local))) emitir(m, inst, id(inst), true)
    })

    // ocorrência alterada: vale o horário novo, com o id da ocorrência original
    excecoes.forEach((x) => {
      if (pular(x) || !x.recurrenceId) return
      emitir(x, x.inicio.ms, id(x.recurrenceId.ms), true)
    })
  })

  // alteradas cuja série não veio no arquivo entram como eventos avulsos
  alteradas.forEach((lista) =>
    lista.forEach((x) => {
      if (pular(x) || !x.recurrenceId) return
      emitir(x, x.inicio.ms, `${x.uid}|${carimbo(x.recurrenceId.ms, x.recurrenceId.diaInteiro)}`, true)
    })
  )

  const vistos = new Set<string>()
  const unicos = eventos
    .sort((a, b) => a.inicio - b.inicio || a.externalId.localeCompare(b.externalId))
    .filter((e) => (vistos.has(e.externalId) ? false : (vistos.add(e.externalId), true)))
  if (unicos.length > MAX_EVENTOS_ARQUIVO)
    avisos.add(`O arquivo passou de ${MAX_EVENTOS_ARQUIVO} eventos na janela; os mais distantes ficaram de fora.`)

  return { eventos: unicos.slice(0, MAX_EVENTOS_ARQUIVO), avisos: [...avisos], ignorados }
}

// ─────────────────────── normalização ───────────────────────

/** Pedaço de um evento num dia útil, na grade de 30 minutos do motor. */
export interface EventoNormalizado {
  externalId: string
  titulo: string
  participantes: string[]
  diaInteiro: boolean
  /** data local (AAAA-MM-DD) */
  data: string
  /** slots da grade do motor, `slotFim` exclusivo */
  slotInicio: number
  slotFim: number
  /** instantes (ms) já alinhados à grade */
  inicio: number
  fim: number
}

/**
 * Normaliza em slots de 30 minutos (E09): cada evento vira um pedaço por dia útil, com o início
 * arredondado para baixo e o fim para cima, preso à janela de trabalho. Fim de semana e o que cai
 * todo fora da janela saem. Evento de vários dias ganha a data no id de cada pedaço.
 */
export function normalizarEventos(
  eventos: EventoIcs[],
  janelaTrabalho: { inicio: number; fim: number } = { inicio: 0, fim: SLOTS_DIA }
): EventoNormalizado[] {
  const saida: EventoNormalizado[] = []
  const vistos = new Set<string>()
  eventos.forEach((ev) => {
    const variosDias = dataLocal(ev.inicio) !== dataLocal(ev.fim - 1)
    pedacosNosDias(ev.inicio, ev.fim, janelaTrabalho).forEach((p) => {
      const externalId = variosDias ? `${ev.externalId}|${p.data}` : ev.externalId
      if (vistos.has(externalId)) return
      vistos.add(externalId)
      const base = Date.parse(`${p.data}T08:00:00-03:00`)
      saida.push({
        externalId,
        titulo: ev.titulo,
        participantes: ev.participantes,
        diaInteiro: ev.diaInteiro,
        data: p.data,
        slotInicio: p.inicio,
        slotFim: p.fim,
        inicio: base + p.inicio * 30 * 60_000,
        fim: base + p.fim * 30 * 60_000,
      })
    })
  })
  return saida
}

// ─────────────────────── classificação ───────────────────────

/** O que o classificador conhece da operação: projetos com cliente e os tipos do playbook. */
export interface ContextoClassificacao {
  projetos: { nome: string; cliente?: string }[]
  tipos: string[]
}

export interface Classificacao {
  classificacao: ClassificacaoEvento
  /** índice do projeto reconhecido em `ContextoClassificacao.projetos` */
  projeto?: number
  /** tipo do playbook reconhecido */
  tipo?: string
}

/**
 * Rituais internos que marcam um evento como institucional. A comparação é por palavra inteira,
 * sem acento e sem caixa, então "Reunião Geral" casa com "reuniao geral" e "RH" não casa com "rhythm".
 */
export const PALAVRAS_INSTITUCIONAIS = [
  "1:1",
  "1x1",
  "one on one",
  "one-on-one",
  "all hands",
  "all-hands",
  "town hall",
  "townhall",
  "reunião geral",
  "reunião de time",
  "reunião do time",
  "reunião de equipe",
  "reunião da operação",
  "ritual",
  "treinamento interno",
  "capacitação",
  "workshop interno",
  "onboarding",
  "integração de novos",
  "feedback",
  "avaliação de desempenho",
  "pdi",
  "mentoria",
  "comitê",
  "café com",
  "happy hour",
  "confraternização",
  "planejamento interno",
  "alinhamento interno",
  "rh",
]

/** Palavras que não distinguem um tipo de cerimônia ("Reunião de Trabalho" vale por "trabalho"). */
const PARADAS = new Set(["de", "da", "do", "das", "dos", "com", "para", "pos", "reuniao", "sessao"])
/** Prefixos genéricos de razão social: "Grupo Aurora" também é reconhecido por "Aurora". */
const GENERICOS = new Set(["grupo", "cia", "companhia", "holding", "rede", "industrias", "agro", "log", "med"])

/** Sem acento, sem caixa, só letras e números separados por um espaço. */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const contem = (texto: string, termo: string) => termo.length > 0 && ` ${texto} `.includes(` ${termo} `)

function termosDoProjeto(p: { nome: string; cliente?: string }): string[] {
  const termos = new Set<string>()
  const incluir = (s?: string) => {
    if (!s) return
    const n = normalizarTexto(s)
    if (n.length >= 3) termos.add(n)
    const palavras = n.split(" ")
    let i = 0
    while (i < palavras.length - 1 && GENERICOS.has(palavras[i])) i++
    const resto = palavras.slice(i).join(" ")
    if (i > 0 && resto.length >= 4) termos.add(resto)
  }
  incluir(p.nome)
  incluir(p.cliente)
  return [...termos]
}

/** Força do casamento de um tipo do playbook com o título: nome inteiro, ou todas as palavras que distinguem. */
function casaTipo(titulo: string, tipo: string): number {
  const n = normalizarTexto(tipo)
  if (contem(titulo, n)) return 100 + n.length
  const palavras = n.split(" ").filter((w) => w.length >= 3 && !PARADAS.has(w))
  return palavras.length && palavras.every((w) => contem(titulo, w)) ? palavras.length : 0
}

/**
 * Classifica um evento da agenda (E09):
 * - `cerimonia`: o título (ou o domínio de um convidado) cita um projeto ou cliente E o título cita
 *   um tipo de cerimônia do playbook. Não bloqueia: é o otimizador que planeja as cerimônias.
 * - `institucional`: o título tem uma das `PALAVRAS_INSTITUCIONAIS`.
 * - `opaco`: todo o resto. Bloqueia e fica fora dos indicadores de cerimônia (§8).
 */
export function classificarEvento(
  titulo: string,
  participantes: string[],
  ctx: ContextoClassificacao
): Classificacao {
  const t = normalizarTexto(titulo)
  const dominios = participantes.map((e) => normalizarTexto(e.split("@")[1] ?? "")).filter(Boolean)

  let projeto: { i: number; forca: number } | null = null
  ctx.projetos.forEach((p, i) =>
    termosDoProjeto(p).forEach((termo) => {
      const forca = contem(t, termo) ? termo.length + 1000 : dominios.some((d) => contem(d, termo)) ? termo.length : 0
      if (forca && (!projeto || forca > projeto.forca)) projeto = { i, forca }
    })
  )
  let tipo: { tipo: string; forca: number } | null = null
  ctx.tipos.forEach((x) => {
    const forca = casaTipo(t, x)
    if (forca && (!tipo || forca > tipo.forca)) tipo = { tipo: x, forca }
  })
  const achouProjeto = projeto as { i: number; forca: number } | null
  const achouTipo = tipo as { tipo: string; forca: number } | null
  if (achouProjeto && achouTipo) return { classificacao: "cerimonia", projeto: achouProjeto.i, tipo: achouTipo.tipo }

  if (PALAVRAS_INSTITUCIONAIS.some((p) => contem(t, normalizarTexto(p)))) return { classificacao: "institucional" }
  return { classificacao: "opaco" }
}

// ─────────────────────── privacidade ───────────────────────

/** SHA-256 do título, em hexadecimal. É o único rastro do título que chega ao banco. */
export async function hashTitulo(titulo: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(titulo.trim()))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Prepara o que sai do navegador: início, fim, número de participantes, id externo, classificação,
 * hash do título e, na cerimônia reconhecida, o projeto e o tipo. O título e os e-mails ficam aqui.
 */
export async function prepararEventos(
  normalizados: EventoNormalizado[],
  ctx: ContextoClassificacao,
  idDoProjeto: (indice: number) => string | undefined = () => undefined
): Promise<EventoImportado[]> {
  return Promise.all(
    normalizados.map(async (e) => {
      const c = classificarEvento(e.titulo, e.participantes, ctx)
      return {
        externalId: e.externalId,
        inicio: new Date(e.inicio).toISOString(),
        fim: new Date(e.fim).toISOString(),
        participantes: e.participantes.length,
        classificacao: c.classificacao,
        tituloHash: await hashTitulo(e.titulo),
        projetoId: c.projeto !== undefined ? (idDoProjeto(c.projeto) ?? null) : null,
        cerimoniaTipo: c.tipo ?? null,
      }
    })
  )
}
