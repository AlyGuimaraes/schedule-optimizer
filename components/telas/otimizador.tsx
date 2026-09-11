"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import {
  Abas,
  Chave,
  Faixa,
  Indicador,
  Painel,
  SecCab,
  Selo,
  Terminal,
  VazioTela,
} from "@/components/cadencia/primitivas"
import { TextoLeitura } from "@/components/cadencia/texto-leitura"
import { dataDoDia, diaMes, PERFIS, premDe, SLOTS_DIA, type Config, type PerfilId } from "@/lib/dominio"
import { useCadencia } from "@/lib/estado/cadencia"
import { useParametro } from "@/lib/estado/url"
import { DIAS_LB, hhmm, n0, n1, pc } from "@/lib/formato"
import { narrarResultado } from "@/lib/ia/acoes"
import type { AlertaNarrador, Narracao } from "@/lib/ia/contratos/narrador"
import type { EntradaNarrador } from "@/lib/ia/entradas"
import { leituraDeterministica } from "@/lib/ia/leitura-deterministica"
import { contextoDaOperacao, resumirExecucao } from "@/lib/ia/resumo"

import { AbaCenarios, SalvarCenario } from "./cenarios"
import { AbaSimulacao } from "./simulacao"
import { papeisDe } from "./comum"

/** Horizonte em datas reais: período, feriados e a janela congelada pela antecedência de 48h. */
function textoCalendario(config: Config): string | null {
  const cal = config.calendario
  if (!cal) return null
  const partes = [`De ${diaMes(cal.inicio)} a ${diaMes(dataDoDia(cal.inicio, config.horizonte, 4))}.`]
  const feriados = Object.entries(cal.feriados ?? {})
    .filter(([s]) => Number(s) <= config.horizonte)
    .flatMap(([s, dias]) =>
      Object.entries(dias).map(([d, nome]) => `${diaMes(dataDoDia(cal.inicio, Number(s), Number(d)))} ${nome}`)
    )
  partes.push(feriados.length ? `Feriados: ${feriados.join(", ")}.` : "Sem feriado no horizonte.")
  const c = cal.congeladoAte ?? 0
  partes.push(
    c
      ? `Antecedência de 48h: até ${DIAS_LB[Math.floor(c / SLOTS_DIA)] ?? "o fim da semana"} ${hhmm(c % SLOTS_DIA)} só fica o que já estava no plano vigente.`
      : "Antecedência de 48h: o horizonte começa depois de 48h, nada está congelado."
  )
  return partes.join(" ")
}

const ABAS = ["resultado", "concessoes", "trocas", "pendencias", "cenarios", "simulacao"] as const
type AbaOtimizador = (typeof ABAS)[number]

/** `narradorIa` vem do servidor: com a chave de API configurada, a leitura passa pelo Narrador. */
export function TelaOtimizador({ narradorIa = false }: { narradorIa?: boolean }) {
  return <ComDados>{(ctx) => <Otimizador {...ctx} narradorIa={narradorIa} />}</ComDados>
}

// Porte de telaOtimizador() do protótipo (§7.3): seis indicadores, configuração e execução
// em duas colunas, e as quatro tabelas de detalhe em abas.
function Otimizador({ mundo, config, simulacao: sim, cenario, ms, indices, narradorIa }: Contexto & { narradorIa: boolean }) {
  const [aba, setAba] = useParametro<AbaOtimizador>("aba", "resultado", ABAS)
  const setHorizonte = useCadencia((s) => s.setHorizonte)
  const setPerfil = useCadencia((s) => s.setPerfil)
  const setRebalancear = useCadencia((s) => s.setRebalancear)
  const otimizando = useCadencia((s) => s.otimizando)
  const execucao = useCadencia((s) => s.execucao)
  const vigente = useCadencia((s) => s.dadosAtuais?.vigente ?? null)
  const [salvando, setSalvando] = useState(false)

  const w = sim.semanas[0]
  const b = w.base.kpi
  const o = w.otm.kpi
  const R = w.otm
  const perfil = PERFIS[config.perfil] || PERFIS.equilibrio
  const conc = R.concessoes
  const trocas = R.trocas
  const adi = R.adiadas
  const papeis = papeisDe(config)

  const quadro = papeis
    .map((pp) => {
      const ps = o.porPessoa.filter((x) => x.papel === pp)
      if (!ps.length) return null
      const c = premDe(config, pp)
      const def = R.deficit[pp]
      return {
        pp,
        n: ps.length,
        alvo: c.produtivoMin,
        tol: c.tolerancia,
        teto: c.teto,
        tetoMax: c.tetoMax,
        limitado: c.limitadoPorHoras,
        maxMes: c.maxHorasMes,
        carga: ps.reduce((s, x) => s + x.horas, 0) / ps.length,
        hMes: ps.reduce((s, x) => s + sim.mes[cenario].porPessoa[x.id].horas, 0) / ps.length,
        produtivo: ps.reduce((s, x) => s + x.produtivo, 0) / ps.length,
        noAlvo: ps.filter((x) => x.noAlvo).length,
        cessoes: conc.filter((x) => x.papel === pp).length,
        fteObrig: def ? def.fteObrig : 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const fteObrig = quadro.reduce((s, x) => s + x.fteObrig, 0)
  const gargalo: Record<string, number> = {}
  adi.forEach((a) => a.papeis.forEach((pp) => (gargalo[pp] = (gargalo[pp] || 0) + 1)))
  const gargaloTop = Object.entries(gargalo).sort((a, c) => c[1] - a[1])[0]
  const coberturaBase = (100 * w.base.alocadas.length) / w.demanda.length

  // Leitura do agente: a determinística aparece na hora; com IA, o Narrador troca o texto se responder
  const resumo = resumirExecucao({ mundo, config, simulacao: sim, papeis })
  const leitura = leituraDeterministica(resumo)
  const narracao = useNarracao(narradorIa ? { resumo, contexto: contextoDaOperacao({ mundo, config, papeis }) } : null)

  const comparacao: [string, string, string, number, boolean][] = [
    ["Tempo produtivo médio", pc(b.produtivoMedio), pc(o.produtivoMedio), o.produtivoMedio - b.produtivoMedio, false],
    ["Aderência ao alvo do cargo", pc(b.aderencia), pc(o.aderencia), o.aderencia - b.aderencia, false],
    ["Cobertura do playbook", pc(coberturaBase), pc(R.cobertura.total), R.cobertura.total - coberturaBase, false],
    ["Pessoas com concessão", String(b.acimaTeto), String(o.acimaTeto), o.acimaTeto - b.acimaTeto, true],
    ["Acima do limite aceitável", String(b.acimaLimite), String(o.acimaLimite), o.acimaLimite - b.acimaLimite, true],
    ["Blocos de foco por pessoa", n1(b.blocosFocoMedio), n1(o.blocosFocoMedio), o.blocosFocoMedio - b.blocosFocoMedio, false],
    ["Fragmentação média", `${n1(b.fragMedia * 100)}%`, `${n1(o.fragMedia * 100)}%`, (o.fragMedia - b.fragMedia) * 100, true],
    ["Horas de cerimônia na semana", `${n1(b.horasTotais)}h`, `${n1(o.horasTotais)}h`, o.horasTotais - b.horasTotais, true],
  ]

  const noAlvo = R.alocadas.filter((x) => !x.relaxado).length
  const linhasTerminal: [string, string][] = [
    ["cmd", `> cadencia optimize --horizonte ${config.horizonte}w --perfil ${config.perfil}`],
    ["", `planejador  ${w.demanda.length} cerimônias derivadas do playbook`],
    ["", `premissas   ${papeis.length} cargos, alvo ${papeis.map((p) => premDe(config, p).produtivoMin).join("/")}%`],
    ["bom", `camada 1    ${noAlvo} alocadas dentro do alvo, sem ceder nada`],
    [trocas.length ? "at" : "", `camada 2    ${trocas.length} resolvidas trocando a cadeira`],
    [R.cobertura.relaxadas ? "at" : "bom", `camada 3    ${R.cobertura.relaxadas} com concessão, tolerância a ${n0(perfil.usaTolerancia * 100)}%`],
    [adi.length ? "at" : "bom", `residual    ${adi.length} sem solução, déficit ${n1(fteObrig)} FTE`],
    ["bom", `KPI         cobertura ${pc(R.cobertura.total)}, aderência ${pc(o.aderencia)}`],
    ["bom", "> plano pronto para publicação"],
  ]

  const abas = [
    { id: "resultado" as const, rotulo: "Resultado", apoio: "desejado contra possível" },
    { id: "concessoes" as const, rotulo: "Concessões", apoio: `${conc.length} registradas` },
    { id: "trocas" as const, rotulo: "Trocas de cadeira", apoio: `${trocas.reduce((s, t) => s + t.subs.length, 0)} aplicadas` },
    { id: "pendencias" as const, rotulo: "Não atendida", apoio: `${adi.length} cerimônias` },
    { id: "cenarios" as const, rotulo: "Cenários", apoio: vigente ? `vigente: ${vigente.nome}` : "salvar, comparar, publicar" },
    { id: "simulacao" as const, rotulo: "E se", apoio: "contratação, cargo e projeção" },
  ]

  return (
    <>
      <Faixa>
        <Indicador
          rotulo="Aderência ao alvo"
          valor={n1(o.aderencia)}
          un="%"
          tom={o.aderencia >= 95 ? "bom" : o.aderencia < 70 ? "ruim" : ""}
          contexto={`${o.porPessoa.filter((x) => x.noAlvo).length} de ${mundo.pessoas.length} pessoas`}
        />
        <Indicador
          rotulo="Cobertura total"
          valor={n1(R.cobertura.total)}
          un="%"
          tom={R.cobertura.total >= 95 ? "bom" : "ruim"}
          contexto={`${R.alocadas.length} de ${w.demanda.length} cerimônias`}
        />
        <Indicador
          rotulo="Com concessão"
          valor={String(R.cobertura.relaxadas)}
          tom={R.cobertura.relaxadas ? "" : "bom"}
          contexto={R.cobertura.relaxadas ? `${conc.length} premissas cedidas` : "nada precisou ser cedido"}
        />
        <Indicador
          rotulo="SLA de etapa"
          valor={n1(R.cobertura.sla)}
          un="%"
          tom={R.cobertura.sla >= 100 ? "bom" : "ruim"}
          contexto={`${R.cobertura.slaTotal} com prazo crítico`}
        />
        <Indicador
          rotulo="Adiadas"
          valor={String(adi.length)}
          tom={adi.length ? "ruim" : "bom"}
          contexto={adi.length ? `${adi.filter((a) => a.obrig).length} obrigatórias` : "nenhuma pendência"}
        />
        <Indicador
          rotulo="Déficit estrutural"
          valor={n1(fteObrig)}
          un="FTE"
          tom={fteObrig > 0.5 ? "ruim" : "bom"}
          contexto={gargaloTop && fteObrig > 0 ? `concentrado em ${gargaloTop[0]}` : "capacidade suficiente"}
        />
      </Faixa>

      <div className="colunas c-ba sec">
        <Painel titulo="Cenário">
          <div className="campo">
            <label htmlFor="selHoriz">Horizonte de planejamento</label>
            <select id="selHoriz" value={config.horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}>
              {[2, 4, 6, 8, 13].map((h) => (
                <option key={h} value={h}>
                  {h === 13 ? "13 semanas, o trimestre" : `${h} semanas`}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="selPerfil">Perfil de otimização</label>
            <select id="selPerfil" value={config.perfil} onChange={(e) => setPerfil(e.target.value as PerfilId)}>
              {(Object.entries(PERFIS) as [PerfilId, (typeof PERFIS)[PerfilId]][]).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.rotulo}
                </option>
              ))}
            </select>
            <span className="dica">{perfil.desc}</span>
          </div>
          <Chave ligada={config.rebalancear} onChange={setRebalancear}>
            Rebalancear cadeiras
          </Chave>
          <div className="campo">
            <label>Plano vigente</label>
            <span className="dica">
              {vigente
                ? `${vigente.nome}, publicado em ${new Date(vigente.publicadoEm).toLocaleDateString("pt-BR")}. Mover uma cerimônia do lugar dele tem custo no replanejamento, e no máximo 20% saem do lugar por ciclo.`
                : "Nenhum plano publicado ainda. Salve esta execução como cenário e publique para ter uma referência de estabilidade."}
              {R.estabilidade
                ? ` Nesta execução, ${pc(R.estabilidade.pct)} das cerimônias ficaram no lugar${
                    R.estabilidade.relaxada
                      ? "; o limite de 20% não coube nem reforçando o peso da estabilidade e ficou registrado como relaxado."
                      : "."
                  }`
                : null}
            </span>
            <button type="button" className="btn leve" style={{ justifySelf: "start", width: "fit-content" }} onClick={() => setSalvando(true)}>
              Salvar como cenário
            </button>
          </div>
          {config.calendario ? (
            <div className="campo">
              <label>Calendário do horizonte</label>
              <span className="dica">{textoCalendario(config)}</span>
            </div>
          ) : null}
          <div className="campo">
            <label>O que este perfil autoriza ceder</label>
            <table>
              <tbody>
                <tr><td>Tolerância usada</td><td className="n">{n0(perfil.usaTolerancia * 100)}%</td></tr>
                <tr><td>Reuniões por dia</td><td className="n">+{perfil.extraReunioes}</td></tr>
                <tr><td>Horas por dia</td><td className="n">+{n1(perfil.extraHoras)}h</td></tr>
                <tr><td>Janela protegida</td><td className="n">{perfil.cedeJanela ? "cede" : "preserva"}</td></tr>
                <tr><td>Fila</td><td className="n">{perfil.fila === "criticidade" ? "criticidade" : "prioridade"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="campo">
            <label>Premissas por cargo</label>
            <table>
              <tbody>
                {papeis.map((pp) => {
                  const c = premDe(config, pp)
                  return (
                    <tr key={pp}>
                      <td>{pp}</td>
                      <td className="n">{c.produtivoMin}%</td>
                      <td className="n">{n1(c.teto)}h</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Link href="/premissas?aba=cargo" className="mini-btn" style={{ justifySelf: "start", width: "fit-content" }}>
              Editar premissas
            </Link>
          </div>
        </Painel>

        <div>
          <section className="sec">
            <SecCab
              titulo="Execução em três camadas"
              apoio={`solver ${ms} ms, ${mundo.projetos.length} projetos, ${mundo.pessoas.length} pessoas, ${config.horizonte} semanas`}
            />
            {otimizando ? (
              <div className="terminal">
                <div className="cmd" style={{ opacity: 1 }}>
                  &gt; cadencia optimize --recalcular
                </div>
                {[62, 81, 48, 70].map((l, i) => (
                  <div key={i} className="esqueleto" style={{ margin: "8px 0", width: `${l}%`, opacity: 1 }} />
                ))}
              </div>
            ) : (
              <Terminal key={execucao} linhas={linhasTerminal} animado={execucao > 0} />
            )}
          </section>
          <section className="sec">
            <SecCab
              titulo="Leitura do agente"
              apoio={
                narracao ? (
                  <>
                    Levi, narrador <Selo tom="acento">IA</Selo>
                  </>
                ) : (
                  "Levi, narrador"
                )
              }
            />
            {narracao ? (
              <>
                <p className="leitura">{narracao.resumo}</p>
                {narracao.alertas.length ? (
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {narracao.alertas.map((a, i) => (
                      <p key={i} className="nota">
                        <Selo tom={ALERTA[a.gravidade].tom}>{ALERTA[a.gravidade].rotulo}</Selo> <b>{a.titulo}.</b> {a.detalhe}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="leitura">
                <TextoLeitura trechos={leitura} />
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="sec">
        <Abas abas={abas} ativa={aba} onChange={setAba} />
        <div role="tabpanel">
          {aba === "resultado" ? (
            <>
              <div className="larga">
                <table style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Cargo</th>
                      <th className="n">Alvo</th>
                      <th className="n">Tol.</th>
                      <th className="n">Teto/sem</th>
                      <th className="n">Limite</th>
                      <th className="n">Carga</th>
                      <th className="n">h/mês</th>
                      <th className="n">Máx mês</th>
                      <th className="n">Produtivo</th>
                      <th className="n">No alvo</th>
                      <th className="n">Concessões</th>
                      <th className="n">Déficit</th>
                      <th>Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quadro.map((x) => (
                      <tr key={x.pp}>
                        <td>
                          <b>{x.pp}</b>
                          <div className="meta">{x.n} pessoa(s)</div>
                        </td>
                        <td className="n">{x.alvo}%</td>
                        <td className="n calc">{x.tol}</td>
                        <td className="n">
                          {n1(x.teto)}h
                          {x.limitado ? <div className="meta" style={{ color: "var(--accent-ink)" }}>absoluto</div> : null}
                        </td>
                        <td className="n calc">{n1(x.tetoMax)}h</td>
                        <td className="n" style={{ color: x.carga > x.teto ? "var(--bad)" : "var(--ink)" }}>{n1(x.carga)}h</td>
                        <td className="n" style={{ color: x.hMes > x.maxMes ? "var(--bad)" : "var(--ink)" }}>{n1(x.hMes)}h</td>
                        <td className="n calc">{n1(x.maxMes)}h</td>
                        <td className="n">{n1(x.produtivo)}%</td>
                        <td className="n">{x.noAlvo}/{x.n}</td>
                        <td className="n">{x.cessoes || 0}</td>
                        <td className="n">{x.fteObrig ? n1(x.fteObrig) : "0,0"}</td>
                        <td>
                          {x.fteObrig > 0.3 ? (
                            <Selo tom="ruim">falta capacidade</Selo>
                          ) : x.cessoes ? (
                            <Selo tom="aviso">alvo cedido</Selo>
                          ) : x.carga < x.teto * 0.5 ? (
                            <Selo tom="neutro">folga</Selo>
                          ) : (
                            <Selo tom="ok">alvo atingido</Selo>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota" style={{ margin: "9px 0 22px" }}>
                Déficit conta as horas de cerimônia obrigatória que não couberam nem com tolerância, convertidas em
                equivalente de pessoa daquele cargo.
              </p>
              <SecCab titulo="Resultado contra a agenda atual" apoio="semana 1" />
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th className="n">Atual</th>
                    <th className="n">Otimizado</th>
                    <th className="n">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.map(([rotulo, atual, otimizado, d, menorMelhor]) => {
                    const bom = menorMelhor ? d < 0 : d > 0
                    const cor = Math.abs(d) < 0.05 ? "var(--ink-3)" : bom ? "var(--ok)" : "var(--bad)"
                    return (
                      <tr key={rotulo}>
                        <td>{rotulo}</td>
                        <td className="n">{atual}</td>
                        <td className="n">{otimizado}</td>
                        <td className="n" style={{ color: cor }}>
                          {d > 0 ? "+" : ""}
                          {n1(d)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          ) : null}

          {aba === "concessoes" ? (
            conc.length ? (
              <>
                <div className="rolagem" style={{ maxHeight: 440 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>Cargo</th>
                        <th>Premissa cedida</th>
                        <th className="n">Alvo</th>
                        <th className="n">Aplicado</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conc.map((c, i) => (
                        <tr key={i}>
                          <td>{c.pessoa}</td>
                          <td className="meta">{c.papel}</td>
                          <td>{c.premissa}</td>
                          <td className="n">{n1(c.alvo)}{c.un}</td>
                          <td className="n" style={{ color: "var(--warn)" }}>{n1(c.valor)}{c.un}</td>
                          <td className="meta">{c.cerimonia}, {c.projeto}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="nota" style={{ marginTop: 9 }}>
                  Toda cessão de premissa é registrada com o valor alvo, o valor aplicado e a cerimônia que motivou.
                  Nenhuma delas ultrapassa o limite aceitável do cargo.
                </p>
              </>
            ) : (
              <VazioTela titulo="Nenhuma premissa cedida">Toda a demanda coube dentro do alvo de cada cargo.</VazioTela>
            )
          ) : null}

          {aba === "trocas" ? (
            trocas.length ? (
              <>
                <div className="rolagem" style={{ maxHeight: 440 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        <th>Cerimônia</th>
                        <th>Cargo</th>
                        <th>Sai</th>
                        <th>Entra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trocas.flatMap((t, i) =>
                        t.subs.map((s, j) => (
                          <tr key={`${i}-${j}`}>
                            <td>{t.ev.projeto}</td>
                            <td>{t.ev.tipo}</td>
                            <td className="meta">{s.papel}</td>
                            <td>{mundo.pessoas[s.de]?.nome}</td>
                            <td><b>{mundo.pessoas[s.para]?.nome}</b></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="nota" style={{ marginTop: 9 }}>
                  A camada 2 troca o participante por outro do mesmo cargo com folga no alvo, antes de qualquer
                  concessão. Nenhuma premissa é cedida aqui.
                </p>
              </>
            ) : (
              <VazioTela titulo="Nenhuma troca necessária">Todos os participantes previstos tinham folga no próprio alvo.</VazioTela>
            )
          ) : null}

          {aba === "pendencias" ? (
            adi.length ? (
              <>
                <div className="rolagem" style={{ maxHeight: 440 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        <th>Cerimônia</th>
                        <th>Cargos</th>
                        <th>Tipo</th>
                        <th>Motivo</th>
                        <th className="n">Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adi.map((a) => (
                        <tr key={a.id}>
                          <td>{a.projeto}</td>
                          <td>{a.tipo}</td>
                          <td className="meta">{a.papeis.join(", ")}</td>
                          <td>
                            {a.sla ? (
                              <Selo tom="ruim">SLA {a.prazoDias}d</Selo>
                            ) : a.obrig ? (
                              <Selo tom="aviso">obrigatória</Selo>
                            ) : (
                              <Selo tom="neutro">opcional</Selo>
                            )}
                          </td>
                          <td className="meta">{a.motivo}</td>
                          <td className="n">{a.dur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="nota" style={{ marginTop: 9 }}>
                  O que sobra aqui não é problema de agenda, é falta de capacidade. As saídas são contratar, baixar a
                  cadência do playbook ou reduzir o alvo do cargo.
                </p>
              </>
            ) : (
              <VazioTela titulo="Toda a demanda foi atendida">Nenhuma cerimônia ficou fora do plano.</VazioTela>
            )
          ) : null}

          {aba === "cenarios" ? <AbaCenarios /> : null}
          {aba === "simulacao" ? <AbaSimulacao ctx={{ mundo, config, simulacao: sim, cenario, ms, indices }} /> : null}
        </div>
      </section>

      <SalvarCenario aberto={salvando} config={config} onFechar={() => setSalvando(false)} onSalvo={() => setAba("cenarios")} />
    </>
  )
}

const ALERTA = {
  critico: { tom: "ruim", rotulo: "crítico" },
  atencao: { tom: "aviso", rotulo: "atenção" },
  info: { tom: "neutro", rotulo: "info" },
} as const satisfies Record<AlertaNarrador["gravidade"], { tom: string; rotulo: string }>

/**
 * Narração da IA (E20) para o resultado exibido. Sem IA (`entrada` nula) não chama nada. Espera o
 * motor assentar antes de chamar, ignora respostas de resultados antigos e, se a action falhar ou
 * devolver null, a tela fica com a leitura determinística.
 */
function useNarracao(entrada: EntradaNarrador | null): Narracao | null {
  const chave = entrada ? JSON.stringify(entrada) : null
  const [ia, setIa] = useState<{ chave: string; narracao: Narracao } | null>(null)
  useEffect(() => {
    if (!chave) return
    let vivo = true
    const espera = setTimeout(() => {
      narrarResultado(JSON.parse(chave) as EntradaNarrador)
        .then((narracao) => {
          if (vivo && narracao) setIa({ chave, narracao })
        })
        .catch(() => {
          // falha de rede ou da action: fica a leitura determinística
        })
    }, 800)
    return () => {
      vivo = false
      clearTimeout(espera)
    }
  }, [chave])
  return ia && ia.chave === chave ? ia.narracao : null
}
