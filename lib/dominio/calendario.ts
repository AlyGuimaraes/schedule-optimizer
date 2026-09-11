import { DIAS, SLOTS_DIA } from "./padroes"
import type { Config } from "./tipos"

// Datas reais do horizonte (E14, defeito 8). O motor trabalha em semanas do horizonte (1 em diante),
// dias 0 a 4 e slots de 30 minutos a partir das 08:00. Aqui ficam as conversões para o calendário
// de São Paulo, em UTC−3 fixo (sem horário de verão desde 2019).

const DIA_MS = 86_400_000
const FUSO_MS = 3 * 3600_000
const SLOT_MS = 30 * 60_000
/** Segunda-feira de referência para numerar as semanas absolutas. */
const EPOCA = Date.UTC(2024, 0, 1)

const meiaNoiteUTC = (data: string) => Date.parse(`${data}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Data local (AAAA-MM-DD) de um instante. */
export function dataLocal(ms: number): string {
  return iso(ms - FUSO_MS)
}

/** Próxima segunda-feira em São Paulo: é onde o horizonte de planejamento começa. */
export function proximaSegunda(agoraMs = Date.now()): string {
  const agora = new Date(agoraMs - FUSO_MS)
  const faltam = (8 - agora.getUTCDay()) % 7 || 7
  return iso(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + faltam))
}

/** Semana absoluta de uma data: segundas-feiras desde 2024-01-01. */
export function semanaAbsoluta(data: string): number {
  return Math.floor((meiaNoiteUTC(data) - EPOCA) / (7 * DIA_MS))
}

/** Data (AAAA-MM-DD) de um dia útil do horizonte. */
export function dataDoDia(inicio: string, semana: number, dia: number): string {
  return iso(meiaNoiteUTC(inicio) + ((semana - 1) * 7 + dia) * DIA_MS)
}

/** Onde uma data cai no horizonte; null antes do início ou no fim de semana. */
export function posicaoNoHorizonte(inicio: string, data: string): { semana: number; dia: number } | null {
  const dias = Math.round((meiaNoiteUTC(data) - meiaNoiteUTC(inicio)) / DIA_MS)
  if (dias < 0) return null
  const dia = dias % 7
  if (dia >= DIAS) return null
  return { semana: Math.floor(dias / 7) + 1, dia }
}

/** Instante real (ms) de um slot do motor. O slot 0 é 08:00 em São Paulo. */
export function instanteSlot(inicio: string, semana: number, dia: number, slot: number): number {
  return meiaNoiteUTC(inicio) + FUSO_MS + ((semana - 1) * 7 + dia) * DIA_MS + (8 * 60 + slot * 30) * 60_000
}

/** Instante real (ms) de um slot numa data local (AAAA-MM-DD). O slot 0 é 08:00 em São Paulo. */
export function instanteNaData(data: string, slot: number): number {
  return meiaNoiteUTC(data) + FUSO_MS + (8 * 60 + slot * 30) * 60_000
}

/** Pedaço de um intervalo real num dia útil, na grade do motor (`fim` exclusivo). */
export interface PedacoDoDia {
  data: string
  inicio: number
  fim: number
}

/**
 * Recorta um intervalo real [inicioMs, fimMs) em pedaços por dia útil, na grade de 30 minutos do
 * motor (E09). O início desce e o fim sobe para a meia hora, e cada pedaço fica preso à janela de
 * trabalho `[janela.inicio, janela.fim)`. Fim de semana e o que cai fora da janela somem.
 */
export function pedacosNosDias(
  inicioMs: number,
  fimMs: number,
  janela: { inicio: number; fim: number } = { inicio: 0, fim: SLOTS_DIA }
): PedacoDoDia[] {
  const pedacos: PedacoDoDia[] = []
  if (!(fimMs > inicioMs)) return pedacos
  const ultimo = meiaNoiteUTC(dataLocal(fimMs - 1))
  for (let t = meiaNoiteUTC(dataLocal(inicioMs)); t <= ultimo; t += DIA_MS) {
    const semana = new Date(t).getUTCDay()
    if (semana === 0 || semana === 6) continue
    const data = iso(t)
    const base = instanteNaData(data, 0)
    const inicio = Math.max(janela.inicio, Math.floor((inicioMs - base) / SLOT_MS))
    const fim = Math.min(janela.fim, Math.ceil((fimMs - base) / SLOT_MS))
    if (fim > inicio) pedacos.push({ data, inicio, fim })
  }
  return pedacos
}

/** Posição de um slot na semana, na ordem do tempo: dia × SLOTS_DIA + slot. */
export const posicaoNaSemana = (dia: number, slot: number) => dia * SLOTS_DIA + slot

/**
 * Antecedência mínima de convocação (§2.2): nada novo ou movido a menos de `horas` do início.
 * Devolve a primeira posição da semana 1 que ainda pode mudar; 0 quando nada está congelado.
 */
export function limiteCongelamento(inicio: string, agoraMs: number, horas = 48): number {
  const corte = agoraMs + horas * 3600_000
  for (let d = 0; d < DIAS; d++)
    for (let s = 0; s < SLOTS_DIA; s++) if (instanteSlot(inicio, 1, d, s) >= corte) return posicaoNaSemana(d, s)
  return DIAS * SLOTS_DIA
}

/**
 * A série acontece nesta semana do horizonte? Sem calendário vale a regra do protótipo,
 * `(projeto + semana) % cada`, que recomeça a cada horizonte e depende da ordem dos projetos.
 * Com calendário, a cadência conta a partir do início real da série (defeito 8): uma quinzenal
 * continua quinzenal de um horizonte para o outro.
 */
export function ocorreNaSemana(
  projetoId: number,
  tipo: string,
  cada: number,
  semana: number,
  cfg?: Partial<Config>
): boolean {
  const cal = cfg?.calendario
  if (!cal) return (projetoId + semana) % cada === 0
  const abs = cal.semana0 + semana - 1
  const inicio = cal.inicioSerie?.[`${projetoId}|${tipo}`] ?? cal.semana0
  return abs >= inicio && (abs - inicio) % cada === 0
}

/** Rótulo curto de uma data para cabeçalhos: "14/09". */
export function diaMes(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}
