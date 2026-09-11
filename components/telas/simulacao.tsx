"use client"

import { useState } from "react"

import type { Contexto } from "@/components/cadencia/com-dados"
import { GraficoBarras } from "@/components/cadencia/grafico-barras"
import { SecCab } from "@/components/cadencia/primitivas"
import type { Metricas, PedidoSimulacao, PontoCurva, PontoProjecao, ResultadoDispensa } from "@/lib/dominio"
import { simularHipotese } from "@/lib/estado/simulacoes"
import { n1, pc } from "@/lib/formato"

import { papeisDe } from "./comum"

// E22 · Simulação de contratação e déficit (Parte IV.1): três perguntas da gestão respondidas com
// o mesmo motor, sobre o mundo atual e sem gravar nada.

function useHipotese<T>(ctx: Contexto) {
  const [dados, setDados] = useState<T | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const rodar = (pedido: PedidoSimulacao) => {
    setPendente(true)
    setErro(null)
    simularHipotese<T>(ctx.mundo, ctx.config, pedido)
      .then(setDados)
      .catch((e: Error) => setErro(`A simulação falhou: ${e.message}`))
      .finally(() => setPendente(false))
  }
  return { dados, pendente, erro, rodar }
}

const sinal = (v: number, casas = 1) => `${v > 0 ? "+" : ""}${v.toFixed(casas).replace(".", ",")}`

export function AbaSimulacao({ ctx }: { ctx: Contexto }) {
  return (
    <>
      <Contratacao ctx={ctx} />
      <Dispensa ctx={ctx} />
      <Projecao ctx={ctx} />
    </>
  )
}

function Contratacao({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim } = ctx
  const papeis = papeisDe(config)
  // sugestão inicial: o cargo com mais déficit na semana 1
  const gargalo = Object.entries(sim.semanas[0].otm.deficit).sort((a, b) => b[1].fteObrig - a[1].fteObrig)[0]?.[0]
  const [papel, setPapel] = useState(gargalo ?? papeis[0])
  // e o time onde esse cargo mais deixa cerimônia de fora
  const [timeId, setTimeId] = useState(() => {
    const porTime = new Map<number, number>()
    sim.semanas.forEach((w) =>
      w.otm.adiadas
        .filter((a) => !gargalo || a.papeis.includes(gargalo))
        .forEach((a) => porTime.set(a.timeId, (porTime.get(a.timeId) ?? 0) + 1))
    )
    return [...porTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? mundo.times[0]?.id ?? 0
  })
  const [maximo, setMaximo] = useState(4)
  const curva = useHipotese<PontoCurva[]>(ctx)
  const time = mundo.times.find((t) => t.id === timeId)

  let leitura: string | null = null
  if (curva.dados) {
    const zero = curva.dados[0]
    const resolve = curva.dados.find((p) => p.adicionais > 0 && p.deficitFte < 0.05)
    const ultimo = curva.dados[curva.dados.length - 1]
    leitura = resolve
      ? `Com ${resolve.adicionais} ${papel} a mais no ${time?.nome ?? "time"}, as obrigatórias chegam a ${pc(resolve.obrigatoria)} e o déficit estrutural cai de ${n1(zero.deficitFte)} para ${n1(resolve.deficitFte)} FTE.`
      : `Nem com ${ultimo.adicionais} ${papel} a mais o déficit zera (fica em ${n1(ultimo.deficitFte)} FTE): o gargalo está em outro cargo ou em outro time.`
  }

  return (
    <section className="sec">
      <SecCab titulo="E se contratar" apoio="curva de cobertura por pessoa a mais, com os squads redistribuídos" />
      <div className="form" style={{ maxWidth: 820 }}>
        <div className="campo">
          <label htmlFor="ctCargo">Cargo</label>
          <select id="ctCargo" value={papel} onChange={(e) => setPapel(e.target.value)}>
            {papeis.map((pp) => (
              <option key={pp} value={pp}>
                {pp}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ctTime">Time</label>
          <select id="ctTime" value={timeId} onChange={(e) => setTimeId(Number(e.target.value))}>
            {mundo.times.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ctMax">Até quantas pessoas</label>
          <select id="ctMax" value={maximo} onChange={(e) => setMaximo(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ alignSelf: "end" }}>
          <button
            type="button"
            className="btn"
            disabled={curva.pendente}
            onClick={() => curva.rodar({ tipo: "curva", papel, timeId, maximo })}
          >
            {curva.pendente ? "Simulando" : "Simular curva"}
          </button>
        </div>
      </div>
      {curva.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{curva.erro}</p> : null}
      {curva.dados ? (
        <>
          <div className="colunas c-2" style={{ marginTop: 14 }}>
            <GraficoBarras
              dados={curva.dados.map((p) => ({ l: `+${p.adicionais}`, v: p.obrigatoria, t: pc(p.obrigatoria) }))}
              valores
              eixoY={false}
              alt="obrigatórias alocadas por pessoa a mais"
            />
            <table>
              <thead>
                <tr>
                  <th>A mais</th>
                  <th className="n">Cerim./sem.</th>
                  <th className="n">Cobertura</th>
                  <th className="n">Obrigatórias</th>
                  <th className="n">Aderência</th>
                  <th className="n">Déficit</th>
                </tr>
              </thead>
              <tbody>
                {curva.dados.map((p) => (
                  <tr key={p.adicionais}>
                    <td>+{p.adicionais}</td>
                    <td className="n">{n1(p.demanda)}</td>
                    <td className="n">{pc(p.cobertura)}</td>
                    <td className="n">{pc(p.obrigatoria)}</td>
                    <td className="n">{pc(p.aderencia)}</td>
                    <td className="n">{n1(p.deficitFte)} FTE</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: 10 }}>{leitura}</p>
        </>
      ) : (
        <p className="nota" style={{ marginTop: 10 }}>
          Cada ponto roda o horizonte inteiro com as pessoas novas no time e os squads redistribuídos pela menor
          carga. A cerimônia que hoje não acontece por falta de quórum volta à demanda quando o cargo passa a existir
          no time.
        </p>
      )}
    </section>
  )
}

const LINHAS_DISPENSA: { lb: string; v: (m: Metricas) => number; fmt: (v: number) => string; casas?: number }[] = [
  { lb: "Cerimônias por semana", v: (m) => m.demanda, fmt: n1 },
  { lb: "Cobertura", v: (m) => m.cobertura, fmt: pc },
  { lb: "Obrigatórias alocadas", v: (m) => m.obrigatoria, fmt: pc },
  { lb: "Aderência ao alvo", v: (m) => m.aderencia, fmt: pc },
  { lb: "Déficit estrutural", v: (m) => m.deficitFte, fmt: (v) => `${n1(v)} FTE`, casas: 2 },
]

function Dispensa({ ctx }: { ctx: Contexto }) {
  const { mundo, config } = ctx
  const papeis = papeisDe(config)
  const fases = Object.keys(mundo.etapas)
  const [fase, setFase] = useState(fases.includes("kickoff") ? "kickoff" : fases[0])
  const [papel, setPapel] = useState(papeis.includes("Líder Técnico") ? "Líder Técnico" : papeis[0])
  const r = useHipotese<ResultadoDispensa>(ctx)

  return (
    <section className="sec">
      <SecCab titulo="E se a fase não exigir o cargo" apoio="o cargo sai de todas as cerimônias da fase" />
      <div className="form" style={{ maxWidth: 820 }}>
        <div className="campo">
          <label htmlFor="dsFase">Fase</label>
          <select id="dsFase" value={fase} onChange={(e) => setFase(e.target.value)}>
            {fases.map((f) => (
              <option key={f} value={f}>
                {mundo.etapas[f]?.rotulo ?? f}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="dsCargo">Cargo dispensado</label>
          <select id="dsCargo" value={papel} onChange={(e) => setPapel(e.target.value)}>
            {papeis.map((pp) => (
              <option key={pp} value={pp}>
                {pp}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ alignSelf: "end" }}>
          <button type="button" className="btn" disabled={r.pendente} onClick={() => r.rodar({ tipo: "dispensa", fase, papel })}>
            {r.pendente ? "Simulando" : "Comparar"}
          </button>
        </div>
      </div>
      {r.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{r.erro}</p> : null}
      {r.dados ? (
        <table style={{ maxWidth: 640, marginTop: 14 }}>
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="n">Hoje</th>
              <th className="n">Sem o cargo</th>
              <th className="n">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {LINHAS_DISPENSA.map((l) => {
              const a = l.v(r.dados!.base)
              const b = l.v(r.dados!.hipotese)
              return (
                <tr key={l.lb}>
                  <td>{l.lb}</td>
                  <td className="n">{l.fmt(a)}</td>
                  <td className="n">{l.fmt(b)}</td>
                  <td className="n">{sinal(b - a, l.casas)}</td>
                </tr>
              )
            })}
            <tr>
              <td>Horas de reunião do cargo por semana</td>
              <td className="n">{n1(r.dados.horasCargo.antes)}h</td>
              <td className="n">{n1(r.dados.horasCargo.depois)}h</td>
              <td className="n">{sinal(r.dados.horasCargo.depois - r.dados.horasCargo.antes)}h</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="nota" style={{ marginTop: 10 }}>
          Responde à pergunta da Parte IV.1: quanto de capacidade o cargo recupera e o que muda na cobertura se a
          fase deixar de exigi-lo. Nada é gravado; para adotar, edite o playbook em Premissas.
        </p>
      )}
    </section>
  )
}

function Projecao({ ctx }: { ctx: Contexto }) {
  const { mundo } = ctx
  const fases = Object.keys(mundo.etapas)
  const [novos, setNovos] = useState(3)
  const [fase, setFase] = useState(fases[0])
  const [timeId, setTimeId] = useState(mundo.times[0]?.id ?? 0)
  const r = useHipotese<PontoProjecao[]>(ctx)

  return (
    <section className="sec">
      <SecCab titulo="Projeção de três meses" apoio="projetos previstos entrando todo mês" />
      <div className="form" style={{ maxWidth: 820 }}>
        <div className="campo">
          <label htmlFor="pjNovos">Projetos novos por mês</label>
          <select id="pjNovos" value={novos} onChange={(e) => setNovos(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pjFase">Fase de entrada</label>
          <select id="pjFase" value={fase} onChange={(e) => setFase(e.target.value)}>
            {fases.map((f) => (
              <option key={f} value={f}>
                {mundo.etapas[f]?.rotulo ?? f}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pjTime">Time</label>
          <select id="pjTime" value={timeId} onChange={(e) => setTimeId(Number(e.target.value))}>
            {mundo.times.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ alignSelf: "end" }}>
          <button
            type="button"
            className="btn"
            disabled={r.pendente}
            onClick={() => r.rodar({ tipo: "projecao", novosPorMes: novos, fase, timeId })}
          >
            {r.pendente ? "Simulando" : "Projetar"}
          </button>
        </div>
      </div>
      {r.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{r.erro}</p> : null}
      {r.dados ? (
        <table style={{ maxWidth: 760, marginTop: 14 }}>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="n">Projetos</th>
              <th className="n">Cerim./sem.</th>
              <th className="n">Cobertura</th>
              <th className="n">Obrigatórias</th>
              <th className="n">Déficit</th>
            </tr>
          </thead>
          <tbody>
            {r.dados.map((p) => (
              <tr key={p.mes}>
                <td>{p.mes === 0 ? "hoje" : `mês ${p.mes}`}</td>
                <td className="n">{p.projetos}</td>
                <td className="n">{n1(p.demanda)}</td>
                <td className="n">{pc(p.cobertura)}</td>
                <td className="n">{pc(p.obrigatoria)}</td>
                <td className="n" style={{ color: p.deficitFte > 0.25 ? "var(--bad)" : "var(--ink)" }}>
                  {n1(p.deficitFte)} FTE
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="nota" style={{ marginTop: 10 }}>
        Os projetos previstos entram com squad montado pela menor carga e ficam na fase de entrada durante a
        projeção, uma leitura conservadora da demanda dos primeiros meses. Com o Módulo de Projetos (E23), a
        previsão passa a vir do pipeline comercial.
      </p>
    </section>
  )
}
