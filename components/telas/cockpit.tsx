"use client"

import { Fragment } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import { GraficoBarras } from "@/components/cadencia/grafico-barras"
import { delta, Faixa, Indicador, SecCab, Trilha } from "@/components/cadencia/primitivas"
import { hueCer } from "@/lib/cores"
import { premDe } from "@/lib/dominio"
import { DIAS_LB, n0, n1, pc } from "@/lib/formato"

import { papeisDe, pessoaHora, resultadoDe } from "./comum"

export function TelaCockpit() {
  return <ComDados>{(ctx) => <Cockpit {...ctx} />}</ComDados>
}

// Porte de telaCockpit() do protótipo (§7.1).
function Cockpit({ mundo, config, simulacao: sim, cenario }: Contexto) {
  const w = sim.semanas[0]
  const b = w.base.kpi
  const o = w.otm.kpi
  const cmp = cenario === "otm"
  const k = cmp ? o : b
  const r = resultadoDe(w, cenario)
  const adiadas = cmp ? w.otm.adiadas.length : w.base.naoAlocadas.length
  const cobertura = cmp ? w.otm.cobertura.total : (100 * w.base.alocadas.length) / w.demanda.length
  const mes = sim.mes[cenario]
  const nP = mundo.pessoas.length
  const fteObrig = Object.values(w.otm.deficit).reduce((s, x) => s + x.fteObrig, 0)
  const gargalo: Record<string, number> = {}
  w.otm.adiadas.forEach((a) => {
    if (a.obrig) a.papeis.forEach((pp) => (gargalo[pp] = (gargalo[pp] || 0) + 1))
  })
  const gargaloTop = Object.entries(gargalo).sort((a, c) => c[1] - a[1])[0]

  const porPapel = papeisDe(config)
    .map((pp) => {
      const ps = k.porPessoa.filter((x) => x.papel === pp)
      if (!ps.length) return null
      const media = ps.reduce((s, x) => s + x.taxa, 0) / ps.length
      return { pp, media, teto: ps[0].tetoPct, n: ps.length }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, c) => c.media / c.teto - a.media / a.teto)

  const porFase: Record<string, number> = {}
  mundo.projetos.forEach((p) => (porFase[p.fase] = (porFase[p.fase] || 0) + 1))
  const porTipo: Record<string, number> = {}
  r.alocadas.forEach((ev) => (porTipo[ev.tipo] = (porTipo[ev.tipo] || 0) + pessoaHora(ev)))

  return (
    <>
      <Faixa>
        <Indicador
          rotulo="Tempo produtivo"
          valor={n1(k.produtivoMedio)}
          un="%"
          tom={k.produtivoMedio >= k.alvoMedio ? "bom" : "ruim"}
          delta={cmp ? delta(b.produtivoMedio, o.produtivoMedio, false, " p.p.") : undefined}
          contexto={`alvo médio de ${pc(k.alvoMedio)}`}
        />
        <Indicador
          rotulo="Aderência ao alvo"
          valor={n1(k.aderencia)}
          un="%"
          tom={k.aderencia >= 95 ? "bom" : k.aderencia < 70 ? "ruim" : ""}
          delta={cmp ? delta(b.aderencia, o.aderencia, false, " p.p.") : undefined}
          contexto={`${k.porPessoa.filter((x) => x.noAlvo).length} de ${nP} pessoas`}
        />
        <Indicador
          rotulo="Cobertura do playbook"
          valor={n1(cobertura)}
          un="%"
          tom={cobertura >= 95 ? "bom" : "ruim"}
          contexto={`${r.alocadas.length} de ${w.demanda.length} cerimônias`}
        />
        <Indicador
          rotulo="Reunião por pessoa"
          valor={n1(mes.horas / nP)}
          un="h/mês"
          delta={cmp ? delta(sim.mes.base.horas / nP, sim.mes.otm.horas / nP, true, "h") : undefined}
          contexto={`${n1(mes.porPessoa.reduce((s, x) => s + x.reunioes, 0) / nP)} reuniões por mês`}
        />
        <Indicador
          rotulo="Déficit de capacidade"
          valor={cmp ? n1(fteObrig) : "n/d"}
          un={cmp ? "FTE" : ""}
          tom={cmp ? (fteObrig > 0.5 ? "ruim" : "bom") : ""}
          contexto={
            cmp
              ? fteObrig > 0
                ? `falta gente em ${gargaloTop ? gargaloTop[0] : "algum cargo"}`
                : "a demanda cabe no time atual"
              : "a agenda vigente não segue política"
          }
        />
        <Indicador
          rotulo="Cerimônias adiadas"
          valor={String(adiadas)}
          tom={adiadas ? "ruim" : "bom"}
          contexto={adiadas ? "sem janela viável" : "nenhuma pendência"}
        />
      </Faixa>

      <div className="colunas c-ab sec">
        <section>
          <SecCab titulo="Carga por pessoa e dia" apoio="horas, com intensidade relativa ao máximo diário do cargo" />
          <div className="calor">
            <div />
            {DIAS_LB.map((d) => (
              <div key={d} className="ch">
                {d.slice(0, 3)}
              </div>
            ))}
            {mundo.pessoas.map((p) => {
              const kp = k.porPessoa[p.id]
              const lim = premDe(config, p.papel).maxHorasDia
              return (
                <Fragment key={p.id}>
                  <div className="cn" data-dica={`${p.nome}, ${p.papel}. Teto semanal de ${n1(kp.teto)}h.`}>
                    {p.nome}
                  </div>
                  {[0, 1, 2, 3, 4].map((d) => {
                    let h = 0
                    let c = 0
                    r.alocadas.forEach((ev) => {
                      if (ev.dia === d && ev.participantes.includes(p.id)) {
                        h += ev.dur / 60
                        c++
                      }
                    })
                    const int = Math.min(h / Math.max(lim, 1), 1)
                    const fundo =
                      h === 0 ? "var(--muted)" : `color-mix(in oklab, var(--primary) ${Math.round(12 + int * 78)}%, var(--card))`
                    // texto escuro na escala toda: o claro sobre o azul da marca não chega a 4,5:1 (D-14)
                    const cor = "var(--foreground)"
                    return (
                      <div
                        key={d}
                        className="cel"
                        style={{ background: fundo, color: cor }}
                        data-dica={`${p.nome}, ${DIAS_LB[d]}: ${c} cerimônias, ${n1(h)}h. Máximo do cargo: ${n1(lim)}h.`}
                      >
                        {h ? n1(h) : ""}
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </section>
        <section>
          <SecCab titulo="Ocupação do teto por cargo" apoio={cmp ? "cenário otimizado" : "agenda vigente"} />
          <table>
            <tbody>
              {porPapel.map((x) => (
                <tr key={x.pp}>
                  <td style={{ width: "44%" }}>
                    {x.pp}
                    <div className="meta">
                      {x.n} pessoa(s), teto {x.teto}%
                    </div>
                  </td>
                  <td>
                    <Trilha
                      valor={x.media}
                      max={35}
                      limite={x.teto}
                      tom={x.media > x.teto ? "ruim" : x.media > x.teto * 0.85 ? "" : "ok"}
                    />
                  </td>
                  <td className="n" style={{ width: 56 }}>
                    {pc(x.media)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota" style={{ marginTop: 8 }}>
            O traço vertical marca o teto definido nas premissas de cada cargo.
          </p>
        </section>
      </div>

      <div className="colunas c-2 sec">
        <section>
          <SecCab titulo="Portfólio por fase" apoio={`${mundo.projetos.length} projetos ativos`} />
          <GraficoBarras
            dados={Object.keys(mundo.etapas).map((f) => ({ l: mundo.etapas[f].rotulo, v: porFase[f] || 0 }))}
            valores
            dicas
            eixoY={false}
            alt="projetos por fase"
          />
        </section>
        <section>
          <SecCab titulo="Pessoa-hora por tipo de cerimônia" apoio="semana 1" />
          <GraficoBarras
            dados={Object.entries(porTipo)
              .sort((a, c) => c[1] - a[1])
              .map(([t, v]) => ({ l: t.split(" ")[0], v, t: `${n0(v)}h`, cor: `oklch(0.55 0.10 ${hueCer(t)})` }))}
            valores
            dicas
            eixoY={false}
            alt="horas por tipo"
          />
        </section>
      </div>
    </>
  )
}
