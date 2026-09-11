"use client"

import Link from "next/link"
import { useState } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import {
  Abas,
  Aviso,
  IconeMais,
  SecCab,
  Selo,
  Trilha,
  VazioTela,
  tomOcupacao,
} from "@/components/cadencia/primitivas"
import {
  definirExcecaoPessoa,
  excluirCargo,
  excluirPessoa,
  excluirTime,
  redistribuirAlocacao,
  salvarCargo,
  salvarPessoa,
  salvarTime,
} from "@/lib/dados/acoes"
import {
  cargoEmUso,
  cargosDoTime,
  membrosDoTime,
  papeisNecessarios,
  premDe,
  projetosDoTime,
} from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useCadencia } from "@/lib/estado/cadencia"
import { useParametro } from "@/lib/estado/url"
import { n0, n1, pc, primeiro } from "@/lib/formato"

import { AbaAgendas } from "./agendas"
import { AbaAusencias } from "./ausencias"
import { fatorMes, papeisDe, pessoaHora, pessoasDo, resultadoDe, situacaoPessoa } from "./comum"

const ABAS = ["pessoas", "times", "cargos", "ausencias", "agendas"] as const
type AbaTime = (typeof ABAS)[number]

export function TelaTime() {
  return <ComDados>{(ctx) => <Time {...ctx} />}</ComDados>
}

// Porte de telaTime() do protótipo (§7.5): Pessoas, Times e Cargos.
function Time(ctx: Contexto) {
  const { mundo, config } = ctx
  const [aba, setAba] = useParametro<AbaTime>("aba", "pessoas", ABAS)
  const abas = [
    { id: "pessoas" as const, rotulo: "Pessoas", apoio: `${mundo.pessoas.length} no time` },
    { id: "times" as const, rotulo: "Times", apoio: `${mundo.times.length} squads` },
    { id: "cargos" as const, rotulo: "Cargos", apoio: `${papeisDe(config).length} cadastrados` },
    { id: "ausencias" as const, rotulo: "Ausências", apoio: "férias e feriados" },
    { id: "agendas" as const, rotulo: "Agendas", apoio: "importadas por .ics" },
  ]
  return (
    <>
      <Abas abas={abas} ativa={aba} onChange={setAba} />
      <div role="tabpanel">
        {aba === "pessoas" ? (
          <AbaPessoas ctx={ctx} />
        ) : aba === "times" ? (
          <AbaTimes ctx={ctx} />
        ) : aba === "cargos" ? (
          <AbaCargos ctx={ctx} />
        ) : aba === "ausencias" ? (
          <AbaAusencias ctx={ctx} />
        ) : (
          <AbaAgendas ctx={ctx} />
        )}
      </div>
    </>
  )
}

// ─────────────────────── pessoas ───────────────────────

function AbaPessoas({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const k = resultadoDe(sim.semanas[0], cenario).kpi
  const papeis = papeisDe(config)
  const [editando, setEditando] = useState<{ idx: number | null } | null>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [redistribuindo, setRedistribuindo] = useState(false)
  const exclusao = useAcao()
  const redistribuicao = useAcao()

  const semGente = papeis.filter(
    (pp) => !pessoasDo(mundo, pp).length && Object.values(mundo.playbook).some((cs) => cs.some((c) => c.papeis.includes(pp)))
  )
  const alvo = excluindo !== null ? mundo.pessoas[excluindo] : null
  const projsAlvo = alvo ? mundo.projetos.filter((pr) => Object.values(pr.squad).includes(alvo.id)).length : 0
  const outros = alvo ? mundo.pessoas.filter((x) => x.papel === alvo.papel && x.id !== alvo.id).length : 0

  return (
    <section className="sec">
      <SecCab
        titulo="Time de implantação"
        apoio={
          <>
            cada pessoa é medida contra o teto do próprio cargo
            <button type="button" className="btn leve" onClick={() => setRedistribuindo(true)}>
              Redistribuir alocação
            </button>
            <button type="button" className="btn" onClick={() => setEditando({ idx: null })}>
              <IconeMais />
              Nova pessoa
            </button>
          </>
        }
      />

      {semGente.length ? (
        <Aviso titulo={`Cargos sem ninguém alocável: ${semGente.join(", ")}`}>
          As cerimônias que exigem esses cargos ficam sem quórum e não entram no plano.
        </Aviso>
      ) : null}

      {mundo.pessoas.length ? (
        <div className="rolagem" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Cargo</th>
                <th className="n">Cap. líq.</th>
                <th className="n">Alvo</th>
                <th className="n">Teto</th>
                <th className="n">Projetos</th>
                <th className="n">Cerim.</th>
                <th className="n">Horas</th>
                <th style={{ width: 120 }}>Ocupação do teto</th>
                <th className="n">Taxa</th>
                <th className="n">Folga</th>
                <th className="n">Foco</th>
                <th className="n">Frag.</th>
                <th className="n">Reun./mês</th>
                <th className="n">h/mês</th>
                <th className="n">Máx mês</th>
                <th>Situação</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {mundo.pessoas.map((p) => {
                const kp = k.porPessoa[p.id]
                const projs = mundo.projetos.filter((pr) => Object.values(pr.squad).includes(p.id)).length
                const mes = sim.mes[cenario].porPessoa[p.id]
                const ocup = kp.teto > 0 ? (kp.horas / kp.teto) * 100 : 0
                const [tom, texto] = situacaoPessoa(kp)
                const corMes = mes.horas > kp.maxHorasMes ? "var(--bad)" : mes.horas > kp.maxHorasMes * 0.9 ? "var(--warn)" : "var(--ink)"
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.nome}</b>
                      {config.excecoesPessoa?.[p.id] ? (
                        <div className="meta" style={{ color: "var(--accent-ink)" }}>com exceção de premissa</div>
                      ) : null}
                    </td>
                    <td className="meta">{p.papel}</td>
                    <td className="n">{n1(kp.Cl)}</td>
                    <td className="n">{kp.produtivoMin}%</td>
                    <td className="n">{n1(kp.teto)}h</td>
                    <td className="n">{projs}</td>
                    <td className="n">{kp.reunioes}</td>
                    <td className="n">{n1(kp.horas)}</td>
                    <td>
                      <Trilha valor={Math.min(ocup, 100)} max={100} limite={100} tom={tomOcupacao(ocup)} />
                      <div className="meta">{n0(ocup)}% do teto</div>
                    </td>
                    <td className="n" style={{ color: kp.acimaTeto ? "var(--bad)" : "var(--ink)" }}>{pc(kp.taxa)}</td>
                    <td className="n">{n1(kp.folga)}h</td>
                    <td className="n">{kp.blocosFoco}</td>
                    <td className="n">{n1(kp.frag * 100)}%</td>
                    <td className="n">{mes.reunioes}</td>
                    <td className="n" style={{ color: corMes }}>{n1(mes.horas)}</td>
                    <td className="n calc">{n1(kp.maxHorasMes)}</td>
                    <td><Selo tom={tom}>{texto}</Selo></td>
                    <td>
                      <span className="acoes">
                        <button type="button" className="mini-btn" onClick={() => setEditando({ idx: p.id })}>editar</button>
                        <button type="button" className="mini-btn perigo" onClick={() => setExcluindo(p.id)}>excluir</button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <VazioTela titulo="Nenhuma pessoa cadastrada">Comece adicionando o time de implantação.</VazioTela>
      )}

      {editando ? <EditorPessoa ctx={ctx} idx={editando.idx} onFechar={() => setEditando(null)} /> : null}

      <Confirmacao
        aberto={alvo !== null}
        titulo={`Remover ${alvo?.nome ?? ""} do time?`}
        acao="Remover pessoa"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={
          alvo
            ? `${projsAlvo} projeto(s) serão reatribuídos ` +
              (outros
                ? `a outra(s) ${outros} pessoa(s) de ${alvo.papel}, pela menor carga.`
                : `sem substituto: não há outro ${alvo.papel}, então essas cerimônias ficarão sem quórum.`)
            : ""
        }
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() =>
          alvo &&
          exclusao.executar(() => excluirPessoa(indices.pessoas[alvo.id]), "pessoa removida, cadeiras reatribuídas", () =>
            setExcluindo(null)
          )
        }
      />

      <Confirmacao
        aberto={redistribuindo}
        titulo="Redistribuir a alocação do time?"
        acao="Redistribuir"
        perigo={false}
        erro={redistribuicao.erro}
        ocupado={redistribuicao.pendente}
        texto={`Todas as cadeiras dos ${mundo.projetos.length} projetos são refeitas pela menor carga de cada cargo. Serve para absorver entradas e saídas no time. A agenda inteira é replanejada em seguida.`}
        onFechar={() => setRedistribuindo(false)}
        onConfirmar={() =>
          redistribuicao.executar(() => redistribuirAlocacao(), "alocação redistribuída", () => setRedistribuindo(false))
        }
      />
    </section>
  )
}

// Exceções que a pessoa pode ter em relação ao cargo (§2.1). esc converte horas em slots do motor.
const CAMPOS_EXCECAO = [
  { k: "focoProt", lb: "Janela protegida", un: "h", esc: 2, min: 0, max: 4, passo: 0.5 },
  { k: "blocoFocoMin", lb: "Bloco mínimo de foco", un: "h", esc: 2, min: 1, max: 4, passo: 0.5 },
  { k: "maxHorasDia", lb: "Máx. horas por dia", un: "h", esc: 1, min: 0.5, max: 8, passo: 0.5 },
  { k: "maxReunioesDia", lb: "Máx. reuniões por dia", un: "", esc: 1, min: 1, max: 10, passo: 1 },
] as const

function EditorPessoa({ ctx, idx, onFechar }: { ctx: Contexto; idx: number | null; onFechar: () => void }) {
  const { mundo, config, indices } = ctx
  const p = idx !== null ? mundo.pessoas[idx] : null
  const papeis = papeisDe(config)
  const [nome, setNome] = useState(p?.nome ?? "")
  const [papel, setPapel] = useState(p?.papel ?? papeis[0])
  const acao = useAcao()
  const projs = p ? mundo.projetos.filter((pr) => Object.values(pr.squad).includes(p.id)) : []
  const inicial = p ? (config.excecoesPessoa?.[p.id] ?? {}) : {}
  const [textoInicial] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CAMPOS_EXCECAO.map((c) => [c.k, inicial[c.k] !== undefined ? String((inicial[c.k] as number) / c.esc) : ""])
    )
  )
  const [exc, setExc] = useState<Record<string, string>>(textoInicial)
  const doCargo = config.papeis[papel]

  const salvar = () => {
    if (!nome.trim()) {
      acao.setErro("Informe o nome.")
      return
    }
    const mudancas = p ? CAMPOS_EXCECAO.filter((c) => (exc[c.k] ?? "") !== (textoInicial[c.k] ?? "")) : []
    acao.executar(
      async () => {
        const r = await salvarPessoa({ id: p ? indices.pessoas[p.id] : null, nome: nome.trim(), cargoId: indices.cargos[papel] })
        if (!r.ok || !p) return r
        for (const c of mudancas) {
          const t = (exc[c.k] ?? "").trim()
          const n = Number(t.replace(",", "."))
          if (t !== "" && Number.isNaN(n)) continue
          const valor = t === "" ? null : Math.min(Math.max(n, c.min), c.max) * c.esc
          const r2 = await definirExcecaoPessoa(indices.pessoas[p.id], c.k, valor)
          if (!r2.ok) return { ok: false as const, erro: r2.erro }
        }
        return r
      },
      "time atualizado, cenário replanejado",
      onFechar
    )
  }

  return (
    <Modal aberto largura={560} onFechar={onFechar} rotulo={p ? `Editar ${p.nome}` : "Nova pessoa"}>
      <EditorCab titulo={p ? `Editar ${p.nome}` : "Nova pessoa"} meta={p ? `${projs.length} projeto(s) alocados` : undefined} />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="ezNome">Nome</label>
          <input id="ezNome" type="text" value={nome} placeholder="Nome e sobrenome" onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo l2">
          <label htmlFor="ezPapel">Cargo</label>
          <select id="ezPapel" value={papel} onChange={(e) => setPapel(e.target.value)}>
            {papeis.map((pp) => {
              const c = premDe(config, pp)
              return (
                <option key={pp} value={pp}>
                  {pp}, alvo {c.produtivoMin}%, teto {n1(c.teto)}h
                </option>
              )
            })}
          </select>
          <span className="dica">
            O cargo define todas as restrições de agenda dessa pessoa. Trocar o cargo libera as cadeiras atuais e
            reatribui os projetos.
          </span>
        </div>
        {!p ? (
          <div className="l4">
            <span className="meta">Depois de criar, inclua a pessoa em um time na aba Times para ela entrar nos squads.</span>
          </div>
        ) : projs.length ? (
          <div className="l4">
            <span className="meta">
              Alocação atual: {projs.slice(0, 12).map((x) => x.nome).join(", ")}
              {projs.length > 12 ? " e outros" : ""}
            </span>
          </div>
        ) : null}
        {p ? (
          <div className="l4">
            <SecCab titulo="Exceções desta pessoa" apoio="o nível mais específico vence o do cargo" style={{ marginBottom: 10 }} />
            <div className="form">
              {CAMPOS_EXCECAO.map((c) => (
                <div key={c.k} className="campo">
                  <label htmlFor={`ex-${c.k}`}>{c.lb}</label>
                  <input
                    id={`ex-${c.k}`}
                    type="number"
                    min={c.min}
                    max={c.max}
                    step={c.passo}
                    value={exc[c.k] ?? ""}
                    placeholder={`cargo: ${n1((doCargo?.[c.k] ?? 0) / c.esc)}${c.un}`}
                    onChange={(e) => setExc({ ...exc, [c.k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <span className="dica">
              Em branco segue o cargo. A janela protegida definida pela própria pessoa é a mitigação que o §12 propõe
              contra a rejeição da agenda pelo time.
            </span>
          </div>
        ) : null}
      </div>
      <EditorPe erro={acao.erro} acao="Salvar pessoa" ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}

// ─────────────────────── times ───────────────────────

function AbaTimes({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const w = sim.semanas[0]
  const r = resultadoDe(w, cenario)
  const k = r.kpi
  const F = fatorMes(config)
  const [editando, setEditando] = useState<{ idx: number | null } | null>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const exclusao = useAcao()

  const horasTime: Record<number, number> = {}
  sim.semanas.forEach((sm) =>
    resultadoDe(sm, cenario).alocadas.forEach((ev) => {
      horasTime[ev.timeId] = (horasTime[ev.timeId] || 0) + pessoaHora(ev) * F
    })
  )
  const alvo = excluindo !== null ? mundo.times.find((t) => t.id === excluindo) ?? null : null
  const nProjAlvo = alvo ? projetosDoTime(mundo, alvo.id).length : 0
  const destinos = mundo.times.filter((t) => t.id !== excluindo)

  return (
    <section className="sec">
      <SecCab
        titulo="Times de implantação"
        apoio={
          <>
            cada projeto pertence a um time e só usa gente dele
            <button type="button" className="btn" onClick={() => setEditando({ idx: null })}>
              <IconeMais />
              Novo time
            </button>
          </>
        }
      />
      <p className="nota" style={{ marginBottom: 12 }}>
        O squad de cada projeto é montado a partir dos membros do time, pelo cargo que a etapa exige e pela menor carga.
        Se o time não tem alguém do cargo obrigatório, a cerimônia fica sem quórum e não entra no plano. É isso que
        impede colocar qualquer pessoa em qualquer projeto.
      </p>
      <div className="larga">
        <table style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th className="n">Pessoas</th>
              <th>Composição por cargo</th>
              <th className="n">Projetos</th>
              <th className="n">Cerim./sem</th>
              <th className="n">h/mês</th>
              <th style={{ width: 150 }}>Ocupação do time</th>
              <th>Cobertura de cargos</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {mundo.times.map((t) => {
              const membros = membrosDoTime(mundo, t.id)
              const projs = projetosDoTime(mundo, t.id)
              const comp = cargosDoTime(mundo, t.id)
              const cer = r.alocadas.filter((ev) => ev.timeId === t.id).length
              const capac = membros.reduce((s, id) => s + premDe(config, mundo.pessoas[id].papel).teto, 0)
              const carga = membros.reduce((s, id) => s + k.porPessoa[id].horas, 0)
              const ocup = capac > 0 ? (carga / capac) * 100 : 0
              const exigidos = [...new Set(projs.flatMap((p) => papeisNecessarios(mundo, p.fase)))]
              const faltando = exigidos.filter((pp) => !comp[pp])
              return (
                <tr key={t.id}>
                  <td><b>{t.nome}</b></td>
                  <td className="n">{membros.length}</td>
                  <td>
                    {Object.entries(comp).length ? (
                      Object.entries(comp).map(([pp, n]) => (
                        <span key={pp} className="selo neutro" style={{ marginRight: 4 }}>
                          {pp} {n}
                        </span>
                      ))
                    ) : (
                      <span className="meta">vazio</span>
                    )}
                  </td>
                  <td className="n">{projs.length}</td>
                  <td className="n">{cer}</td>
                  <td className="n">{n1(horasTime[t.id] || 0)}</td>
                  <td>
                    <Trilha valor={Math.min(ocup, 100)} max={100} limite={100} tom={tomOcupacao(ocup)} />
                    <div className="meta">{n0(ocup)}% do teto somado</div>
                  </td>
                  <td>
                    {faltando.length ? <Selo tom="ruim">falta {faltando.join(", ")}</Selo> : <Selo tom="ok">cobre as etapas</Selo>}
                  </td>
                  <td>
                    <span className="acoes">
                      <button type="button" className="mini-btn" onClick={() => setEditando({ idx: t.id })}>editar</button>
                      {mundo.times.length > 1 ? (
                        <button
                          type="button"
                          className="mini-btn perigo"
                          onClick={() => {
                            setExcluindo(t.id)
                            setDestino(mundo.times.find((x) => x.id !== t.id)?.id ?? null)
                          }}
                        >
                          excluir
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editando ? <EditorTime ctx={ctx} idx={editando.idx} onFechar={() => setEditando(null)} /> : null}

      <Confirmacao
        aberto={alvo !== null}
        titulo={`Excluir ${alvo?.nome ?? ""}?`}
        acao="Excluir time"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={
          nProjAlvo
            ? `${nProjAlvo} projeto(s) pertencem a este time e precisam de destino. Os squads deles serão remontados com os membros do time escolhido.`
            : "Nenhum projeto pertence a este time."
        }
        extra={
          nProjAlvo ? (
            <div className="campo" style={{ marginTop: 14 }}>
              <label htmlFor="destinoTime">Mover os projetos para</label>
              <select id="destinoTime" value={destino ?? ""} onChange={(e) => setDestino(Number(e.target.value))}>
                {destinos.map((x) => (
                  <option key={x.id} value={x.id}>{x.nome}</option>
                ))}
              </select>
            </div>
          ) : null
        }
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() => {
          // corrige o defeito 2 do protótipo: a exclusão de time agora executa
          if (!alvo) return
          const d = destino ?? destinos[0]?.id
          if (d === undefined) return
          exclusao.executar(() => excluirTime(indices.times[alvo.id], indices.times[d]), "time excluído, projetos remanejados", () =>
            setExcluindo(null)
          )
        }}
      />
    </section>
  )
}

function EditorTime({ ctx, idx, onFechar }: { ctx: Contexto; idx: number | null; onFechar: () => void }) {
  const { mundo, indices } = ctx
  const t = idx !== null ? mundo.times.find((x) => x.id === idx) ?? null : null
  const [nome, setNome] = useState(t?.nome ?? "")
  const [membros, setMembros] = useState<number[]>(t ? [...t.membros] : [])
  const acao = useAcao()

  const porPapel: Record<string, typeof mundo.pessoas> = {}
  mundo.pessoas.forEach((p) => (porPapel[p.papel] = [...(porPapel[p.papel] ?? []), p]))
  const projs = t ? projetosDoTime(mundo, t.id) : []
  const exigidos = [...new Set(projs.flatMap((p) => papeisNecessarios(mundo, p.fase)))]
  const cobertos = new Set(membros.map((id) => mundo.pessoas[id]?.papel))
  const faltando = exigidos.filter((pp) => !cobertos.has(pp))

  const salvar = () => {
    if (!nome.trim()) return acao.setErro("Informe o nome do time.")
    if (!membros.length) return acao.setErro("Escolha ao menos uma pessoa.")
    acao.executar(
      () => salvarTime({ id: t ? indices.times[t.id] : null, nome: nome.trim(), membros: membros.map((id) => indices.pessoas[id]) }),
      "time salvo, squads remontados",
      onFechar
    )
  }

  return (
    <Modal aberto largura={680} onFechar={onFechar} rotulo={t ? `Editar ${t.nome}` : "Novo time"}>
      <EditorCab titulo={t ? `Editar ${t.nome}` : "Novo time"} meta={t ? `${projs.length} projeto(s) neste time` : undefined} />
      <div className="form">
        <div className="campo l4">
          <label htmlFor="etNome">Nome do time</label>
          <input id="etNome" type="text" value={nome} placeholder="Squad Echo" onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo l4">
          <label>Membros</label>
          <span className="dica" style={{ marginBottom: 6 }}>
            Uma pessoa pode estar em mais de um time, o que é o caso dos cargos escassos. O squad de cada projeto sai daqui.
          </span>
          {Object.entries(porPapel).map(([pp, lista]) => (
            <div key={pp} style={{ marginBottom: 9 }}>
              <div className="meta" style={{ marginBottom: 5 }}>{pp}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {lista.map((p) => {
                  const on = membros.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="slot nome"
                      aria-pressed={on}
                      onClick={() => setMembros(on ? membros.filter((x) => x !== p.id) : [...membros, p.id])}
                    >
                      {primeiro(p.nome)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {faltando.length ? (
          <div className="l4">
            <Aviso titulo={`Sem cobertura para ${faltando.join(", ")}`}>
              As cerimônias que exigem esses cargos ficarão sem quórum nos projetos deste time.
            </Aviso>
          </div>
        ) : null}
      </div>
      <EditorPe erro={acao.erro} acao={t ? "Salvar time" : "Criar time"} ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}

// ─────────────────────── cargos ───────────────────────

function AbaCargos({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const k = resultadoDe(sim.semanas[0], cenario).kpi
  const avisar = useCadencia((s) => s.avisar)
  const papeis = papeisDe(config)
  const [editando, setEditando] = useState<{ cargo: string | null } | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const exclusao = useAcao()
  const usoAlvo = excluindo ? cargoEmUso(mundo, excluindo) : null

  return (
    <section className="sec">
      <SecCab
        titulo="Cargos"
        apoio={
          <>
            o cargo define as restrições de agenda de quem o ocupa
            <button type="button" className="btn" onClick={() => setEditando({ cargo: null })}>
              <IconeMais />
              Novo cargo
            </button>
          </>
        }
      />
      <table>
        <thead>
          <tr>
            <th>Cargo</th>
            <th className="n">Pessoas</th>
            <th>Quem ocupa</th>
            <th className="n">Alvo</th>
            <th className="n">Teto/sem</th>
            <th className="n">Máx h/mês</th>
            <th className="n">Cerimônias do playbook</th>
            <th className="n">Carga média</th>
            <th>Situação</th>
            <th style={{ width: 130 }} />
          </tr>
        </thead>
        <tbody>
          {papeis.map((pp) => {
            const c = premDe(config, pp)
            const ps = pessoasDo(mundo, pp)
            const uso = cargoEmUso(mundo, pp)
            const kps = k.porPessoa.filter((x) => x.papel === pp)
            const carga = kps.length ? kps.reduce((s, x) => s + x.horas, 0) / kps.length : 0
            const ocup = c.teto > 0 ? (carga / c.teto) * 100 : 0
            const sit = !ps.length ? (
              <Selo tom="ruim">sem ninguém</Selo>
            ) : kps.some((x) => x.acimaLimite) ? (
              <Selo tom="ruim">acima do limite</Selo>
            ) : kps.some((x) => x.acimaTeto) ? (
              <Selo tom="aviso">com concessão</Selo>
            ) : (
              <Selo tom={ocup > 85 ? "acento" : "ok"}>{n0(ocup)}% do teto</Selo>
            )
            return (
              <tr key={pp}>
                <td><b>{pp}</b></td>
                <td className="n">{ps.length}</td>
                <td className="meta">{ps.map((x) => primeiro(x.nome)).join(", ") || "ninguém alocado"}</td>
                <td className="n">{c.produtivoMin}%</td>
                <td className="n">{n1(c.teto)}h</td>
                <td className="n">{n1(c.maxHorasMes)}h</td>
                <td className="n">{uso.cerimonias}</td>
                <td className="n">{n1(carga)}h</td>
                <td>{sit}</td>
                <td>
                  <span className="acoes">
                    <button type="button" className="mini-btn" onClick={() => setEditando({ cargo: pp })}>renomear</button>
                    <button
                      type="button"
                      className="mini-btn perigo"
                      onClick={() => {
                        if (uso.pessoas) {
                          avisar(`${pp} tem ${uso.pessoas} pessoa(s), mova antes de excluir`, 3000)
                          return
                        }
                        setExcluindo(pp)
                      }}
                    >
                      excluir
                    </button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="nota" style={{ marginTop: 10 }}>
        Os valores de cada cargo, alvo, tolerância e os quatro tetos de tempo, são editados em{" "}
        <b>Premissas, aba Por cargo</b>. Aqui ficam o cadastro, o nome e quem ocupa.
        <Link href="/premissas?aba=cargo" className="mini-btn" style={{ marginLeft: 6 }}>
          Abrir premissas por cargo
        </Link>
      </p>

      {editando ? <EditorCargo ctx={ctx} cargo={editando.cargo} onFechar={() => setEditando(null)} /> : null}

      <Confirmacao
        aberto={excluindo !== null}
        titulo={`Excluir o cargo ${excluindo ?? ""}?`}
        acao="Excluir cargo"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={
          usoAlvo?.cerimonias
            ? `${usoAlvo.cerimonias} tipo(s) de cerimônia do playbook exigem ${excluindo}. O cargo sai delas e das cadeiras dos projetos.`
            : `Nenhuma cerimônia do playbook depende de ${excluindo}.`
        }
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() =>
          excluindo &&
          exclusao.executar(() => excluirCargo(indices.cargos[excluindo]), "cargo excluído", () => setExcluindo(null))
        }
      />
    </section>
  )
}

function EditorCargo({ ctx, cargo, onFechar }: { ctx: Contexto; cargo: string | null; onFechar: () => void }) {
  const { mundo, config, indices } = ctx
  const papeis = papeisDe(config)
  const [nome, setNome] = useState(cargo ?? "")
  const [base, setBase] = useState(papeis[0])
  const acao = useAcao()
  const uso = cargo ? cargoEmUso(mundo, cargo) : null

  const salvar = () => {
    const n = nome.trim()
    if (!n) return acao.setErro("Informe o nome do cargo.")
    if (cargo && n === cargo) return onFechar()
    if (papeis.includes(n)) return acao.setErro("Já existe um cargo com esse nome.")
    acao.executar(
      () => salvarCargo({ id: cargo ? indices.cargos[cargo] : null, nome: n, copiarDe: cargo ? null : indices.cargos[base] }),
      cargo ? "cargo renomeado em pessoas, squads e playbook" : "cargo criado",
      onFechar
    )
  }

  return (
    <Modal aberto largura={520} onFechar={onFechar} rotulo={cargo ? `Renomear ${cargo}` : "Novo cargo"}>
      <EditorCab
        titulo={cargo ? `Renomear ${cargo}` : "Novo cargo"}
        meta={uso ? `${uso.pessoas} pessoa(s) e ${uso.cerimonias} cerimônia(s) acompanham a mudança` : undefined}
      />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="ecNome">Nome do cargo</label>
          <input id="ecNome" type="text" value={nome} placeholder="Consultor de Implantação" onChange={(e) => setNome(e.target.value)} />
        </div>
        {cargo ? null : (
          <div className="campo l2">
            <label htmlFor="ecBase">Copiar premissas de</label>
            <select id="ecBase" value={base} onChange={(e) => setBase(e.target.value)}>
              {papeis.map((pp) => (
                <option key={pp} value={pp}>{pp}</option>
              ))}
            </select>
            <span className="dica">
              Os valores podem ser ajustados em Premissas. O cargo só gera demanda quando aparecer no playbook de alguma
              cerimônia.
            </span>
          </div>
        )}
      </div>
      <EditorPe erro={acao.erro} acao={cargo ? "Renomear" : "Criar cargo"} ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}
