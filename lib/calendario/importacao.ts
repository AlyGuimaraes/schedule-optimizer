import type { ClassificacaoEvento } from "@/lib/dados/mapeador"
import type { Database } from "@/lib/dados/tipos-banco"
import { proximaSegunda } from "@/lib/dominio/calendario"

// Contrato entre o navegador e o servidor na importação da agenda (E09). O navegador lê o .ics e
// manda só `EventoImportado`; o servidor revalida tudo aqui antes de gravar, porque uma server
// action aceita POST direto (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md).

const DIA_MS = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/

/** Teto de eventos por importação, depois da normalização. */
export const MAX_EVENTOS_IMPORTACAO = 5000
/** Janela máxima de uma importação, em semanas: o trimestre do horizonte com folga. */
export const MAX_SEMANAS_IMPORTACAO = 30
export const CLASSIFICACOES: readonly ClassificacaoEvento[] = ["cerimonia", "institucional", "opaco"]

/**
 * Evento pronto para gravar, o único formato que sai do navegador. Privacidade (E09): início, fim,
 * número de participantes, id externo, classificação e hash do título. Nunca o título nem e-mails.
 */
export interface EventoImportado {
  externalId: string
  /** ISO 8601, já alinhado à grade de 30 minutos */
  inicio: string
  fim: string
  participantes: number
  classificacao: ClassificacaoEvento
  /** SHA-256 do título, em hexadecimal */
  tituloHash: string | null
  /** só na cerimônia reconhecida: o projeto e o tipo do playbook */
  projetoId: string | null
  cerimoniaTipo: string | null
}

/** Janela importada, em ISO 8601: dentro dela, a importação nova substitui a anterior. */
export interface JanelaImportacao {
  inicio: string
  fim: string
}

/** Resumo por pessoa para a aba Agendas do Time. */
export interface ResumoImportacao {
  pessoaId: string
  provedor: string
  cerimonia: number
  institucional: number
  opaco: number
  janelaInicio: string | null
  janelaFim: string | null
  importadoEm: string | null
}

/**
 * Janela padrão de importação: da segunda-feira desta semana até o fim de `semanas` semanas do
 * horizonte, que começa na próxima segunda. Meia-noite de São Paulo nas duas pontas.
 */
export function janelaDeImportacao(semanas: number, agoraMs = Date.now()): { inicio: number; fim: number } {
  const inicio = Date.parse(`${proximaSegunda(agoraMs)}T00:00:00-03:00`) - 7 * DIA_MS
  return { inicio, fim: inicio + (Math.max(1, Math.round(semanas)) + 1) * 7 * DIA_MS }
}

export function validarJanela(j: JanelaImportacao): { inicio: number; fim: number } {
  const inicio = Date.parse(j?.inicio ?? "")
  const fim = Date.parse(j?.fim ?? "")
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) throw new Error("Janela de importação inválida.")
  if (fim - inicio > MAX_SEMANAS_IMPORTACAO * 7 * DIA_MS)
    throw new Error(`A janela passa de ${MAX_SEMANAS_IMPORTACAO} semanas. Importe um período menor.`)
  return { inicio, fim }
}

/**
 * Revalida os eventos que o navegador mandou: descarta o que não tem id, datas ou classificação
 * válidas, o que cai fora da janela e ids repetidos. Só os campos do contrato passam adiante.
 */
export function validarEventos(bruto: unknown, janela: { inicio: number; fim: number }): EventoImportado[] {
  if (!Array.isArray(bruto)) throw new Error("Nenhum evento para importar.")
  if (bruto.length > MAX_EVENTOS_IMPORTACAO)
    throw new Error(`Mais de ${MAX_EVENTOS_IMPORTACAO} eventos na janela. Importe menos semanas.`)
  const vistos = new Set<string>()
  const saida: EventoImportado[] = []
  for (const x of bruto) {
    if (!x || typeof x !== "object") continue
    const e = x as Record<string, unknown>
    const externalId = typeof e.externalId === "string" ? e.externalId.trim().slice(0, 400) : ""
    const inicio = typeof e.inicio === "string" ? Date.parse(e.inicio) : NaN
    const fim = typeof e.fim === "string" ? Date.parse(e.fim) : NaN
    const classificacao = CLASSIFICACOES.find((c) => c === e.classificacao)
    if (!externalId || !classificacao || !Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) continue
    if (inicio >= janela.fim || fim <= janela.inicio || vistos.has(externalId)) continue
    vistos.add(externalId)
    const cerimonia = classificacao === "cerimonia"
    saida.push({
      externalId,
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      participantes:
        typeof e.participantes === "number" && Number.isFinite(e.participantes)
          ? Math.min(10_000, Math.max(0, Math.round(e.participantes)))
          : 0,
      classificacao,
      tituloHash: typeof e.tituloHash === "string" && HASH.test(e.tituloHash) ? e.tituloHash : null,
      projetoId: cerimonia && typeof e.projetoId === "string" && UUID.test(e.projetoId) ? e.projetoId : null,
      cerimoniaTipo: cerimonia && typeof e.cerimoniaTipo === "string" ? e.cerimoniaTipo.slice(0, 120) : null,
    })
  }
  return saida
}

type LinhaEvento = Database["public"]["Tables"]["eventos_externos"]["Insert"]

/** Linhas de `eventos_externos`, campo a campo: nada além do contrato chega ao banco. */
export function linhasParaGravar(pessoaId: string, importacaoId: string, eventos: EventoImportado[]): LinhaEvento[] {
  return eventos.map((e) => ({
    pessoa_id: pessoaId,
    provedor: "ics",
    external_id: e.externalId,
    inicio: e.inicio,
    fim: e.fim,
    opaco: e.classificacao === "opaco",
    classificacao: e.classificacao,
    participantes: e.participantes,
    titulo_hash: e.tituloHash,
    projeto_id: e.projetoId,
    cerimonia_tipo: e.cerimoniaTipo,
    importacao_id: importacaoId,
  }))
}
