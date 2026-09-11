import "server-only"

import {
  otimizar,
  validarPlano,
  type Cerimonia,
  type Config,
  type Mundo,
  type Pessoa,
  type ResultadoOtimizacao,
  type Violacao,
} from "@/lib/dominio"

import { VERSAO_CONTRATO, type RespostaSemana } from "./contrato"
import { mapearResposta, montarRequisicao } from "./mapeamento"

export interface OpcoesSolver {
  /** padrão: `process.env.SOLVER_URL` */
  url?: string
  /** padrão: `process.env.SOLVER_TOKEN`, enviado como Bearer */
  token?: string
  /** limite do CP-SAT em segundos (padrão 60) */
  limiteSegundos?: number
  workers?: number
  /** tempo máximo da chamada; padrão: limite do CP-SAT mais 30 s para montar o modelo e avaliar a dica */
  timeoutMs?: number
  log?: (mensagem: string) => void
}

export interface ResultadoSolver {
  resultado: ResultadoOtimizacao
  origem: "cpsat" | "guloso"
  /** por que o resultado é do guloso */
  motivo?: string
  /** tempo total, guloso e chamada incluídos */
  ms: number
  msGuloso: number
  resposta?: RespostaSemana
  /** violações rígidas encontradas no plano do CP-SAT, quando foi por isso que caiu no guloso */
  violacoes?: Violacao[]
}

function pareceResposta(v: unknown): v is RespostaSemana {
  if (!v || typeof v !== "object") return false
  const r = v as Record<string, unknown>
  return (
    typeof r.status === "string" &&
    Array.isArray(r.alocadas) &&
    Array.isArray(r.naoAlocadas) &&
    Array.isArray(r.concessoes)
  )
}

/**
 * Otimiza uma semana no solver CP-SAT (E15). O guloso roda sempre: é o warm start do CP-SAT e a
 * rede de segurança. O resultado volta do guloso, com o motivo no log, quando não há `SOLVER_URL`,
 * a chamada falha ou estoura o tempo, o solver não acha solução, a resposta sai do contrato,
 * `validarPlano` acha violação rígida ou o CP-SAT fica pior que o guloso no mesmo objetivo.
 */
export async function otimizarComSolver(
  demanda: Cerimonia[],
  pessoas: Pessoa[],
  cfg: Config,
  mundo?: Mundo,
  opcoes: OpcoesSolver = {}
): Promise<ResultadoSolver> {
  const t0 = performance.now()
  // `otimizar` marca dia e slot nas cerimônias que recebe; a demanda original fica intacta
  const guloso = otimizar(
    demanda.map((ev) => ({ ...ev })),
    pessoas,
    cfg,
    mundo
  )
  const msGuloso = performance.now() - t0
  const log = opcoes.log ?? ((m: string) => console.warn(m))

  const cair = (motivo: string, extra: Partial<ResultadoSolver> = {}): ResultadoSolver => {
    log(`[solver] usando o guloso: ${motivo}`)
    return { resultado: guloso, origem: "guloso", motivo, ms: performance.now() - t0, msGuloso, ...extra }
  }

  const url = opcoes.url ?? process.env.SOLVER_URL
  if (!url) return cair("SOLVER_URL não definida")

  const limiteSegundos = opcoes.limiteSegundos ?? 60
  const req = montarRequisicao(demanda, pessoas, cfg, mundo, {
    dica: guloso,
    opcoes: { limiteSegundos, workers: opcoes.workers ?? 8, semente: 0, avaliarDica: true },
  })
  const token = opcoes.token ?? process.env.SOLVER_TOKEN
  const timeoutMs = opcoes.timeoutMs ?? (limiteSegundos + 30) * 1000
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), timeoutMs)

  let bruta: unknown
  try {
    const r = await fetch(`${url.replace(/\/+$/, "")}/resolver`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(req),
      signal: controle.signal,
    })
    if (!r.ok) return cair(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
    bruta = await r.json()
  } catch (e) {
    return cair(
      controle.signal.aborted
        ? `tempo esgotado em ${timeoutMs} ms`
        : `falha na chamada: ${e instanceof Error ? e.message : String(e)}`
    )
  } finally {
    clearTimeout(relogio)
  }

  if (!pareceResposta(bruta)) return cair("resposta fora do contrato")
  const resposta = bruta
  if (resposta.versao !== VERSAO_CONTRATO)
    return cair(`versão do contrato ${resposta.versao}, esperada ${VERSAO_CONTRATO}`, { resposta })
  if (resposta.status !== "otimo" && resposta.status !== "viavel")
    return cair(`solver sem solução (${resposta.status})`, { resposta })

  let resultado: ResultadoOtimizacao
  try {
    resultado = mapearResposta(resposta, demanda, pessoas, cfg)
  } catch (e) {
    return cair(`resposta inconsistente: ${e instanceof Error ? e.message : String(e)}`, { resposta })
  }

  const violacoes = validarPlano(resultado, demanda, pessoas, cfg, mundo)
  if (violacoes.length)
    return cair(
      `${violacoes.length} violação(ões) rígida(s) no plano do CP-SAT, a primeira ${violacoes[0].regra}: ${violacoes[0].descricao}`,
      { resposta, violacoes }
    )
  if (resposta.objetivo !== null && resposta.objetivoDica !== null && resposta.objetivo > resposta.objetivoDica + 1e-6)
    return cair(
      `CP-SAT pior que o guloso no mesmo objetivo (${resposta.objetivo} contra ${resposta.objetivoDica})`,
      { resposta }
    )

  return { resultado, origem: "cpsat", ms: performance.now() - t0, msGuloso, resposta }
}
