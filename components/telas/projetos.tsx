"use client"

import { useState } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import {
  Health,
  IconeMais,
  SecCab,
  Selo,
  SeloFase,
  Trilha,
  VazioTela,
} from "@/components/cadencia/primitivas"
import { excluirProjeto, salvarProjeto } from "@/lib/dados/acoes"
import {
  etapaDe,
  membrosDoTime,
  papeisNecessarios,
  pesoCliente,
  projetosDoTime,
  squadIncompleto,
  type Health as HealthProjeto,
  type Prioridade,
} from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useParametro } from "@/lib/estado/url"
import { n1, primeiro } from "@/lib/formato"

import { fatorMes, pessoaHora, resultadoDe } from "./comum"

export function TelaProjetos() {
  return <ComDados>{(ctx) => <Projetos {...ctx} />}</ComDados>
}

interface Rascunho {
  idx: number | null
  nome: string
  fase: string
  mes: number
  health: HealthProjeto
  prioridade: Prioridade
  time: number
  rel: number
  dash: number
  integ: number
  atraso: number
  /** escolha manual por cargo; ausente significa automático */
  squad: Record<string, number | undefined>
}

/** O cliente é o nome sem o sufixo do projeto ("Grupo Aurora A" → "Grupo Aurora"). */
const clienteDoNome = (nome: string) => {
  const partes = nome.trim().split(/\s+/)
  return partes.length > 1 ? partes.slice(0, -1).join(" ") : nome.trim()
}

// Porte de telaProjetos() do protótipo (§7.4), com gravação no banco.
function Projetos(ctx: Contexto) {
  const { mundo, config, simulacao: sim, cenario } = ctx
  const [busca, setBusca] = useState("")
  const [fase, setFase] = useParametro<string>("fase", "todas")
  const [time, setTime] = useParametro<string>("time", "todos")
  const [editando, setEditando] = useState<Rascunho | null>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const exclusao = useAcao()

  const w = sim.semanas[0]
  const r = resultadoDe(w, cenario)
  const F = fatorMes(config)
  const hSem: Record<number, number> = {}
  const cSem: Record<number, number> = {}
  const hMes: Record<number, number> = {}
  r.alocadas.forEach((ev) => {
    hSem[ev.projetoId] = (hSem[ev.projetoId] || 0) + pessoaHora(ev)
    cSem[ev.projetoId] = (cSem[ev.projetoId] || 0) + 1
  })
  sim.semanas.forEach((sm) =>
    resultadoDe(sm, cenario).alocadas.forEach((ev) => {
      hMes[ev.projetoId] = (hMes[ev.projetoId] || 0) + pessoaHora(ev) * F
    })
  )

  const etapas: Record<string, { projetos: number; cer: number; h: number; hMes: number }> = {}
  Object.keys(mundo.etapas).forEach((f) => (etapas[f] = { projetos: 0, cer: 0, h: 0, hMes: 0 }))
  mundo.projetos.forEach((p) => etapas[p.fase] && etapas[p.fase].projetos++)
  r.alocadas.forEach((ev) => {
    if (!etapas[ev.fase]) return
    etapas[ev.fase].cer++
    etapas[ev.fase].h += pessoaHora(ev)
  })
  sim.semanas.forEach((sm) =>
    resultadoDe(sm, cenario).alocadas.forEach((ev) => {
      if (etapas[ev.fase]) etapas[ev.fase].hMes += pessoaHora(ev) * F
    })
  )
  const totalMes = Object.values(etapas).reduce((s, x) => s + x.hMes, 0) || 1

  const termo = busca.trim().toLowerCase()
  const lista = mundo.projetos
    .filter((p) => fase === "todas" || p.fase === fase)
    .filter((p) => time === "todos" || p.timeId === Number(time))
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
  const incompletos = mundo.projetos.filter((p) => squadIncompleto(mundo, p).length)

  const novo = (): Rascunho => ({
    idx: null,
    nome: "",
    fase: Object.keys(mundo.etapas)[0],
    mes: 1,
    health: "verde",
    prioridade: "media",
    time: mundo.times[0]?.id ?? 0,
    rel: 3,
    dash: 2,
    integ: 1,
    atraso: 0,
    squad: {},
  })
  const deProjeto = (idx: number): Rascunho => {
    const p = mundo.projetos[idx]
    return {
      idx,
      nome: p.nome,
      fase: p.fase,
      mes: p.mes,
      health: p.health,
      prioridade: p.prioridade,
      time: p.timeId,
      rel: p.produtos.relatorios,
      dash: p.produtos.dashboards,
      integ: p.produtos.integracoes,
      atraso: p.atrasoDias ?? 0,
      squad: { ...p.squad },
    }
  }

  const alvoExclusao = excluindo !== null ? mundo.projetos[excluindo] : null

  return (
    <>
      <section className="sec">
        <SecCab
          titulo="Horas de reunião por etapa"
          apoio={`pessoa-hora, ${cenario === "otm" ? "plano otimizado" : "agenda vigente"}`}
        />
        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th className="n">Projetos</th>
              <th className="n">Urgência</th>
              <th className="n">Prazo</th>
              <th className="n">Cerim./sem</th>
              <th className="n">h/semana</th>
              <th className="n">h/mês</th>
              <th className="n">h/mês por projeto</th>
              <th style={{ width: 170 }}>Participação nas horas</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(mundo.etapas).map((f) => {
              const x = etapas[f]
              const et = etapaDe(config, f)
              return (
                <tr key={f}>
                  <td><SeloFase fase={f} etapas={mundo.etapas} /></td>
                  <td className="n">{x.projetos}</td>
                  <td className="n">{et.urgencia} de 5</td>
                  <td className="n">{et.prazoDias}d</td>
                  <td className="n">{x.cer}</td>
                  <td className="n">{n1(x.h)}</td>
                  <td className="n">{n1(x.hMes)}</td>
                  <td className="n">{x.projetos ? n1(x.hMes / x.projetos) : "0,0"}</td>
                  <td>
                    <Trilha valor={x.hMes} max={totalMes} />
                    <div className="meta">{n1((x.hMes / totalMes) * 100)}%</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="sec">
        <SecCab
          titulo="Projetos"
          apoio={
            <>
              <input
                type="text"
                placeholder="buscar cliente"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar cliente"
                style={{ width: 170 }}
              />
              <select value={time} onChange={(e) => setTime(e.target.value)} aria-label="Filtrar por time" style={{ width: "auto" }}>
                <option value="todos">Todos os times</option>
                {mundo.times.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nome} ({projetosDoTime(mundo, t.id).length})
                  </option>
                ))}
              </select>
              <select value={fase} onChange={(e) => setFase(e.target.value)} aria-label="Filtrar por fase" style={{ width: "auto" }}>
                <option value="todas">Todas as fases ({mundo.projetos.length})</option>
                {Object.entries(mundo.etapas).map(([k2, v]) => (
                  <option key={k2} value={k2}>
                    {v.rotulo} ({mundo.projetos.filter((p) => p.fase === k2).length})
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => setEditando(novo())}>
                <IconeMais />
                Novo projeto
              </button>
            </>
          }
        />

        {incompletos.length ? (
          <p className="aviso" style={{ display: "block" }}>
            {incompletos.length} projeto(s) com squad incompleto. As cerimônias que dependem do cargo ausente não
            entram na otimização por falta de quórum.
          </p>
        ) : null}

        {lista.length ? (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Cliente e projeto</th>
                  <th>Fase</th>
                  <th>Time</th>
                  <th className="n">Mês</th>
                  <th>Prioridade</th>
                  <th>Produtos</th>
                  <th>Squad</th>
                  <th className="n">Cerim./sem</th>
                  <th className="n">h/semana</th>
                  <th className="n">h/mês</th>
                  <th>Health</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const falta = squadIncompleto(mundo, p)
                  const prod = p.produtos.relatorios + p.produtos.dashboards + p.produtos.integracoes
                  const t = mundo.times.find((x) => x.id === p.timeId)
                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{p.nome}</b>
                        {falta.length ? (
                          <div className="meta" style={{ color: "var(--bad)" }}>
                            falta {falta.join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td><SeloFase fase={p.fase} etapas={mundo.etapas} /></td>
                      <td>
                        <button type="button" className="mini-btn link" style={{ fontSize: 12 }} onClick={() => setTime(String(p.timeId))}>
                          {t?.nome ?? "sem time"}
                        </button>
                      </td>
                      <td className="n">{p.mes}</td>
                      <td><Selo tom={p.prioridade === "alta" ? "acento" : "neutro"}>{p.prioridade}</Selo></td>
                      <td>
                        <span className="meta">
                          {p.produtos.relatorios}R · {p.produtos.dashboards}D · {p.produtos.integracoes}I
                        </span>
                        <div className="meta">{prod} produtos</div>
                      </td>
                      <td>
                        {Object.entries(p.squad).filter(([, id]) => id !== undefined).length ? (
                          Object.entries(p.squad)
                            .filter(([, id]) => id !== undefined)
                            .map(([pp, id], i) => (
                              <span key={pp} data-dica={pp}>
                                {i ? ", " : ""}
                                {primeiro(mundo.pessoas[id as number]?.nome ?? "")}
                              </span>
                            ))
                        ) : (
                          <span className="meta">sem squad</span>
                        )}
                      </td>
                      <td className="n">{cSem[p.id] || 0}</td>
                      <td className="n">{n1(hSem[p.id] || 0)}</td>
                      <td className="n">{n1(hMes[p.id] || 0)}</td>
                      <td><Health health={p.health} /></td>
                      <td>
                        <span className="acoes">
                          <button type="button" className="mini-btn" onClick={() => setEditando(deProjeto(p.id))}>
                            editar
                          </button>
                          <button type="button" className="mini-btn perigo" onClick={() => setExcluindo(p.id)}>
                            excluir
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <VazioTela titulo="Nenhum projeto encontrado">
            Ajuste a busca ou o filtro de fase, ou crie um projeto novo.
          </VazioTela>
        )}
      </section>

      {editando ? (
        <EditorProjeto ctx={ctx} inicial={editando} onFechar={() => setEditando(null)} />
      ) : null}

      <Confirmacao
        aberto={alvoExclusao !== null}
        titulo={`Excluir ${alvoExclusao?.nome ?? ""}?`}
        acao="Excluir projeto"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={
          alvoExclusao
            ? `As cerimônias desse projeto saem do plano e a capacidade do squad é liberada. Hoje ele consome ${
                alvoExclusao.produtos.relatorios + alvoExclusao.produtos.dashboards + alvoExclusao.produtos.integracoes
              } produtos em ${mundo.etapas[alvoExclusao.fase]?.rotulo ?? "etapa removida"}.`
            : ""
        }
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() => {
          if (excluindo === null) return
          exclusao.executar(() => excluirProjeto(ctx.indices.projetos[excluindo]), "projeto excluído, cenário replanejado", () =>
            setExcluindo(null)
          )
        }}
      />
    </>
  )
}

function EditorProjeto({ ctx, inicial, onFechar }: { ctx: Contexto; inicial: Rascunho; onFechar: () => void }) {
  const { mundo, config, indices } = ctx
  const [d, setD] = useState<Rascunho>(inicial)
  const acao = useAcao()
  const nec = papeisNecessarios(mundo, d.fase)
  const et = etapaDe(config, d.fase)
  const membros = membrosDoTime(mundo, d.time)
  const original = d.idx !== null ? mundo.projetos[d.idx] : null
  const atualizar = (parcial: Partial<Rascunho>) => setD((x) => ({ ...x, ...parcial }))

  const salvar = () => {
    if (!d.nome.trim()) {
      acao.setErro("Informe o nome do cliente ou projeto.")
      return
    }
    const squad: Record<string, string> = {}
    nec.forEach((pp) => {
      const pid = d.squad[pp]
      if (pid !== undefined && membros.includes(pid)) squad[indices.cargos[pp]] = indices.pessoas[pid]
    })
    acao.executar(
      () =>
        salvarProjeto({
          id: d.idx !== null ? indices.projetos[d.idx] : null,
          nome: d.nome.trim(),
          cliente: clienteDoNome(d.nome),
          etapaId: indices.etapas[d.fase],
          timeId: indices.times[d.time],
          mes: d.mes,
          health: d.health,
          prioridade: d.prioridade,
          produtos: { relatorios: d.rel, dashboards: d.dash, integracoes: d.integ },
          atrasoDias: d.atraso,
          squad,
        }),
      "projeto salvo, cenário replanejado",
      onFechar
    )
  }

  const num = (v: string, min: number, max: number) => Math.min(Math.max(min, Number(v) || 0), max)

  return (
    <Modal aberto largura={760} onFechar={onFechar} rotulo={original ? `Editar ${original.nome}` : "Novo projeto"}>
      <EditorCab
        titulo={original ? `Editar ${original.nome}` : "Novo projeto"}
        meta={`Etapa ${mundo.etapas[d.fase]?.rotulo}: urgência ${et.urgencia} de 5, prazo de ${et.prazoDias} dias úteis.`}
      />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="epNome">Cliente e projeto</label>
          <input id="epNome" type="text" value={d.nome} placeholder="Grupo Aurora A" onChange={(e) => atualizar({ nome: e.target.value })} />
          {d.nome.trim() ? <span className="dica">Cliente: {clienteDoNome(d.nome)}</span> : null}
        </div>
        <div className="campo">
          <label htmlFor="epFase">Fase</label>
          <select id="epFase" value={d.fase} onChange={(e) => atualizar({ fase: e.target.value })}>
            {Object.entries(mundo.etapas).map(([k2, v]) => (
              <option key={k2} value={k2}>{v.rotulo}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="epMes">Mês do projeto</label>
          <input id="epMes" type="number" min={1} max={48} value={d.mes} onChange={(e) => atualizar({ mes: num(e.target.value, 1, 48) })} />
        </div>
        <div className="campo">
          <label htmlFor="epRel">Relatórios</label>
          <input id="epRel" type="number" min={0} max={40} value={d.rel} onChange={(e) => atualizar({ rel: num(e.target.value, 0, 40) })} />
        </div>
        <div className="campo">
          <label htmlFor="epDash">Dashboards</label>
          <input id="epDash" type="number" min={0} max={40} value={d.dash} onChange={(e) => atualizar({ dash: num(e.target.value, 0, 40) })} />
        </div>
        <div className="campo">
          <label htmlFor="epInteg">Integrações</label>
          <input id="epInteg" type="number" min={0} max={20} value={d.integ} onChange={(e) => atualizar({ integ: num(e.target.value, 0, 20) })} />
        </div>
        <div className="campo">
          <label htmlFor="epHealth">Health</label>
          <select id="epHealth" value={d.health} onChange={(e) => atualizar({ health: e.target.value as HealthProjeto })}>
            {(["verde", "amarelo", "vermelho"] as const).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="campo l2">
          <label htmlFor="epTime">Time responsável</label>
          {/* corrige o defeito 1 do protótipo: o time aparece selecionado e é salvo */}
          <select id="epTime" value={d.time} onChange={(e) => atualizar({ time: Number(e.target.value), squad: {} })}>
            {mundo.times.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}, {membrosDoTime(mundo, t.id).length} pessoas
              </option>
            ))}
          </select>
          <span className="dica">O squad sai dos membros deste time. Trocar o time refaz as cadeiras.</span>
        </div>
        <div className="campo">
          <label htmlFor="epPrioridade">Prioridade do cliente</label>
          <select id="epPrioridade" value={d.prioridade} onChange={(e) => atualizar({ prioridade: e.target.value as Prioridade })}>
            {(["alta", "media", "baixa"] as const).map((h) => (
              <option key={h} value={h}>
                {h}, peso {pesoCliente(config, h)}
              </option>
            ))}
          </select>
          <span className="dica">Urgência da etapa vezes peso do cliente define a posição na fila do otimizador.</span>
        </div>
        <div className="campo">
          <label htmlFor="epAtraso">Atraso em dias</label>
          <input
            id="epAtraso"
            type="number"
            min={0}
            max={365}
            value={d.atraso}
            onChange={(e) => atualizar({ atraso: num(e.target.value, 0, 365) })}
          />
          <span className="dica">Acima de 10, com os modificadores ligados, dobra a cadência do status report.</span>
        </div>
        <div className="l4">
          <SecCab
            titulo="Squad"
            apoio={`cargos exigidos pela fase ${mundo.etapas[d.fase]?.rotulo}, deixar em automático distribui pela menor carga`}
            style={{ marginBottom: 10 }}
          />
          <div className="form">
            {nec.map((pp) => {
              const cand = mundo.pessoas.filter((x) => x.papel === pp && membros.includes(x.id))
              const valor = d.squad[pp]
              return (
                <div key={pp} className="campo">
                  <label htmlFor={`eq-${pp}`}>{pp}</label>
                  <select
                    id={`eq-${pp}`}
                    value={valor !== undefined && cand.some((c) => c.id === valor) ? String(valor) : ""}
                    onChange={(e) =>
                      atualizar({ squad: { ...d.squad, [pp]: e.target.value === "" ? undefined : Number(e.target.value) } })
                    }
                  >
                    <option value="">automático</option>
                    {cand.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {cand.length ? null : (
                    <span className="erro">ninguém com este cargo no time, a cerimônia ficará sem quórum</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <EditorPe erro={acao.erro} acao="Salvar projeto" ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}
