/**
 * Verificação de ponta a ponta: carrega o mundo do Supabase, roda o motor e confere as
 * restrições rígidas e a regra do time.
 *
 *   pnpm db:verificar
 */
import { createClient } from "@supabase/supabase-js"

import { aplicarPlano, mapearMundo, type MundoBanco, type PlanoBanco } from "../lib/dados/mapeador"
import { simular, validarPlano } from "../lib/dominio"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local")
  process.exit(1)
}

const sb = createClient(url, chave, { auth: { persistSession: false } })

const inicioCarga = Date.now()
const [{ data, error }, plano] = await Promise.all([sb.rpc("carregar_mundo"), sb.rpc("carregar_plano")])
if (error) {
  console.error("carregar_mundo falhou:", error.message)
  process.exit(1)
}
const cargaMs = Date.now() - inicioCarga

// o mesmo caminho do app: mundo, plano vigente, âncoras, exceções e calendário real
let dados = mapearMundo(data as unknown as MundoBanco)
if (plano.error) console.error("carregar_plano falhou, seguindo sem o plano:", plano.error.message)
else if (plano.data) dados = aplicarPlano(dados, plano.data as unknown as PlanoBanco)
const { mundo, config } = dados
const inicioSolver = performance.now()
const sim = simular(mundo, config)
const solverMs = Math.round(performance.now() - inicioSolver)

const violacoes = sim.semanas.flatMap((s) =>
  validarPlano(s.otm, s.demanda, mundo.pessoas, { ...config, semanaIdx: s.semana }, mundo, {
    conferirTime: true,
  })
)

const w = sim.semanas[0]
const fte = Object.values(w.otm.deficit).reduce((s, x) => s + x.fteObrig, 0)

console.log({
  cargaMs,
  solverMs,
  projetos: mundo.projetos.length,
  pessoas: mundo.pessoas.length,
  times: mundo.times.length,
  demandaPorSemana: sim.semanas.map((s) => s.demanda.length),
  alocadas: w.otm.alocadas.length,
  adiadas: w.otm.adiadas.length,
  cobertura: w.otm.cobertura.total,
  obrigatorias: w.otm.cobertura.obrigatoria,
  slaDeEtapa: w.otm.cobertura.sla,
  aderencia: w.otm.kpi.aderencia,
  deficitFte: +fte.toFixed(2),
  violacoes: violacoes.length,
})

if (violacoes.length) {
  console.error(violacoes.slice(0, 10))
  process.exit(1)
}
