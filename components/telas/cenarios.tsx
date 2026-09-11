"use client"

import { useCallback, useEffect, useState } from "react"

import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import { SecCab, Selo, VazioTela, type Tom } from "@/components/cadencia/primitivas"
import {
  diffComVigente,
  excluirCenario,
  listarCenarios,
  publicarCenario,
  salvarCenario,
} from "@/lib/dados/cenarios"
import type { CenarioLista, DiffCenario, ResumoCenario } from "@/lib/dados/tipos-acoes"
import { PERFIS, type Config, type PerfilId } from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { n1, pc } from "@/lib/formato"

const TOM_STATUS: Record<CenarioLista["status"], Tom> = {
  publicado: "ok",
  simulado: "neutro",
  rascunho: "neutro",
  arquivado: "neutro",
}
const ROTULO_STATUS: Record<CenarioLista["status"], string> = {
  publicado: "plano vigente",
  simulado: "simulado",
  rascunho: "rascunho",
  arquivado: "arquivado",
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/** Modal de salvar a execução atual como cenário (§10, simulação de cenário). */
export function SalvarCenario({
  aberto,
  config,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  config: Config
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(`${PERFIS[config.perfil].rotulo}, ${config.horizonte} semanas`)
  const acao = useAcao()
  if (!aberto) return null
  return (
    <Modal aberto largura={520} onFechar={onFechar} rotulo="Salvar cenário">
      <EditorCab titulo="Salvar como cenário" meta={`perfil ${PERFIS[config.perfil].rotulo}, ${config.horizonte} semanas`} />
      <div className="form">
        <div className="campo l4">
          <label htmlFor="cnNome">Nome do cenário</label>
          <input id="cnNome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
          <span className="dica">
            O cenário guarda as premissas de agora e todas as ocorrências do horizonte, com a justificativa de cada
            horário. Depois dá para comparar com outros e publicar como plano vigente.
          </span>
        </div>
      </div>
      <EditorPe
        erro={acao.erro}
        acao="Salvar cenário"
        ocupado={acao.pendente}
        onCancelar={onFechar}
        onAcao={() =>
          acao.executar(
            () =>
              salvarCenario({
                nome,
                perfil: config.perfil as PerfilId,
                horizonte: config.horizonte,
                rebalancear: config.rebalancear,
              }),
            "cenário salvo",
            () => {
              onFechar()
              onSalvo()
            }
          )
        }
      />
    </Modal>
  )
}

type Metrica = {
  rotulo: string
  valor: (r: ResumoCenario) => number | null
  texto: (r: ResumoCenario) => string
  melhor: "maior" | "menor" | null
}

const METRICAS: Metrica[] = [
  { rotulo: "Cobertura do playbook", valor: (r) => r.cobertura, texto: (r) => pc(r.cobertura), melhor: "maior" },
  { rotulo: "Obrigatórias atendidas", valor: (r) => r.obrigatoria, texto: (r) => pc(r.obrigatoria), melhor: "maior" },
  { rotulo: "SLA de etapa", valor: (r) => r.sla, texto: (r) => pc(r.sla), melhor: "maior" },
  { rotulo: "Aderência ao alvo", valor: (r) => r.aderencia, texto: (r) => pc(r.aderencia), melhor: "maior" },
  { rotulo: "Tempo produtivo médio", valor: (r) => r.produtivo, texto: (r) => pc(r.produtivo), melhor: "maior" },
  { rotulo: "Déficit estrutural", valor: (r) => r.deficitFte, texto: (r) => `${n1(r.deficitFte)} FTE`, melhor: "menor" },
  { rotulo: "Cerimônias adiadas", valor: (r) => r.adiadas, texto: (r) => String(r.adiadas), melhor: "menor" },
  { rotulo: "Premissas cedidas", valor: (r) => r.concessoes, texto: (r) => String(r.concessoes), melhor: "menor" },
  { rotulo: "Trocas de cadeira", valor: (r) => r.trocas, texto: (r) => String(r.trocas), melhor: null },
  { rotulo: "Pessoa-hora no mês", valor: (r) => r.horasMes, texto: (r) => `${n1(r.horasMes)}h`, melhor: "menor" },
  { rotulo: "Reuniões no mês", valor: (r) => r.reunioesMes, texto: (r) => String(r.reunioesMes), melhor: "menor" },
  {
    rotulo: "Estabilidade contra o vigente",
    valor: (r) => r.estabilidade,
    texto: (r) => (r.estabilidade === null ? "sem vigente" : pc(r.estabilidade)),
    melhor: "maior",
  },
  {
    rotulo: "Violações de regra rígida",
    valor: (r) => r.violacoes ?? 0,
    texto: (r) => String(r.violacoes ?? 0),
    melhor: "menor",
  },
  { rotulo: "Tempo do solver", valor: (r) => r.solverMs, texto: (r) => `${r.solverMs} ms`, melhor: null },
]

/** Achata as premissas em caminho → valor, para mostrar só o que difere entre cenários. */
function achatar(v: unknown, prefixo = "", saida: Record<string, string> = {}) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    Object.entries(v as Record<string, unknown>).forEach(([k, x]) => achatar(x, prefixo ? `${prefixo} · ${k}` : k, saida))
  } else saida[prefixo] = Array.isArray(v) ? v.join(", ") : String(v)
  return saida
}

export function AbaCenarios() {
  const [lista, setLista] = useState<CenarioLista[] | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [publicando, setPublicando] = useState<CenarioLista | null>(null)
  const [diff, setDiff] = useState<DiffCenario | null>(null)
  const [excluindo, setExcluindo] = useState<CenarioLista | null>(null)
  const publicacao = useAcao()
  const exclusao = useAcao()

  const carregar = useCallback(async () => {
    const r = await listarCenarios()
    if (r.ok) {
      setLista(r.dados)
      setErroLista(null)
    } else setErroLista(r.erro)
  }, [])

  useEffect(() => {
    let vivo = true
    listarCenarios().then((r) => {
      if (!vivo) return
      if (r.ok) setLista(r.dados)
      else setErroLista(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [])

  const abrirPublicacao = async (c: CenarioLista) => {
    setPublicando(c)
    setDiff(null)
    const r = await diffComVigente(c.id)
    if (r.ok) setDiff(r.dados)
  }

  if (erroLista)
    return <VazioTela titulo="Não foi possível listar os cenários">{erroLista}</VazioTela>
  if (!lista)
    return (
      <div style={{ display: "grid", gap: 9 }}>
        {[70, 55, 80, 62].map((l, i) => (
          <div key={i} className="esqueleto" style={{ width: `${l}%` }} />
        ))}
      </div>
    )
  if (!lista.length)
    return (
      <VazioTela titulo="Nenhum cenário salvo">
        Use Salvar como cenário no painel ao lado para guardar esta execução. Com dois ou mais, dá para comparar lado
        a lado e publicar o melhor como plano vigente.
      </VazioTela>
    )

  const comparados = lista.filter((c) => marcados.includes(c.id) && c.resumo)
  const planos = comparados.map((c) => achatar(c.premissas ?? {}))
  const diferentes = [...new Set(planos.flatMap((p) => Object.keys(p)))].filter(
    (k) => new Set(planos.map((p) => p[k])).size > 1
  )

  return (
    <>
      <div className="larga">
        <table style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              <th>Cenário</th>
              <th>Situação</th>
              <th>Perfil</th>
              <th className="n">Horizonte</th>
              <th className="n">Cobertura</th>
              <th className="n">SLA</th>
              <th className="n">Aderência</th>
              <th className="n">Déficit</th>
              <th className="n">Estabilidade</th>
              <th>Salvo em</th>
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const r = c.resumo
              const on = marcados.includes(c.id)
              return (
                <tr key={c.id}>
                  <td>
                    <button
                      type="button"
                      className="opcao"
                      style={{ padding: 2 }}
                      aria-pressed={on}
                      aria-label={`Comparar ${c.nome}`}
                      onClick={() => setMarcados(on ? marcados.filter((x) => x !== c.id) : [...marcados, c.id].slice(-3))}
                    >
                      <i />
                    </button>
                  </td>
                  <td><b>{c.nome}</b></td>
                  <td><Selo tom={TOM_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Selo></td>
                  <td className="meta">{PERFIS[c.perfil as PerfilId]?.rotulo ?? c.perfil}</td>
                  <td className="n">{c.horizonte} sem</td>
                  <td className="n">{r ? pc(r.cobertura) : "n/d"}</td>
                  <td className="n">{r ? pc(r.sla) : "n/d"}</td>
                  <td className="n">{r ? pc(r.aderencia) : "n/d"}</td>
                  <td className="n">{r ? `${n1(r.deficitFte)} FTE` : "n/d"}</td>
                  <td className="n">{r?.estabilidade === null || !r ? "n/d" : pc(r.estabilidade)}</td>
                  <td className="meta">{dataHora(c.criadoEm)}</td>
                  <td>
                    <span className="acoes">
                      {c.status !== "publicado" ? (
                        <>
                          <button type="button" className="mini-btn" onClick={() => void abrirPublicacao(c)}>
                            publicar
                          </button>
                          <button type="button" className="mini-btn perigo" onClick={() => setExcluindo(c)}>
                            excluir
                          </button>
                        </>
                      ) : (
                        <span className="meta">desde {c.publicadoEm ? dataHora(c.publicadoEm) : ""}</span>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="nota" style={{ margin: "9px 0 22px" }}>
        Marque até três cenários para comparar lado a lado. Publicar torna o cenário o plano vigente: o próximo
        replanejamento passa a pagar um custo para mover cada cerimônia do lugar, o que segura a agenda estável.
      </p>

      {comparados.length >= 2 ? (
        <section className="sec">
          <SecCab titulo="Comparação lado a lado" apoio={`${comparados.length} cenários, destaque no melhor valor`} />
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                {comparados.map((c) => (
                  <th key={c.id} className="n">{c.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICAS.map((m) => {
                const valores = comparados.map((c) => m.valor(c.resumo as ResumoCenario))
                const validos = valores.filter((v): v is number => v !== null)
                const alvo = m.melhor === "maior" ? Math.max(...validos) : m.melhor === "menor" ? Math.min(...validos) : null
                const empate = validos.every((v) => v === validos[0])
                return (
                  <tr key={m.rotulo}>
                    <td>{m.rotulo}</td>
                    {comparados.map((c, i) => (
                      <td
                        key={c.id}
                        className="n"
                        style={{ color: !empate && alvo !== null && valores[i] === alvo ? "var(--ok)" : undefined, fontWeight: !empate && valores[i] === alvo ? 500 : undefined }}
                      >
                        {m.texto(c.resumo as ResumoCenario)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {diferentes.length ? (
            <>
              <SecCab titulo="Premissas que diferem" apoio={`${diferentes.length} campo(s)`} style={{ marginTop: 20 }} />
              <div className="rolagem" style={{ maxHeight: 320 }}>
                <table>
                  <tbody>
                    {diferentes.slice(0, 40).map((k) => (
                      <tr key={k}>
                        <td className="meta">{k}</td>
                        {planos.map((p, i) => (
                          <td key={i} className="n">{p[k] ?? "n/d"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="nota" style={{ marginTop: 10 }}>As premissas são iguais; a diferença vem do mundo na hora de cada execução.</p>
          )}
        </section>
      ) : null}

      <Confirmacao
        aberto={publicando !== null}
        titulo={`Publicar ${publicando?.nome ?? ""}?`}
        acao="Publicar como plano vigente"
        perigo={false}
        erro={publicacao.erro}
        ocupado={publicacao.pendente}
        texto={
          !diff
            ? "Calculando o que muda na agenda de cada pessoa."
            : diff.semVigente
              ? "Ainda não há plano vigente. Este cenário passa a ser a referência de estabilidade dos próximos replanejamentos."
              : `Contra o plano vigente: ${diff.novas} cerimônia(s) novas, ${diff.movidas} movidas, ${diff.canceladas} canceladas e ${diff.mantidas} mantidas no mesmo horário.`
        }
        extra={
          diff && !diff.semVigente && diff.porPessoa.length ? (
            <div className="rolagem" style={{ maxHeight: 220, marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th className="n">Novas</th>
                    <th className="n">Movidas</th>
                    <th className="n">Canceladas</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.porPessoa.slice(0, 20).map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td className="n">{p.novas}</td>
                      <td className="n">{p.movidas}</td>
                      <td className="n">{p.canceladas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null
        }
        onFechar={() => {
          setPublicando(null)
          publicacao.setErro(null)
        }}
        onConfirmar={() =>
          publicando &&
          publicacao.executar(() => publicarCenario(publicando.id), "plano vigente publicado", () => {
            setPublicando(null)
            void carregar()
          })
        }
      />

      <Confirmacao
        aberto={excluindo !== null}
        titulo={`Excluir ${excluindo?.nome ?? ""}?`}
        acao="Excluir cenário"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={`As ${excluindo?.resumo?.ocorrencias ?? 0} ocorrências, concessões e indicadores salvos com este cenário são apagados. As premissas e o mundo não mudam.`}
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() =>
          excluindo &&
          exclusao.executar(() => excluirCenario(excluindo.id), "cenário excluído", () => {
            setMarcados(marcados.filter((x) => x !== excluindo.id))
            setExcluindo(null)
            void carregar()
          })
        }
      />
    </>
  )
}
