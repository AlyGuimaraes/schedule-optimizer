"use client"

import { Fragment, useState } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import {
  Health,
  Selo,
  SeloFase,
  SecCab,
  TagCerimonia,
  Trilha,
  VazioTela,
  tomOcupacao,
} from "@/components/cadencia/primitivas"
import { EditorCab, Modal } from "@/components/cadencia/modal"
import { estiloHue, hueCer } from "@/lib/cores"
import { ancorar, removerAncora } from "@/lib/dados/cenarios"
import {
  almoco,
  chaveSerie,
  dataDoDia,
  diaMes,
  etapaDe,
  geralDe,
  justificativa,
  pesoCliente,
  premDe,
  type Cerimonia,
} from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useListaParametro, useParametro } from "@/lib/estado/url"
import { DIAS_LB, hhmm, n0, n1, primeiro } from "@/lib/formato"

import { fatorMes, pessoaHora, resultadoDe, situacaoPessoa } from "./comum"

const ALT = 31
const ESCALAS = ["semana", "mes"] as const

export function TelaAgenda() {
  return <ComDados>{(ctx) => <Agenda {...ctx} />}</ComDados>
}

/** Distribui cerimônias simultâneas em faixas lado a lado, dividindo a largura igualmente. */
function faixasDoDia(evs: Cerimonia[]) {
  const ordenadas = [...evs].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || b.slots - a.slots)
  const fim: number[] = []
  const faixa = new Map<number, number>()
  ordenadas.forEach((ev) => {
    let f = 0
    while (fim[f] !== undefined && fim[f] > (ev.slot ?? 0)) f++
    fim[f] = (ev.slot ?? 0) + ev.slots
    faixa.set(ev.id, f)
  })
  return { ordenadas, faixa, total: Math.max(1, fim.length) }
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// Porte de telaAgenda() do protótipo (§7.2).
function Agenda(ctx: Contexto) {
  const { mundo, config, simulacao: sim, cenario } = ctx
  const cal = config.calendario
  const [escala, setEscala] = useParametro("escala", "semana", ESCALAS)
  const [semanaTxt, setSemanaTxt] = useParametro<string>("semana", "1")
  const [pessoasUrl, setPessoas] = useListaParametro("pessoas")
  const [projetosUrl, setProjetos] = useListaParametro("clientes")
  const [painel, setPainel] = useState<null | "pessoas" | "projetos">(null)
  const [busca, setBusca] = useState("")
  const [detalhe, setDetalhe] = useState<{ ev: Cerimonia; semana: number } | null>(null)

  const pessoasSel = pessoasUrl.filter((id) => mundo.pessoas[id])
  const projetosSel = projetosUrl.filter((id) => mundo.projetos[id])
  const semanaIdx = Math.min(Math.max(1, Number(semanaTxt) || 1), sim.semanas.length) - 1
  const w = sim.semanas[semanaIdx]
  const r = resultadoDe(w, cenario)
  const G = geralDe(config)

  const umaPessoa = pessoasSel.length === 1 ? mundo.pessoas[pessoasSel[0]] : null
  const proj = projetosSel.length === 1 ? mundo.projetos[projetosSel[0]] : null
  const p = umaPessoa ?? mundo.pessoas[0]
  const prem = premDe(config, p.papel)
  // compromissos importados (E09) só com uma pessoa selecionada, como as ausências
  const bloqueiosSemana = umaPessoa ? (cal?.bloqueios?.[semanaIdx + 1]?.[umaPessoa.id] ?? []) : []

  const visiveis = (lista: Cerimonia[]) =>
    lista.filter(
      (ev) =>
        (projetosSel.length === 0 || projetosSel.includes(ev.projetoId)) &&
        (pessoasSel.length === 0 || ev.participantes.some((x) => pessoasSel.includes(x)))
    )
  const evsSemana = visiveis(r.alocadas)
  const quem = (ev: Cerimonia) => ev.participantes.map((x) => primeiro(mundo.pessoas[x].nome)).join(", ")

  const rotuloPessoas =
    pessoasSel.length === 0 ? "todas" : pessoasSel.length === 1 ? primeiro(mundo.pessoas[pessoasSel[0]].nome) : `${pessoasSel.length} pessoas`
  const rotuloProjetos =
    projetosSel.length === 0 ? "todos" : projetosSel.length === 1 ? mundo.projetos[projetosSel[0]].nome : `${projetosSel.length} clientes`

  const alternarPainel = (alvo: "pessoas" | "projetos") => {
    setPainel(painel === alvo ? null : alvo)
    setBusca("")
  }

  // ─────────── painel de filtro ───────────
  let painelFiltro = null
  if (painel) {
    const ehPessoas = painel === "pessoas"
    const termo = busca.trim().toLowerCase()
    const sel = ehPessoas ? pessoasSel : projetosSel
    const itens = ehPessoas
      ? mundo.pessoas
          .filter((x) => !termo || x.nome.toLowerCase().includes(termo))
          .map((x) => ({ id: x.id, nome: x.nome, apoio: x.papel }))
      : [...mundo.projetos]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .filter((x) => !termo || x.nome.toLowerCase().includes(termo))
          .map((x) => ({ id: x.id, nome: x.nome, apoio: mundo.etapas[x.fase]?.rotulo ?? x.fase }))
    const tot = ehPessoas ? mundo.pessoas.length : mundo.projetos.length
    const definir = ehPessoas ? setPessoas : setProjetos
    painelFiltro = (
      <div className="painel-filtro abre">
        <div className="filtro-cab">
          <input
            type="text"
            autoFocus
            placeholder={ehPessoas ? "buscar pessoa" : "buscar cliente"}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar"
          />
          <span className="meta">{sel.length === 0 ? `todos os ${tot}` : `${sel.length} de ${tot}`} selecionados</span>
          <button
            type="button"
            className="mini-btn"
            onClick={() => definir(ehPessoas ? mundo.pessoas.map((x) => x.id) : mundo.projetos.map((x) => x.id))}
          >
            Selecionar todos
          </button>
          <button type="button" className="mini-btn" onClick={() => definir([])}>
            Limpar seleção
          </button>
          <button type="button" className="mini-btn" onClick={() => setPainel(null)}>
            Fechar
          </button>
        </div>
        <div className="filtro-lista">
          {itens.length ? (
            itens.map((x) => {
              const on = sel.includes(x.id)
              return (
                <button
                  key={x.id}
                  type="button"
                  className="opcao"
                  aria-pressed={on}
                  onClick={() => definir(on ? sel.filter((y) => y !== x.id) : [...sel, x.id])}
                >
                  <i />
                  <span>
                    {x.nome}
                    <em>{x.apoio}</em>
                  </span>
                </button>
              )
            })
          ) : (
            <p className="meta" style={{ padding: 10 }}>
              Nada encontrado para esta busca.
            </p>
          )}
        </div>
        <p className="meta" style={{ marginTop: 8 }}>
          Sem nada marcado, a agenda mostra {ehPessoas ? "o time inteiro" : "todos os clientes"}.
        </p>
      </div>
    )
  }

  const ferramentas = (
    <>
      <div className="ferramentas">
        <div className="seg compacta" role="group" aria-label="Escala da agenda">
          <button type="button" aria-pressed={escala === "semana"} onClick={() => setEscala("semana")}>
            Semana
          </button>
          <button type="button" aria-pressed={escala === "mes"} onClick={() => setEscala("mes")}>
            Mês
          </button>
        </div>
        {escala === "semana" && sim.semanas.length > 1 ? (
          <div className="seg compacta" role="group" aria-label="Semana do horizonte">
            {sim.semanas.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={semanaIdx === i}
                onClick={() => setSemanaTxt(String(i + 1))}
              >
                S{i + 1}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className={`pilula botao ${pessoasSel.length ? "ativa" : ""}`}
          aria-expanded={painel === "pessoas"}
          onClick={() => alternarPainel("pessoas")}
        >
          <span>Pessoas</span>
          <b>{rotuloPessoas}</b>
          <Chevron />
        </button>
        <button
          type="button"
          className={`pilula botao ${projetosSel.length ? "ativa" : ""}`}
          aria-expanded={painel === "projetos"}
          onClick={() => alternarPainel("projetos")}
        >
          <span>Clientes</span>
          <b>{rotuloProjetos}</b>
          <Chevron />
        </button>
        {pessoasSel.length || projetosSel.length ? (
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              setPessoas([])
              setProjetos([])
              setPainel(null)
            }}
          >
            limpar filtros
          </button>
        ) : null}
        <span className="meta" style={{ marginLeft: "auto" }}>
          {evsSemana.length} cerimônias na semana {semanaIdx + 1},{" "}
          {n1(evsSemana.reduce((s, e) => s + e.dur / 60, 0))}h
        </span>
      </div>
      {painelFiltro}
    </>
  )

  // ─────────── corpo: semana ou mês ───────────
  let corpo
  if (escala === "semana") {
    const horasDia = [0, 0, 0, 0, 0]
    evsSemana.forEach((ev) => (horasDia[ev.dia ?? 0] += ev.dur / 60))
    const tipos = [...new Set(evsSemana.map((e) => e.tipo))].sort()
    corpo = evsSemana.length ? (
      <>
        <div className="grade">
          <div className="gh">
            <b>h</b>
          </div>
          {DIAS_LB.map((d, i) => {
            const feriado = cal?.feriados?.[semanaIdx + 1]?.[i]
            const fora = umaPessoa ? cal?.indisponivel?.[semanaIdx + 1]?.[umaPessoa.id]?.[i] : undefined
            return (
              <div key={d} className="gh" data-carregado={horasDia[i] ? 1 : 0} data-dica={feriado ?? fora}>
                <b>
                  {d}
                  {cal ? <span className="meta"> {diaMes(dataDoDia(cal.inicio, semanaIdx + 1, i))}</span> : null}
                </b>
                <em>{feriado ? "feriado" : fora ? "fora" : horasDia[i] ? `${n1(horasDia[i])}h` : "livre"}</em>
              </div>
            )
          })}
          <div className="horas">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i}>{i % 2 === 0 ? hhmm(i) : ""}</div>
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((d) => {
            const { ordenadas, faixa, total } = faixasDoDia(evsSemana.filter((ev) => ev.dia === d))
            return (
              <div key={d} className="dia" style={{ height: 20 * ALT }}>
                {G.inicio > 0 ? <div className="zona z-fora" style={{ top: 0, height: G.inicio * ALT }} /> : null}
                {G.fim < 20 ? <div className="zona z-fora" style={{ top: G.fim * ALT, height: (20 - G.fim) * ALT }} /> : null}
                {Array.from({ length: G.fim - G.inicio }, (_, i) => G.inicio + i)
                  .filter((s) => !G.preferidos.includes(s) && !almoco(G, s))
                  .map((s) => (
                    <div key={`np${s}`} className="zona z-nopref" style={{ top: s * ALT, height: ALT }} />
                  ))}
                {umaPessoa && !proj && prem.focoProt > 0 ? (
                  <div className="zona z-foco" style={{ top: G.inicio * ALT, height: prem.focoProt * ALT }} />
                ) : null}
                <div className="zona z-almoco" style={{ top: G.almocoInicio * ALT, height: G.almocoDur * ALT }} />
                {G.diaProtegido === "sexta" && d === 4 ? <div className="zona z-fora" style={{ top: 0, height: 20 * ALT }} /> : null}
                {cal?.feriados?.[semanaIdx + 1]?.[d] ||
                (umaPessoa && cal?.indisponivel?.[semanaIdx + 1]?.[umaPessoa.id]?.[d]) ? (
                  <div className="zona z-fora" style={{ top: 0, height: 20 * ALT }} />
                ) : null}
                {/* agenda importada (E09): compromissos de fora da pessoa selecionada */}
                {bloqueiosSemana
                  .filter((b) => b.dia === d)
                  .map((b, i) => (
                    <div
                      key={`bl${i}`}
                      className="zona z-fora"
                      style={{ top: b.inicio * ALT, height: (b.fim - b.inicio) * ALT }}
                    />
                  ))}
                {G.diaProtegido === "sexta-tarde" && d === 4 ? (
                  <div
                    className="zona z-fora"
                    style={{ top: (G.almocoInicio + G.almocoDur) * ALT, height: (20 - G.almocoInicio - G.almocoDur) * ALT }}
                  />
                ) : null}
                {Array.from({ length: 19 }, (_, i) => (
                  <div key={`l${i}`} className="linha-h" style={{ top: (i + 1) * ALT }} />
                ))}
                {ordenadas.map((ev) => {
                  const larg = 100 / total
                  const esq = (faixa.get(ev.id) ?? 0) * larg
                  const destaque = umaPessoa && proj && ev.participantes.includes(umaPessoa.id)
                  const sub = pessoasSel.length === 1 && !proj ? ev.projeto.split(" ").slice(0, 2).join(" ") : quem(ev)
                  const slot = ev.slot ?? 0
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className="cer"
                      onClick={() => setDetalhe({ ev, semana: semanaIdx + 1 })}
                      style={{
                        ...estiloHue(hueCer(ev.tipo)),
                        top: slot * ALT + 1,
                        height: ev.slots * ALT - 3,
                        left: `calc(${esq}% + 3px)`,
                        right: `calc(${100 - esq - larg}% + 3px)`,
                      }}
                      data-cedido={ev.relaxado ? 1 : 0}
                      data-meu={destaque ? 1 : 0}
                      data-dica={`${ev.tipo}, ${ev.projeto}. ${hhmm(slot)} às ${hhmm(slot + ev.slots)}. Com ${quem(ev)}.${ev.relaxado ? " Alocada com concessão de premissa." : ""}${ev.sla ? ` Prazo de ${ev.prazoDias} dias úteis.` : ""}`}
                    >
                      <b>{ev.tipo}</b>
                      <i>
                        {hhmm(slot)} · {sub}
                      </i>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="legenda">
          {tipos.map((t) => (
            <TagCerimonia key={t} tipo={t} />
          ))}
          <span className="div" />
          {umaPessoa && !proj ? (
            <span className="tag-neutra">
              <i className="z-foco" />
              janela protegida {n1(prem.focoProt / 2)}h
            </span>
          ) : null}
          {bloqueiosSemana.length ? (
            <span className="tag-neutra">
              <i className="z-fora" />
              compromisso da agenda importada
            </span>
          ) : null}
          <span className="tag-neutra">
            <i className="tracejada" />
            com concessão
          </span>
          <span className="tag-neutra">
            <i className="z-nopref" />
            fora do horário preferencial
          </span>
        </div>
      </>
    ) : (
      <VazioTela
        titulo={`Nenhuma cerimônia na semana ${semanaIdx + 1}`}
        acao={
          <button type="button" className="btn leve" onClick={() => setEscala("mes")}>
            Ver o mês
          </button>
        }
      >
        {projetosSel.length
          ? "A cadência desta etapa não prevê cerimônia toda semana. A visão mensal mostra o ciclo completo."
          : "Semana sem reuniões para quem está selecionado."}
      </VazioTela>
    )
  } else {
    corpo = (
      <>
        <div className="mensal">
          <div className="mh" />
          {DIAS_LB.map((d) => (
            <div key={d} className="mh">
              {d}
            </div>
          ))}
          {sim.semanas.map((sem, wi) => {
            const evs = visiveis(resultadoDe(sem, cenario).alocadas)
            const total = evs.reduce((s, ev) => s + ev.dur / 60, 0)
            return (
              <Fragment key={wi}>
                <div className="ml">
                  Semana {wi + 1}
                  {cal ? <span className="meta">{diaMes(dataDoDia(cal.inicio, wi + 1, 0))}</span> : null}
                  <span className="meta">
                    {evs.length} cerim., {n1(total)}h
                  </span>
                </div>
                {[0, 1, 2, 3, 4].map((d) => {
                  const dia = evs.filter((ev) => ev.dia === d).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
                  const h = dia.reduce((s, ev) => s + ev.dur / 60, 0)
                  return (
                    <div key={d} className="mc" data-vazio={h ? 0 : 1}>
                      {h ? (
                        <div className="mt">
                          {n1(h)}h · {dia.length}
                        </div>
                      ) : null}
                      {dia.slice(0, 6).map((ev) => {
                        const rotulo = pessoasSel.length === 1 && !projetosSel.length ? ev.projeto : quem(ev)
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className="mcer"
                            onClick={() => setDetalhe({ ev, semana: wi + 1 })}
                            style={estiloHue(hueCer(ev.tipo))}
                            data-cedido={ev.relaxado ? 1 : 0}
                            data-dica={`${ev.tipo}, ${ev.projeto}. ${hhmm(ev.slot ?? 0)}. Com ${quem(ev)}.`}
                          >
                            <em>{hhmm(ev.slot ?? 0)}</em> {ev.tipo.split(" ")[0]} · {rotulo.split(" ").slice(0, 2).join(" ")}
                          </button>
                        )
                      })}
                      {dia.length > 6 ? (
                        <div className="meta" style={{ paddingLeft: 4 }}>
                          e mais {dia.length - 6}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
        <p className="nota" style={{ marginTop: 10 }}>
          Horizonte de {config.horizonte} semanas.
        </p>
      </>
    )
  }

  // ─────────── painel lateral ───────────
  let lateral
  if (!umaPessoa && !proj) {
    lateral = <PainelAgregado ctx={ctx} r={r} evs={evsSemana} pessoasSel={pessoasSel} projetosSel={projetosSel} />
  } else if (proj) {
    const F = fatorMes(config)
    const hSem = r.alocadas.filter((e) => e.projetoId === proj.id).reduce((s, e) => s + pessoaHora(e), 0)
    const doProj = sim.semanas.map((sm) => resultadoDe(sm, cenario).alocadas.filter((e) => e.projetoId === proj.id))
    const hMes = doProj.reduce((s, l) => s + l.reduce((a, e) => a + pessoaHora(e), 0), 0) * F
    const cMes = doProj.reduce((s, l) => s + l.length, 0) * F
    const et = etapaDe(config, proj.fase)
    lateral = (
      <>
        <SecCab titulo={proj.nome} apoio={<SeloFase fase={proj.fase} etapas={mundo.etapas} />} />
        <table>
          <tbody>
            <tr><td>Prioridade do cliente</td><td className="n">{proj.prioridade}, peso {pesoCliente(config, proj.prioridade)}</td></tr>
            <tr><td>Urgência da etapa</td><td className="n">{et.urgencia} de 5</td></tr>
            <tr><td>Prazo da etapa</td><td className="n">{et.prazoDias} dias úteis</td></tr>
            <tr><td>Mês do projeto</td><td className="n">{proj.mes}</td></tr>
            <tr>
              <td>Produtos</td>
              <td className="n">
                {proj.produtos.relatorios}R · {proj.produtos.dashboards}D · {proj.produtos.integracoes}I
              </td>
            </tr>
            <tr><td><b>Horas por semana</b></td><td className="n"><b>{n1(hSem)}</b></td></tr>
            <tr><td>Horas por mês</td><td className="n">{n1(hMes)}</td></tr>
            <tr><td>Cerimônias por mês</td><td className="n">{n0(cMes)}</td></tr>
            <tr><td>Health</td><td className="n"><Health health={proj.health} /></td></tr>
          </tbody>
        </table>
        <SecCab titulo="Squad" apoio={`${Object.keys(proj.squad).length} cadeiras`} style={{ marginTop: 20 }} />
        <table>
          <tbody>
            {Object.entries(proj.squad).map(([pp, id]) => (
              <tr key={pp}>
                <td>{pp}</td>
                <td style={{ textAlign: "right" }}>
                  {id === undefined ? <Selo tom="ruim">cadeira vaga</Selo> : mundo.pessoas[id]?.nome}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  } else {
    const k = r.kpi.porPessoa[p.id]
    const projs = mundo.projetos.filter((x) => Object.values(x.squad).includes(p.id))
    const mes = sim.mes[cenario].porPessoa[p.id]
    const [tom, texto] = situacaoPessoa(k)
    lateral = (
      <>
        <SecCab titulo={p.nome} apoio={<Selo tom={tom}>{texto}</Selo>} />
        <table>
          <tbody>
            <tr><td>Cargo</td><td className="n">{p.papel}</td></tr>
            <tr><td>Capacidade líquida</td><td className="n">{n1(prem.Cl)} h</td></tr>
            <tr><td>Alvo de tempo produtivo</td><td className="n">{prem.produtivoMin}%</td></tr>
            <tr><td>Teto de reunião</td><td className="n">{n1(prem.teto)} h</td></tr>
            <tr><td>Limite aceitável</td><td className="n">{n1(prem.tetoMax)} h</td></tr>
            <tr>
              <td><b>Horas em reunião</b></td>
              <td className="n"><b style={{ color: k.acimaTeto ? "var(--bad)" : "var(--ok)" }}>{n1(k.horas)} h</b></td>
            </tr>
            <tr><td>Folga até o teto</td><td className="n">{n1(k.folga)} h</td></tr>
            <tr>
              <td>Máx. dia, semana, mês</td>
              <td className="n">{n1(prem.maxHorasDia)} · {n1(prem.maxHorasSemana)} · {n1(prem.maxHorasMes)} h</td>
            </tr>
            <tr><td>Duração máxima</td><td className="n">{n1(prem.duracaoMax / 2)} h</td></tr>
            <tr><td>Blocos de foco</td><td className="n">{k.blocosFoco}</td></tr>
            <tr><td>Fragmentação</td><td className="n">{n1(k.frag * 100)}%</td></tr>
            <tr><td>Reuniões no mês</td><td className="n">{mes.reunioes}</td></tr>
            <tr><td>Horas no mês</td><td className="n">{n1(mes.horas)} h</td></tr>
          </tbody>
        </table>
        <SecCab titulo="Projetos" apoio={`${projs.length} alocações`} style={{ marginTop: 20 }} />
        <div className="rolagem" style={{ maxHeight: 230 }} tabIndex={0} role="region" aria-label="Projetos da pessoa">
          <table>
            <tbody>
              {projs.map((x) => (
                <tr key={x.id}>
                  <td>
                    <button type="button" className="mini-btn link" onClick={() => setProjetos([x.id])}>
                      {x.nome}
                    </button>
                    <div className="meta">{Object.entries(x.squad).find(([, v]) => v === p.id)?.[0]}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <SeloFase fase={x.fase} etapas={mundo.etapas} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <>
      {ferramentas}
      <div className="colunas c-agenda sec">
        <section>{corpo}</section>
        <section>{lateral}</section>
      </div>
      <DetalheCerimonia
        ctx={ctx}
        detalhe={detalhe}
        onFechar={() => setDetalhe(null)}
        onVerProjeto={(id) => {
          setProjetos([id])
          setDetalhe(null)
        }}
      />
    </>
  )
}

/** Detalhe de uma cerimônia: por que caiu neste horário (§12) e a âncora do cliente (E13). */
function DetalheCerimonia({
  ctx,
  detalhe,
  onFechar,
  onVerProjeto,
}: {
  ctx: Contexto
  detalhe: { ev: Cerimonia; semana: number } | null
  onFechar: () => void
  onVerProjeto: (projetoId: number) => void
}) {
  const acao = useAcao()
  if (!detalhe) return null
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const { ev, semana } = detalhe
  const w = sim.semanas[semana - 1]
  const dia = ev.dia ?? 0
  const slot = ev.slot ?? 0
  const ancorada = !!config.ancoras?.[chaveSerie(ev)]
  const frases =
    cenario === "otm" && w
      ? justificativa(ev, w.otm, mundo, config)
      : [
          "Agenda vigente simulada: o horário foi marcado no maior bloco livre comum, sem política de premissas.",
          `Participantes: ${ev.participantes.map((p, i) => `${mundo.pessoas[p]?.nome} (${ev.papeis[i]})`).join(", ")}.`,
        ]
  const projetoId = indices.projetos[ev.projetoId]
  const itemId = indices.playbook[`${ev.fase}|${ev.tipo}`]

  return (
    <Modal aberto largura={600} onFechar={onFechar} rotulo={ev.tipo}>
      <EditorCab
        titulo={ev.tipo}
        meta={`${ev.projeto} · semana ${semana}, ${DIAS_LB[dia]}${
          config.calendario ? ` ${diaMes(dataDoDia(config.calendario.inicio, semana, dia))}` : ""
        } ${hhmm(slot)} às ${hhmm(slot + ev.slots)}`}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <TagCerimonia tipo={ev.tipo} />
        <SeloFase fase={ev.fase} etapas={mundo.etapas} />
        {ev.camada ? (
          <Selo tom={ev.camada === 3 ? "aviso" : ev.camada === 2 ? "acento" : "ok"}>camada {ev.camada}</Selo>
        ) : null}
        {ev.sla ? <Selo tom="ruim">SLA {ev.prazoDias}d</Selo> : null}
        {ancorada ? <Selo tom="acento">ancorada</Selo> : null}
        {!ev.obrig ? <Selo tom="neutro">opcional</Selo> : null}
        {ev.origem ? <Selo tom="acento">modificador: {ev.origem}</Selo> : null}
        {ev.congelada ? <Selo tom="neutro">mantida, a menos de 48h</Selo> : null}
      </div>
      <SecCab titulo="Por que este horário" />
      <ul className="nota" style={{ display: "grid", gap: 6, paddingLeft: 18, listStyle: "disc" }}>
        {frases.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="editor-pe">
        {acao.erro ? <span className="msg">{acao.erro}</span> : null}
        <button type="button" className="mini-btn" onClick={() => onVerProjeto(ev.projetoId)}>
          Ver o projeto
        </button>
        {cenario === "otm" && projetoId && itemId ? (
          ancorada ? (
            <button
              type="button"
              className="btn leve"
              disabled={acao.pendente}
              onClick={() => acao.executar(() => removerAncora(projetoId, itemId), "âncora removida, cenário replanejado", onFechar)}
            >
              Remover âncora
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={acao.pendente}
              onClick={() =>
                acao.executar(() => ancorar({ projetoId, itemId, dia, slot }), "série ancorada neste horário", onFechar)
              }
            >
              Ancorar neste horário
            </button>
          )
        ) : null}
      </div>
      <p className="meta" style={{ marginTop: 10 }}>
        Ancorar fixa a série inteira neste dia e horário, em todas as semanas, como restrição rígida: o otimizador a
        aloca antes de tudo. Serve para quando o cliente impõe o horário.
      </p>
    </Modal>
  )
}

function PainelAgregado({
  ctx,
  r,
  evs,
  pessoasSel,
  projetosSel,
}: {
  ctx: Contexto
  r: ReturnType<typeof resultadoDe>
  evs: Cerimonia[]
  pessoasSel: number[]
  projetosSel: number[]
}) {
  const { mundo } = ctx
  const pessoas = pessoasSel.length ? pessoasSel.map((id) => mundo.pessoas[id]) : mundo.pessoas
  const k = r.kpi
  const horasPessoa = pessoas
    .map((x) => ({ nome: x.nome, papel: x.papel, kp: k.porPessoa[x.id] }))
    .sort((a, b) => b.kp.horas - a.kp.horas)
  const porTipo: Record<string, number> = {}
  evs.forEach((ev) => (porTipo[ev.tipo] = (porTipo[ev.tipo] || 0) + ev.dur / 60))
  const ph = evs.reduce((s, e) => s + pessoaHora(e), 0)
  const acima = horasPessoa.filter((x) => x.kp.acimaTeto).length
  const cedidas = evs.filter((e) => e.relaxado).length

  return (
    <>
      <SecCab
        titulo="Seleção"
        apoio={`${pessoasSel.length ? `${pessoasSel.length} pessoas` : "time inteiro"}, ${projetosSel.length ? `${projetosSel.length} clientes` : "todos os clientes"}`}
      />
      <table>
        <tbody>
          <tr><td>Cerimônias na semana</td><td className="n">{evs.length}</td></tr>
          <tr><td>Horas de agenda</td><td className="n">{n1(evs.reduce((s, e) => s + e.dur / 60, 0))} h</td></tr>
          <tr><td>Pessoa-hora</td><td className="n">{n1(ph)} h</td></tr>
          <tr><td>Pessoas envolvidas</td><td className="n">{new Set(evs.flatMap((e) => e.participantes)).size}</td></tr>
          <tr><td>Projetos envolvidos</td><td className="n">{new Set(evs.map((e) => e.projetoId)).size}</td></tr>
          <tr>
            <td>Com concessão</td>
            <td className="n" style={{ color: cedidas ? "var(--warn)" : "var(--ink)" }}>{cedidas}</td>
          </tr>
          <tr>
            <td>Acima do teto do cargo</td>
            <td className="n" style={{ color: acima ? "var(--bad)" : "var(--ok)" }}>
              {acima} de {pessoas.length}
            </td>
          </tr>
        </tbody>
      </table>

      <SecCab titulo="Carga por pessoa" apoio="semana, contra o teto do cargo" style={{ marginTop: 20 }} />
      <div className="rolagem" style={{ maxHeight: 250 }} tabIndex={0} role="region" aria-label="Carga por pessoa">
        <table>
          <tbody>
            {horasPessoa.map((x) => {
              const ocup = x.kp.teto > 0 ? (x.kp.horas / x.kp.teto) * 100 : 0
              return (
                <tr key={x.nome}>
                  <td>
                    {x.nome}
                    <div className="meta">{x.papel}</div>
                  </td>
                  <td style={{ width: 92 }}>
                    <Trilha valor={Math.min(ocup, 100)} max={100} limite={100} tom={tomOcupacao(ocup)} />
                  </td>
                  <td className="n" style={{ width: 54 }}>{n1(x.kp.horas)}h</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {Object.keys(porTipo).length ? (
        <>
          <SecCab titulo="Por tipo" apoio="horas de agenda" style={{ marginTop: 20 }} />
          <table>
            <tbody>
              {Object.entries(porTipo)
                .sort((a, b) => b[1] - a[1])
                .map(([t, v]) => (
                  <tr key={t}>
                    <td><TagCerimonia tipo={t} /></td>
                    <td className="n">{n1(v)}h</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  )
}
