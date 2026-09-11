/**
 * Guloso × CP-SAT na semana 1 da semente (E15), com `validarPlano` sobre os dois planos.
 * Precisa do solver local rodando (ver solver/README.md):
 *
 *   cd solver && .venv/bin/uvicorn cadencia_solver.api:app --port 8000
 *   pnpm solver:comparar
 *
 * Variáveis: SOLVER_URL (padrão http://127.0.0.1:8000) e SOLVER_LIMITE em segundos (padrão 60).
 *
 *   pnpm solver:comparar --exportar [arquivo]
 *
 * só grava a requisição da semana, com a dica gulosa, e sai. É assim que nasce a fixture dos
 * testes do solver (padrão: solver/tests/dados/semana-1.json).
 *
 * Roda com `tsx --conditions=react-server` porque o cliente do solver é `server-only`.
 */
import fs from "node:fs"
import path from "node:path"

import {
  construirMundo,
  criarConfig,
  gerarDemanda,
  otimizar,
  validarPlano,
  type Config,
  type ResultadoOtimizacao,
} from "../lib/dominio"
import { otimizarComSolver } from "../lib/solver/cliente"
import { montarRequisicao } from "../lib/solver/mapeamento"

const args = process.argv.slice(2)
const mundo = construirMundo(7)
const cfg: Config = { ...criarConfig(), semanaIdx: 1, acumulado: new Array<number>(mundo.pessoas.length).fill(0) }
const demanda = gerarDemanda(mundo, 1, cfg)
const limiteSegundos = Number(process.env.SOLVER_LIMITE ?? 60)
const url = process.env.SOLVER_URL ?? "http://127.0.0.1:8000"

const num = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas })

function exportar(destino: string) {
  const guloso = otimizar(
    demanda.map((ev) => ({ ...ev })),
    mundo.pessoas,
    cfg,
    mundo
  )
  const req = montarRequisicao(demanda, mundo.pessoas, cfg, mundo, {
    dica: guloso,
    opcoes: { limiteSegundos, workers: 8, semente: 0, avaliarDica: true },
  })
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, JSON.stringify(req, null, 2) + "\n")
  console.log(`requisição gravada em ${destino}: ${req.cerimonias.length} cerimônias, ${req.pessoas.length} pessoas`)
}

function linhas(r: ResultadoOtimizacao) {
  return {
    alocadas: r.alocadas.length,
    cobertura: r.cobertura.total,
    obrigatoria: r.cobertura.obrigatoria,
    sla: r.cobertura.sla,
    trocas: r.trocas.length,
    relaxadas: r.cobertura.relaxadas,
    concessoes: r.concessoes.length,
  }
}

async function comparar() {
  const t0 = performance.now()
  const guloso = otimizar(
    demanda.map((ev) => ({ ...ev })),
    mundo.pessoas,
    cfg,
    mundo
  )
  const msGuloso = performance.now() - t0
  const vGuloso = validarPlano(guloso, demanda, mundo.pessoas, cfg, mundo)

  console.log(`semana 1 da semente 7: ${demanda.length} cerimônias (${demanda.filter((d) => d.obrig).length} obrigatórias), ${mundo.pessoas.length} pessoas`)
  console.log(`solver em ${url}, limite de ${limiteSegundos} s\n`)

  const cp = await otimizarComSolver(demanda, mundo.pessoas, cfg, mundo, {
    url,
    limiteSegundos,
    log: (m) => console.log(m),
  })
  const resp = cp.resposta
  if (cp.origem !== "cpsat") {
    console.error(`\nO CP-SAT não foi usado: ${cp.motivo}`)
    cp.violacoes?.forEach((v) => console.error(`  ${v.regra} ${v.descricao} · ${v.pessoa ?? ""} ${v.cerimonia ?? ""}`))
    process.exitCode = 1
    if (!resp) return
  }
  const vCp = cp.origem === "cpsat" ? validarPlano(cp.resultado, demanda, mundo.pessoas, cfg, mundo) : (cp.violacoes ?? [])

  const g = linhas(guloso)
  const c = cp.origem === "cpsat" ? linhas(cp.resultado) : null
  const tabela: [string, string, string][] = [
    ["alocadas", num(g.alocadas), num(c?.alocadas)],
    ["cobertura total (%)", num(g.cobertura), num(c?.cobertura)],
    ["cobertura obrigatória (%)", num(g.obrigatoria), num(c?.obrigatoria)],
    ["SLA (%)", num(g.sla), num(c?.sla)],
    ["camada 2 · trocas de cadeira", num(g.trocas), num(c?.trocas)],
    ["camada 3 · relaxadas", num(g.relaxadas), num(c?.relaxadas)],
    ["concessões", num(g.concessoes), num(c?.concessoes)],
    ["violações rígidas", num(vGuloso.length), num(vCp.length)],
    ["objetivo CP-SAT (menor é melhor)", num(resp?.objetivoDica, 0), num(resp?.objetivo, 0)],
    ["ms", num(msGuloso), num(resp?.ms)],
  ]
  const larg = Math.max(...tabela.map((l) => l[0].length))
  console.log(`\n${"".padEnd(larg)}  ${"guloso".padStart(10)}  ${"CP-SAT".padStart(10)}`)
  tabela.forEach(([k, a, b]) => console.log(`${k.padEnd(larg)}  ${a.padStart(10)}  ${b.padStart(10)}`))

  if (resp) {
    const gap =
      resp.objetivo !== null && resp.limiteInferior !== null && resp.objetivo !== 0
        ? ((resp.objetivo - resp.limiteInferior) / Math.abs(resp.objetivo)) * 100
        : null
    console.log(
      `\nCP-SAT: status ${resp.status}, limite inferior ${num(resp.limiteInferior, 0)} (gap ${num(gap, 2)}%), ` +
        `${num(resp.estatisticas.variaveis, 0)} variáveis, ${num(resp.estatisticas.restricoes, 0)} restrições, ` +
        `${resp.estatisticas.workers} workers, ${num(resp.estatisticas.tempoSolver, 2)} s no solver, ` +
        `ida e volta ${num(cp.ms - cp.msGuloso)} ms`
    )
  }
  const adiadas = (r: ResultadoOtimizacao) =>
    r.adiadas.map((ev) => `${ev.tipo} · ${ev.projeto}${ev.obrig ? " (obrigatória)" : ""}: ${ev.motivo}`)
  console.log("\nnão alocadas pelo guloso:")
  adiadas(guloso).forEach((l) => console.log(`  ${l}`))
  if (cp.origem === "cpsat") {
    console.log("não alocadas pelo CP-SAT:")
    adiadas(cp.resultado).forEach((l) => console.log(`  ${l}`))
  }
  if (vCp.length) {
    console.log("\nviolações do CP-SAT:")
    vCp.forEach((v) => console.log(`  ${v.regra} ${v.descricao} · ${v.pessoa ?? ""} ${v.cerimonia ?? ""}`))
    process.exitCode = 1
  }
}

const iExportar = args.indexOf("--exportar")
if (iExportar >= 0) {
  const destino = args[iExportar + 1] && !args[iExportar + 1].startsWith("--") ? args[iExportar + 1] : "solver/tests/dados/semana-1.json"
  exportar(destino)
} else {
  comparar().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
