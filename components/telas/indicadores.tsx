"use client"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import { GraficoBarras } from "@/components/cadencia/grafico-barras"
import { delta, Faixa, Indicador, SecCab, Selo, Trilha, tomOcupacao, type Tom } from "@/components/cadencia/primitivas"
import { analiseCapacidade, cargosDoTime, membrosDoTime, papeisNecessarios, premDe, projetosDoTime } from "@/lib/dominio"
import { n0, n1, pc } from "@/lib/formato"
import { baixarCsv, relatorioMensal } from "@/lib/relatorios/mensal"

import { CUSTO_HORA, papeisDe, resultadoDe } from "./comum"

export function TelaIndicadores() {
  return <ComDados>{(ctx) => <Indicadores {...ctx} />}</ComDados>
}

// Porte de telaIndicadores() do protótipo (§7.7), com o quadro de pessoal e a capacidade por time.
function Indicadores(ctx: Contexto) {
  const { mundo, config, simulacao: sim, cenario } = ctx
  const mes = sim.mes[cenario]
  const mb = sim.mes.base
  const mo = sim.mes.otm
  const k = resultadoDe(sim.semanas[0], cenario).kpi
  const cmp = cenario === "otm"
  const nP = mundo.pessoas.length

  const porPapel = papeisDe(config)
    .map((pp) => {
      const ps = k.porPessoa.filter((x) => x.papel === pp)
      if (!ps.length) return null
      return {
        pp,
        n: ps.length,
        rMes: ps.reduce((s, x) => s + mes.porPessoa[x.id].reunioes, 0),
        hMes: ps.reduce((s, x) => s + mes.porPessoa[x.id].horas, 0),
        taxa: ps.reduce((s, x) => s + x.taxa, 0) / ps.length,
        teto: ps[0].tetoPct,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const capacidade = analiseCapacidade(mundo, config, config.horizonte)

  return (
    <>
      <Faixa>
        <Indicador rotulo="Reuniões no mês" valor={String(mes.reunioes)} delta={cmp ? delta(mb.reunioes, mo.reunioes, true, "") : undefined} />
        <Indicador rotulo="Pessoa-hora no mês" valor={`${n0(mes.horas)}h`} delta={cmp ? delta(mb.horas, mo.horas, true, "h") : undefined} />
        <Indicador rotulo="Reuniões por pessoa" valor={n1(mes.porPessoa.reduce((s, x) => s + x.reunioes, 0) / nP)} />
        <Indicador rotulo="Horas por pessoa" valor={`${n1(mes.horas / nP)}h`} />
        <Indicador
          rotulo="Tempo produtivo médio"
          valor={pc(mes.produtivo)}
          tom={mes.produtivo >= k.alvoMedio ? "bom" : "ruim"}
          delta={cmp ? delta(mb.produtivo, mo.produtivo, false, " p.p.") : undefined}
        />
        <Indicador rotulo="Custo de cerimônia" valor={`R$ ${n0((mes.horas * CUSTO_HORA) / 1000)}k`} />
      </Faixa>

      <div className="colunas c-2 sec">
        <section>
          <SecCab titulo="Cerimônias por semana" apoio={`horizonte de ${config.horizonte} semanas`} />
          <GraficoBarras
            dados={sim.semanas.map((w, i) => {
              const n = resultadoDe(w, cenario).alocadas.length
              return { l: `S${i + 1}`, v: n, t: String(n) }
            })}
            valores
            dicas
            eixoY={false}
            alt="cerimônias por semana"
          />
        </section>
        <section>
          <SecCab titulo="Pessoa-hora por semana" apoio="carga total do time" />
          <GraficoBarras
            dados={sim.semanas.map((w, i) => {
              const h = resultadoDe(w, cenario).kpi.horasTotais
              return { l: `S${i + 1}`, v: h, t: `${n0(h)}h`, cor: "var(--chart-2)" }
            })}
            valores
            dicas
            eixoY={false}
            alt="horas por semana"
          />
        </section>
      </div>

      <section className="sec">
        <SecCab titulo="Quadro de pessoal" apoio="precisamos de mais gente, e de qual cargo" />
        <p className="nota" style={{ marginBottom: 12 }}>
          A demanda vem do playbook e conta inclusive as cerimônias que hoje não acontecem por falta de quórum,
          porque justamente essas são o sintoma da falta de gente. A capacidade é o teto de reunião do cargo
          multiplicado por quantas pessoas o ocupam.
        </p>
        <div className="larga">
          <table style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Cargo</th>
                <th className="n">Pessoas</th>
                <th className="n">Teto por pessoa</th>
                <th className="n">Capacidade</th>
                <th className="n">Demanda</th>
                <th className="n">Sem quórum</th>
                <th style={{ width: 150 }}>Ocupação</th>
                <th className="n">Saldo</th>
                <th>Situação</th>
                <th>Recomendação</th>
              </tr>
            </thead>
            <tbody>
              {capacidade.map((r) => {
                const tom: Tom =
                  r.situacao === "falta gente" || r.situacao === "sem ninguém"
                    ? "ruim"
                    : r.situacao === "no limite"
                      ? "aviso"
                      : r.situacao === "folga"
                        ? "neutro"
                        : "ok"
                const ocup = Number.isFinite(r.ocupacao) ? r.ocupacao : 200
                return (
                  <tr key={r.papel}>
                    <td><b>{r.papel}</b></td>
                    <td className="n">{r.pessoas}</td>
                    <td className="n">{n1(r.teto)}h</td>
                    <td className="n">{n1(r.capacidade)}h</td>
                    <td className="n">{n1(r.demanda)}h</td>
                    <td className="n" style={{ color: r.semQuorum > 0 ? "var(--bad)" : "var(--ink)" }}>
                      {r.semQuorum > 0 ? `${n1(r.semQuorum)}h` : "0,0h"}
                    </td>
                    <td>
                      <Trilha valor={Math.min(ocup, 100)} max={100} limite={100} tom={tomOcupacao(ocup, 88)} />
                      <div className="meta">
                        {Number.isFinite(r.ocupacao) ? `${n0(r.ocupacao)}% da capacidade` : "sem capacidade"}
                      </div>
                    </td>
                    <td className="n" style={{ color: r.saldoFte < -0.25 ? "var(--bad)" : "var(--ink)" }}>
                      {r.saldoFte > 0 ? "+" : ""}
                      {n1(r.saldoFte)} FTE
                    </td>
                    <td><Selo tom={tom}>{r.situacao}</Selo></td>
                    <td className="meta">{r.acao}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sec">
        <SecCab titulo="Capacidade por time" apoio="carga contra o teto somado dos membros" />
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th className="n">Pessoas</th>
              <th className="n">Projetos</th>
              <th className="n">Capacidade</th>
              <th className="n">Carga</th>
              <th style={{ width: 160 }}>Ocupação</th>
              <th>Cargos ausentes</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {mundo.times.map((t) => {
              const membros = membrosDoTime(mundo, t.id)
              const projs = projetosDoTime(mundo, t.id)
              const capac = membros.reduce((s, id) => s + premDe(config, mundo.pessoas[id].papel).teto, 0)
              const carga = membros.reduce((s, id) => s + k.porPessoa[id].horas, 0)
              const ocup = capac > 0 ? (carga / capac) * 100 : 0
              const comp = cargosDoTime(mundo, t.id)
              const faltando = [...new Set(projs.flatMap((p) => papeisNecessarios(mundo, p.fase)))].filter((pp) => !comp[pp])
              const leitura = faltando.length ? (
                <Selo tom="ruim">cobertura incompleta</Selo>
              ) : ocup > 88 ? (
                <Selo tom="aviso">sem folga</Selo>
              ) : ocup < 45 ? (
                <Selo tom="neutro">cabe mais projeto</Selo>
              ) : (
                <Selo tom="ok">equilibrado</Selo>
              )
              return (
                <tr key={t.id}>
                  <td><b>{t.nome}</b></td>
                  <td className="n">{membros.length}</td>
                  <td className="n">{projs.length}</td>
                  <td className="n">{n1(capac)}h</td>
                  <td className="n">{n1(carga)}h</td>
                  <td>
                    <Trilha valor={Math.min(ocup, 100)} max={100} limite={100} tom={tomOcupacao(ocup, 88)} />
                    <div className="meta">{n0(ocup)}%</div>
                  </td>
                  <td>{faltando.length ? faltando.join(", ") : <span className="meta">nenhum</span>}</td>
                  <td>{leitura}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="colunas c-2 sec">
        <section>
          <SecCab titulo="Taxa de reunião por cargo" apoio="tracejado marca o teto do cargo" />
          <GraficoBarras
            dados={porPapel.map((x) => ({
              l: x.pp.split(" ")[0].slice(0, 8),
              v: x.taxa,
              ref: x.teto,
              t: `${n1(x.taxa)}%`,
              cor: x.taxa > x.teto ? "var(--destructive)" : "var(--chart-1)",
            }))}
            valores
            dicas
            alt="taxa por cargo"
          />
        </section>
        <section>
          <SecCab
            titulo="Consolidado mensal por cargo"
            apoio={
              <>
                {cmp ? "cenário otimizado" : "agenda atual"}
                <button type="button" className="mini-btn" onClick={() => baixarCsv(relatorioMensal(ctx))}>
                  Exportar relatório mensal
                </button>
              </>
            }
          />
          <table>
            <thead>
              <tr>
                <th>Cargo</th>
                <th className="n">Pessoas</th>
                <th className="n">Reuniões</th>
                <th className="n">Horas</th>
                <th className="n">Média por pessoa</th>
                <th className="n">Taxa</th>
                <th className="n">Teto</th>
              </tr>
            </thead>
            <tbody>
              {porPapel.map((x) => (
                <tr key={x.pp}>
                  <td>{x.pp}</td>
                  <td className="n">{x.n}</td>
                  <td className="n">{x.rMes}</td>
                  <td className="n">{n1(x.hMes)}</td>
                  <td className="n">{n1(x.hMes / x.n)}h</td>
                  <td className="n" style={{ color: x.taxa > x.teto ? "var(--bad)" : "var(--ink)" }}>
                    {n1(x.taxa)}%
                  </td>
                  <td className="n calc">{x.teto}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota" style={{ marginTop: 9 }}>
            Custo estimado a R$ {CUSTO_HORA} por hora-pessoa. As reuniões mensais são projetadas a partir do horizonte
            simulado. O relatório exporta reuniões e horas por pessoa, cargo, projeto e etapa.
          </p>
        </section>
      </div>
    </>
  )
}
