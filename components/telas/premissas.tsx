"use client"

import Link from "next/link"
import { Fragment, useState } from "react"

import { ComDados, type Contexto } from "@/components/cadencia/com-dados"
import { GraficoBarras } from "@/components/cadencia/grafico-barras"
import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import { Abas, Chave, IconeMais, Painel, SecCab, Selo, SeloFase, Trilha, type Tom } from "@/components/cadencia/primitivas"
import {
  definirModificadores,
  definirPesoCliente,
  definirPremissaCargo,
  definirPremissasGerais,
  definirUrgenciaEtapa,
  editarCerimoniaCampo,
  excluirCerimonia,
  removerEtapa,
  restaurarPlaybook,
  restaurarPremissasCargo,
  restaurarPremissasGerais,
  salvarCerimonia,
  salvarEtapa,
} from "@/lib/dados/acoes"
import {
  CUSTO_HORA_PADRAO,
  custoHoraDe,
  etapaDe,
  geralDe,
  medianaProdutos,
  membrosDoTime,
  pesoCliente,
  premDe,
  type ItemPlaybook,
  type PremissasCargoEntrada,
  type PremissasGerais,
} from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useCadencia } from "@/lib/estado/cadencia"
import { persistirAdiado } from "@/lib/estado/persistir"
import { useParametro } from "@/lib/estado/url"
import { hhmm, n0, n1 } from "@/lib/formato"

import { fatorMes, papeisDe, pessoaHora, pessoasDo, resultadoDe } from "./comum"

const ABAS = ["gerais", "cargo", "urgencia", "playbook"] as const
type AbaPremissas = (typeof ABAS)[number]
const CADENCIAS = [1, 2, 3, 4, 6, 8, 12]

type Campo = keyof PremissasCargoEntrada
interface DefCampo {
  k: Campo
  lb: string
  un: string
  min: number
  max: number
  passo: number
  /** o motor guarda em slots de 30 min; a tela mostra em horas */
  esc: number
  dica: string
}

// Doze campos editáveis por cargo (§2.3), com os limites da tela do protótipo.
const CAMPOS: DefCampo[] = [
  { k: "jornada", lb: "Jornada", un: "h/sem", min: 20, max: 44, passo: 1, esc: 1, dica: "jornada contratual semanal" },
  { k: "fatorAusencia", lb: "Ausência", un: "%", min: 0, max: 35, passo: 1, esc: 1, dica: "férias, feriados e treinamentos" },
  { k: "tempoInstitucional", lb: "Institucional", un: "h/sem", min: 0, max: 12, passo: 0.5, esc: 1, dica: "rituais internos da LeverPro" },
  { k: "produtivoMin", lb: "Produtivo", un: "%", min: 40, max: 95, passo: 1, esc: 1, dica: "o que queremos: piso de tempo livre de reunião" },
  { k: "tolerancia", lb: "Tolerância", un: "p.p.", min: 0, max: 20, passo: 1, esc: 1, dica: "quanto o cargo aceita ceder do alvo quando não há alternativa" },
  { k: "maxReunioesDia", lb: "Reuniões", un: "por dia", min: 1, max: 10, passo: 1, esc: 1, dica: "número máximo de reuniões num mesmo dia" },
  { k: "maxHorasDia", lb: "Horas", un: "por dia", min: 0.5, max: 8, passo: 0.5, esc: 1, dica: "tempo máximo de reunião em um dia" },
  { k: "maxHorasSemana", lb: "Horas", un: "por semana", min: 1, max: 30, passo: 0.5, esc: 1, dica: "teto absoluto semanal, vale mesmo que o alvo permitisse mais" },
  { k: "maxHorasMes", lb: "Horas", un: "por mês", min: 4, max: 120, passo: 1, esc: 1, dica: "orçamento mensal acumulado, aplicado pró-rata no horizonte" },
  { k: "duracaoMax", lb: "Reunião", un: "máx. h", min: 0.5, max: 4, passo: 0.5, esc: 2, dica: "maior reunião de que este cargo participa" },
  { k: "blocoFocoMin", lb: "Bloco", un: "mín. h", min: 1, max: 4, passo: 0.5, esc: 2, dica: "duração mínima de trabalho profundo" },
  { k: "focoProt", lb: "Janela", un: "protegida h", min: 0, max: 4, passo: 0.5, esc: 2, dica: "bloco diário sem alocação, no início da jornada" },
]
const GRUPOS: { lb: string; campos: Campo[] }[] = [
  { lb: "Capacidade", campos: ["jornada", "fatorAusencia", "tempoInstitucional"] },
  { lb: "Alvo de tempo", campos: ["produtivoMin", "tolerancia"] },
  { lb: "Tetos de reunião", campos: ["maxReunioesDia", "maxHorasDia", "maxHorasSemana", "maxHorasMes"] },
  { lb: "Duração e foco", campos: ["duracaoMax", "blocoFocoMin", "focoProt"] },
]
const campoDe = (k: Campo) => CAMPOS.find((c) => c.k === k) as DefCampo

export function TelaPremissas() {
  return <ComDados>{(ctx) => <Premissas {...ctx} />}</ComDados>
}

/** Célula numérica em linha: limita ao digitar e normaliza ao sair do campo. */
function Celula({
  valor,
  min,
  max,
  passo,
  rotulo,
  onValor,
}: {
  valor: number
  min: number
  max: number
  passo: number
  rotulo: string
  onValor: (v: number) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  return (
    <input
      className="cel-edit"
      type="number"
      min={min}
      max={max}
      step={passo}
      value={texto ?? String(valor)}
      aria-label={rotulo}
      onChange={(e) => {
        setTexto(e.target.value)
        const v = parseFloat(e.target.value)
        if (Number.isNaN(v)) return
        onValor(Math.min(Math.max(v, min), max))
      }}
      onBlur={() => setTexto(null)}
    />
  )
}

function useErroGravacao() {
  const avisar = useCadencia((s) => s.avisar)
  return (erro: string) => avisar(`não foi possível gravar: ${erro}`, 4000)
}

// Porte de telaPremissas() do protótipo (§7.6): Gerais, Por cargo, Urgência e Playbook.
function Premissas(ctx: Contexto) {
  const { config, mundo } = ctx
  const [aba, setAba] = useParametro<AbaPremissas>("aba", "gerais", ABAS)
  const nCer = Object.values(mundo.playbook).reduce((s, c) => s + c.length, 0)
  const abas = [
    { id: "gerais" as const, rotulo: "Gerais", apoio: "jornada, intervalos e horários" },
    { id: "cargo" as const, rotulo: "Por cargo", apoio: `${papeisDe(config).length} cargos, ${CAMPOS.length} campos` },
    { id: "urgencia" as const, rotulo: "Urgência", apoio: "etapa e prioridade de cliente" },
    { id: "playbook" as const, rotulo: "Playbook", apoio: `${nCer} cerimônias` },
  ]
  return (
    <>
      <Abas abas={abas} ativa={aba} onChange={setAba} />
      <div role="tabpanel">
        {aba === "gerais" ? (
          <AbaGerais ctx={ctx} />
        ) : aba === "cargo" ? (
          <>
            <AbaCargo ctx={ctx} />
            <CustoPorCargo ctx={ctx} />
          </>
        ) : aba === "urgencia" ? (
          <AbaUrgencia ctx={ctx} />
        ) : (
          <AbaPlaybook ctx={ctx} />
        )}
      </div>
    </>
  )
}

// ─────────────────────── gerais ───────────────────────

function AbaGerais({ ctx }: { ctx: Contexto }) {
  const G = geralDe(ctx.config)
  const editarConfig = useCadencia((s) => s.editarConfig)
  const aoErro = useErroGravacao()
  const restauracao = useAcao()
  const modificacao = useAcao()
  const modificadores = !!ctx.config.modificadores

  const definir = (parcial: Partial<PremissasGerais>, adiado = false) => {
    editarConfig((c) => ({ ...c, geral: { ...geralDe(c), ...parcial } }), {
      adiado,
      motivo: "premissa geral atualizada",
    })
    persistirAdiado(`geral|${Object.keys(parcial).join(",")}`, () => definirPremissasGerais(parcial), aoErro)
  }

  const opcoesSlot = (de: number, ate: number) =>
    Array.from({ length: ate - de + 1 }, (_, i) => de + i).map((s) => (
      <option key={s} value={s}>
        {hhmm(s)}
      </option>
    ))
  const marcadas = G.preferidos.filter((s) => s >= G.inicio && s < G.fim).length / 2

  return (
    <div className="colunas c-ab sec">
      <Painel titulo="Jornada e intervalos" corpoStyle={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="campo">
          <label htmlFor="gInicio">Início da jornada</label>
          <select id="gInicio" value={G.inicio} onChange={(e) => definir({ inicio: Number(e.target.value) })}>
            {opcoesSlot(0, 8)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="gFim">Fim da jornada</label>
          <select id="gFim" value={G.fim} onChange={(e) => definir({ fim: Number(e.target.value) })}>
            {Array.from({ length: 9 }, (_, i) => 12 + i).map((s) => (
              <option key={s} value={s}>
                {hhmm(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="gAlmoco">Início do almoço</label>
          <select id="gAlmoco" value={G.almocoInicio} onChange={(e) => definir({ almocoInicio: Number(e.target.value) })}>
            {opcoesSlot(6, 12)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="gAlmocoDur">Duração do almoço</label>
          <select id="gAlmocoDur" value={G.almocoDur} onChange={(e) => definir({ almocoDur: Number(e.target.value) })}>
            {[1, 2, 3].map((v) => (
              <option key={v} value={v}>
                {n1(v / 2)}h
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="gBuffer">Intervalo entre reuniões</label>
          <select id="gBuffer" value={G.buffer} onChange={(e) => definir({ buffer: Number(e.target.value) })}>
            {[0, 1, 2].map((v) => (
              <option key={v} value={v}>
                {v === 0 ? "sem intervalo" : `${v * 30} min`}
              </option>
            ))}
          </select>
          <span className="dica">Respiro obrigatório antes e depois de cada cerimônia.</span>
        </div>
        <div className="campo">
          <label htmlFor="gDia">Dia protegido</label>
          <select
            id="gDia"
            value={G.diaProtegido}
            onChange={(e) => definir({ diaProtegido: e.target.value as PremissasGerais["diaProtegido"] })}
          >
            <option value="nenhum">nenhum</option>
            <option value="sexta-tarde">sexta à tarde</option>
            <option value="sexta">sexta-feira inteira</option>
          </select>
        </div>
        <div className="campo" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="gPeso">Força da preferência de horário</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              id="gPeso"
              type="range"
              min={0}
              max={4}
              step={0.5}
              value={G.pesoPreferencia}
              style={{ flex: 1 }}
              onChange={(e) => definir({ pesoPreferencia: Number(e.target.value) }, true)}
            />
            <span className="mono" style={{ width: 34, textAlign: "right", color: "var(--accent-ink)" }}>
              {n1(G.pesoPreferencia)}
            </span>
          </div>
          <span className="dica">Zero ignora a faixa preferencial, quatro só sai dela sem alternativa.</span>
        </div>
        <div className="campo" style={{ gridColumn: "1 / -1" }}>
          <label>Regras fixas da operação</label>
          <table>
            <tbody>
              <tr><td>Quórum mínimo</td><td className="n">100% dos cargos obrigatórios</td></tr>
              <tr><td>Antecedência de convocação</td><td className="n">48h</td></tr>
              <tr><td>Estabilidade de agenda</td><td className="n">até 20% movidas por ciclo</td></tr>
            </tbody>
          </table>
          <span className="dica">
            Valem em todo replanejamento com plano vigente: o que está a menos de 48h fica no lugar e no máximo 20%
            das cerimônias mudam de horário por ciclo.
          </span>
        </div>
      </Painel>

      <section>
        <SecCab
          titulo="Melhores horários para reunião"
          apoio={
            <>
              {n1(marcadas)}h marcadas
              <button
                type="button"
                className="mini-btn"
                disabled={restauracao.pendente}
                onClick={() => restauracao.executar(() => restaurarPremissasGerais(), "gerais, urgência e pesos restaurados ao padrão")}
              >
                Restaurar padrões
              </button>
            </>
          }
        />
        <p className="nota" style={{ marginBottom: 9 }}>
          Clique para marcar. O solver procura primeiro nos horários marcados, mas não proíbe os demais: quando não
          cabe, aloca fora e mostra onde.
        </p>
        <div className="faixa-slots">
          {Array.from({ length: 20 }, (_, s) => {
            const fora = s < G.inicio || s >= G.fim
            const alm = s >= G.almocoInicio && s < G.almocoInicio + G.almocoDur
            const on = G.preferidos.includes(s)
            return (
              <button
                key={s}
                type="button"
                className="slot"
                aria-pressed={on}
                disabled={fora || alm}
                aria-label={hhmm(s)}
                onClick={() =>
                  definir({ preferidos: on ? G.preferidos.filter((x) => x !== s) : [...G.preferidos, s].sort((a, b) => a - b) }, true)
                }
              >
                {hhmm(s)}
              </button>
            )
          })}
        </div>
        <p className="nota" style={{ marginTop: 10 }}>
          Jornada útil de <b>{n1((G.fim - G.inicio - G.almocoDur) / 2)}h</b> por dia, descontado o almoço.
        </p>
        {restauracao.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{restauracao.erro}</p> : null}

        <SecCab
          titulo="Modificadores automáticos do playbook"
          apoio={
            <Chave
              ligada={modificadores}
              onChange={(v) =>
                modificacao.executar(
                  () => definirModificadores(v),
                  v ? "modificadores ligados, squads remontados" : "modificadores desligados, squads remontados"
                )
              }
            >
              {modificacao.pendente ? "aplicando" : modificadores ? "ligados" : "desligados"}
            </Chave>
          }
          style={{ marginTop: 26 }}
        />
        <ul className="nota" style={{ display: "grid", gap: 5, paddingLeft: 18, listStyle: "disc" }}>
          <li>
            <b>Volume de produtos:</b> mais uma sessão de validação a cada 3 produtos acima da mediana, hoje de{" "}
            {n1(medianaProdutos(ctx.mundo))} produtos por projeto.
          </li>
          <li><b>Health amarelo:</b> o status report passa a ser semanal.</li>
          <li><b>Health vermelho:</b> sala de guerra semanal, escalada ao Líder Técnico.</li>
          <li><b>Cliente de prioridade alta:</b> checkpoint executivo mensal, em todas as fases.</li>
          <li><b>Atraso acima de 10 dias:</b> dobra a cadência do status report até a recuperação.</li>
        </ul>
        <p className="nota" style={{ marginTop: 8 }}>
          Ligar ou desligar remonta os squads, porque a sala de guerra e o checkpoint pedem cadeiras de Líder Técnico e
          de Gerente de Projeto. As cerimônias geradas aparecem na Agenda com a origem no detalhe.
        </p>
        {modificacao.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{modificacao.erro}</p> : null}
      </section>
    </div>
  )
}

// ─────────────────────── por cargo ───────────────────────

function AbaCargo({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const k = resultadoDe(sim.semanas[0], cenario).kpi
  const editarConfig = useCadencia((s) => s.editarConfig)
  const aoErro = useErroGravacao()
  const restauracao = useAcao()
  const papeis = papeisDe(config)

  const definir = (pp: string, campo: DefCampo, v: number) => {
    const bruto = v * campo.esc
    editarConfig((c) => ({ ...c, papeis: { ...c.papeis, [pp]: { ...c.papeis[pp], [campo.k]: bruto } } }), { adiado: true })
    persistirAdiado(`cargo|${pp}|${campo.k}`, () => definirPremissaCargo(indices.cargos[pp], { [campo.k]: bruto }), aoErro)
  }

  const totalPessoas = papeis.reduce((s, pp) => s + pessoasDo(mundo, pp).length, 0)
  const capTotal = papeis.reduce((s, pp) => s + premDe(config, pp).Cl * pessoasDo(mundo, pp).length, 0)
  const tetoTotal = papeis.reduce((s, pp) => s + premDe(config, pp).teto * pessoasDo(mundo, pp).length, 0)
  const cargaTotal = k.porPessoa.reduce((s, x) => s + x.horas, 0)
  const CALC = [
    { lb: "Cap. líquida", un: "h/sem" },
    { lb: "Teto", un: "h/sem" },
    { lb: "Limite", un: "h/sem" },
    { lb: "Carga", un: "h/sem" },
    { lb: "Situação", un: "" },
  ]

  return (
    <>
      <section className="sec">
        <SecCab
          titulo="Premissas por cargo"
          apoio={
            <>
              <button
                type="button"
                className="mini-btn"
                disabled={restauracao.pendente}
                onClick={() => restauracao.executar(() => restaurarPremissasCargo(), "premissas por cargo restauradas ao padrão")}
              >
                Restaurar padrões
              </button>
              <Link href="/time?aba=cargos" className="mini-btn">
                Cadastrar cargos
              </Link>
            </>
          }
        />
        <div className="resumo-prem">
          <div><span>Cargos</span><b>{papeis.length}</b></div>
          <div><span>Pessoas</span><b>{totalPessoas}</b></div>
          <div><span>Capacidade líquida</span><b>{n1(capTotal)} h</b></div>
          <div><span>Teto de reunião</span><b>{n1(tetoTotal)} h</b></div>
          <div>
            <span>Carga da semana</span>
            <b style={{ color: cargaTotal > tetoTotal ? "var(--bad)" : "var(--ok)" }}>{n1(cargaTotal)} h</b>
          </div>
          <div><span>Ocupação do teto</span><b>{n0(tetoTotal ? (cargaTotal / tetoTotal) * 100 : 0)}%</b></div>
        </div>

        <div className="larga">
          <table className="prem-tabela">
            <colgroup>
              <col style={{ width: 196 }} />
              {CAMPOS.map((c) => (
                <col key={c.k} style={{ width: 88 }} />
              ))}
              {CALC.map((c, i) => (
                <col key={c.lb} style={{ width: i === CALC.length - 1 ? 132 : 88 }} />
              ))}
            </colgroup>
            <thead>
              <tr className="grupos">
                <th rowSpan={2} className="fixa">Cargo</th>
                {GRUPOS.map((g) => (
                  <th key={g.lb} colSpan={g.campos.length} className="grupo">{g.lb}</th>
                ))}
                <th colSpan={CALC.length} className="grupo calculado">Calculado pelo sistema</th>
              </tr>
              <tr className="subcab">
                {GRUPOS.map((g) =>
                  g.campos.map((kc, i) => {
                    const f = campoDe(kc)
                    return (
                      <th key={kc} className={`n${i === 0 ? " abre-grupo" : ""}`} title={f.dica}>
                        {f.lb}
                        <em>{f.un}</em>
                      </th>
                    )
                  })
                )}
                {CALC.map((c, i) => (
                  <th key={c.lb} className={`${c.lb === "Situação" ? "" : "n "}calculado${i === 0 ? " abre-grupo" : ""}`}>
                    {c.lb}
                    <em>{c.un || " "}</em>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {papeis.map((pp) => {
                const c = premDe(config, pp)
                const ps = pessoasDo(mundo, pp)
                const kps = k.porPessoa.filter((x) => x.papel === pp)
                const carga = kps.length ? kps.reduce((s, x) => s + x.horas, 0) / kps.length : 0
                const ocup = c.teto > 0 ? (carga / c.teto) * 100 : 0
                const acima = kps.filter((x) => x.acimaLimite).length
                const cedidos = kps.filter((x) => x.acimaTeto).length
                const [tom, texto]: [Tom, string] = !ps.length
                  ? ["ruim", "sem ninguém"]
                  : acima
                    ? ["ruim", `${acima} acima do limite`]
                    : cedidos
                      ? ["aviso", `${cedidos} com concessão`]
                      : ocup > 85
                        ? ["acento", `${n0(ocup)}% do teto`]
                        : ocup < 45
                          ? ["neutro", `${n0(ocup)}% do teto`]
                          : ["ok", `${n0(ocup)}% do teto`]
                return (
                  <tr key={pp}>
                    <td className="fixa">
                      <b>{pp}</b>
                      <div className="meta">{ps.length ? `${ps.length} pessoa(s)` : "sem ninguém"}</div>
                    </td>
                    {GRUPOS.map((g) =>
                      g.campos.map((kc, j) => {
                        const f = campoDe(kc)
                        return (
                          <td key={kc} className={`edt${j === 0 ? " abre-grupo" : ""}`}>
                            <Celula
                              valor={config.papeis[pp][kc] / f.esc}
                              min={f.min}
                              max={f.max}
                              passo={f.passo}
                              rotulo={`${f.lb} ${f.un} de ${pp}`}
                              onValor={(v) => definir(pp, f, v)}
                            />
                          </td>
                        )
                      })
                    )}
                    <td className="n calc abre-grupo">{n1(c.Cl)}</td>
                    <td className="n calc">
                      {n1(c.teto)}
                      {c.limitadoPorHoras ? <em className="flag">absoluto</em> : null}
                    </td>
                    <td className="n calc">{n1(c.tetoMax)}</td>
                    <td className="n calc">{n1(carga)}</td>
                    <td className="calc"><Selo tom={tom}>{texto}</Selo></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="colunas c-2" style={{ marginTop: 16, gap: 26 }}>
          <p className="nota">
            O <b>alvo</b> é o que queremos, a <b>tolerância</b> é o quanto o cargo aceita ceder quando não há
            alternativa. O otimizador trabalha primeiro dentro do alvo e só usa a tolerância para não deixar cerimônia
            obrigatória sem janela, registrando cada concessão.
          </p>
          <p className="nota">
            As colunas calculadas seguem a fórmula: capacidade líquida = jornada × (1 − ausência) − institucional. Teto
            = <b>o menor</b> entre capacidade × (1 − alvo) e o máximo absoluto de horas por semana, e a marca{" "}
            <i>absoluto</i> aparece quando é o limite em horas que manda. Os tetos de dia, semana e mês são
            independentes, e o mensal é acumulado ao longo do horizonte. Cada alteração vira uma nova versão da
            premissa, com vigência.
          </p>
        </div>
        {restauracao.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{restauracao.erro}</p> : null}
      </section>

      <section className="sec">
        <SecCab titulo="Demanda contra teto por cargo" apoio="tracejado marca o teto" />
        <div style={{ maxWidth: 620 }}>
          <GraficoBarras
            dados={papeis.map((pp) => {
              const kps = k.porPessoa.filter((x) => x.papel === pp)
              const m = kps.length ? kps.reduce((s, x) => s + x.horas, 0) / kps.length : 0
              const teto = premDe(config, pp).teto
              return {
                l: pp.split(" ")[0].slice(0, 8),
                v: m,
                ref: teto,
                t: `${n1(m)}h`,
                cor: m > teto ? "var(--destructive)" : "var(--chart-1)",
              }
            })}
            valores
            dicas
            h={186}
            alt="carga contra teto por cargo"
          />
        </div>
      </section>
    </>
  )
}

// ─────────────────────── urgência ───────────────────────

/** Custo por hora-pessoa de cada cargo (§6): base do custo de cerimônia em Indicadores (E08, E24). */
function CustoPorCargo({ ctx }: { ctx: Contexto }) {
  const { config, indices } = ctx
  const editarConfig = useCadencia((s) => s.editarConfig)
  const aoErro = useErroGravacao()
  const papeis = papeisDe(config)

  const definir = (pp: string, v: number) => {
    editarConfig((c) => ({ ...c, custoHora: { ...(c.custoHora ?? {}), [pp]: v } }), { adiado: true })
    persistirAdiado(`custo|${pp}`, () => definirPremissaCargo(indices.cargos[pp], { custoHora: v }), aoErro)
  }

  return (
    <section className="sec">
      <SecCab titulo="Custo por hora do cargo" apoio="base do custo de cerimônia em Indicadores" />
      <table style={{ maxWidth: 520 }}>
        <thead>
          <tr>
            <th>Cargo</th>
            <th className="n" style={{ width: 150 }}>R$ por hora-pessoa</th>
          </tr>
        </thead>
        <tbody>
          {papeis.map((pp) => (
            <tr key={pp}>
              <td>{pp}</td>
              <td className="n">
                <Celula
                  valor={custoHoraDe(config, pp)}
                  min={0}
                  max={2000}
                  passo={1}
                  rotulo={`Custo por hora de ${pp}`}
                  onValor={(v) => definir(pp, v)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota" style={{ marginTop: 9 }}>
        Custo cheio da hora: salário, encargos e benefícios. Sem valor cadastrado, vale R$ {CUSTO_HORA_PADRAO}, o
        número do protótipo.
      </p>
    </section>
  )
}

function AbaUrgencia({ ctx }: { ctx: Contexto }) {
  const { mundo, config, indices } = ctx
  const editarConfig = useCadencia((s) => s.editarConfig)
  const aoErro = useErroGravacao()
  const [editando, setEditando] = useState<{ fase: string | null } | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [destino, setDestino] = useState<string>("")
  const remocao = useAcao()
  const fases = Object.keys(mundo.etapas)
  const maxU = Math.max(...fases.map((f) => etapaDe(config, f).urgencia), 1)

  const definirEtapa = (f: string, campo: "urgencia" | "prazoDias", v: number) => {
    const atual = etapaDe(config, f)
    const novo = { ...atual, [campo]: v }
    editarConfig((c) => ({ ...c, etapas: { ...c.etapas, [f]: novo } }), { adiado: true })
    persistirAdiado(`etapa|${f}`, () => definirUrgenciaEtapa(indices.etapas[f], novo.urgencia, novo.prazoDias), aoErro)
  }
  const definirPeso = (pri: "alta" | "media" | "baixa", v: number) => {
    editarConfig((c) => ({ ...c, clientes: { ...c.clientes, [pri]: v } }), { adiado: true })
    persistirAdiado(`peso|${pri}`, () => definirPesoCliente(pri, v), aoErro)
  }

  const nRemover = removendo ? mundo.projetos.filter((p) => p.fase === removendo).length : 0
  const destinos = fases.filter((f) => f !== removendo)
  const kick = etapaDe(config, "kickoff")
  const sust = etapaDe(config, "sustentacao")

  return (
    <div className="colunas c-ab sec">
      <section>
        <SecCab
          titulo="Etapas do ciclo"
          apoio={
            <>
              urgência e prazo definem a ordem da fila
              <button type="button" className="btn" onClick={() => setEditando({ fase: null })}>
                <IconeMais />
                Nova etapa
              </button>
            </>
          }
        />
        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th className="n">Projetos</th>
              <th className="n">Urgência<div className="meta">1 a 5</div></th>
              <th className="n">Prazo<div className="meta">dias úteis</div></th>
              <th className="n">Cerimônias</th>
              <th>Efeito no otimizador</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {fases.map((f) => {
              const et = etapaDe(config, f)
              const n = mundo.projetos.filter((p) => p.fase === f).length
              return (
                <tr key={f}>
                  <td><SeloFase fase={f} etapas={mundo.etapas} /></td>
                  <td className="n">{n}</td>
                  <td className="edt">
                    <Celula valor={et.urgencia} min={1} max={5} passo={1} rotulo={`Urgência de ${mundo.etapas[f].rotulo}`} onValor={(v) => definirEtapa(f, "urgencia", v)} />
                  </td>
                  <td className="edt">
                    <Celula valor={et.prazoDias} min={1} max={60} passo={1} rotulo={`Prazo de ${mundo.etapas[f].rotulo}`} onValor={(v) => definirEtapa(f, "prazoDias", v)} />
                  </td>
                  <td className="n">{(mundo.playbook[f] ?? []).length}</td>
                  <td className="meta">
                    {et.prazoDias <= 7
                      ? "prazo crítico, puxada para o início da semana e da fila"
                      : et.urgencia >= 4
                        ? "entra antes na fila de alocação"
                        : "cede lugar quando falta capacidade"}
                  </td>
                  <td>
                    <span className="acoes">
                      <button type="button" className="mini-btn" onClick={() => setEditando({ fase: f })}>editar</button>
                      {fases.length > 1 ? (
                        <button
                          type="button"
                          className="mini-btn perigo"
                          onClick={() => {
                            setRemovendo(f)
                            setDestino(fases.find((x) => x !== f) ?? "")
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
        <p className="nota" style={{ marginTop: 9 }}>
          Prazo de até 7 dias úteis marca a cerimônia como crítica: o solver a aloca primeiro, o mais cedo possível na
          semana, e uma cerimônia crítica adiada vira violação de SLA.
        </p>
      </section>

      <section>
        <SecCab titulo="Prioridade do cliente" apoio="multiplica a urgência da etapa" />
        <table>
          <thead>
            <tr>
              <th>Prioridade</th>
              <th className="n">Projetos</th>
              <th className="n">Peso</th>
              <th className="n">Score da etapa mais urgente</th>
            </tr>
          </thead>
          <tbody>
            {(["alta", "media", "baixa"] as const).map((pri) => (
              <tr key={pri}>
                <td><Selo tom={pri === "alta" ? "acento" : "neutro"}>{pri}</Selo></td>
                <td className="n">{mundo.projetos.filter((p) => (p.prioridade || "media") === pri).length}</td>
                <td className="edt">
                  <Celula valor={pesoCliente(config, pri)} min={1} max={5} passo={1} rotulo={`Peso da prioridade ${pri}`} onValor={(v) => definirPeso(pri, v)} />
                </td>
                <td className="n calc">{n1(maxU * pesoCliente(config, pri))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nota" style={{ marginTop: 9 }}>
          Score = urgência da etapa × peso do cliente. É esse número que reordena a fila: um kickoff de cliente
          prioritário entra antes de um check-in de sustentação, mesmo que os dois caibam.
        </p>
        {mundo.etapas.kickoff && mundo.etapas.sustentacao ? (
          <p className="nota exemplo">
            Com os valores atuais, <b>Kickoff</b> tem urgência {kick.urgencia} e prazo de {kick.prazoDias} dias úteis do
            fechamento do contrato: score {n1(kick.urgencia * pesoCliente(config, "alta"))} num cliente de prioridade
            alta, contra {n1(sust.urgencia * pesoCliente(config, "baixa"))} de um check-in de sustentação.
          </p>
        ) : null}
      </section>

      {editando ? <EditorEtapa ctx={ctx} fase={editando.fase} onFechar={() => setEditando(null)} /> : null}

      <Confirmacao
        aberto={removendo !== null}
        titulo={`Remover a etapa ${removendo ? mundo.etapas[removendo]?.rotulo : ""}?`}
        acao="Remover etapa"
        erro={remocao.erro}
        ocupado={remocao.pendente}
        texto={
          removendo
            ? nRemover
              ? `${nRemover} projeto(s) estão nesta etapa e precisam de destino. O playbook da etapa, com ${(mundo.playbook[removendo] ?? []).length} cerimônia(s), é descartado.`
              : `Nenhum projeto está nesta etapa. O playbook dela, com ${(mundo.playbook[removendo] ?? []).length} cerimônia(s), é descartado.`
            : ""
        }
        extra={
          nRemover ? (
            <div className="campo" style={{ marginTop: 14 }}>
              <label htmlFor="destinoEtapa">Mover os projetos para</label>
              <select id="destinoEtapa" value={destino} onChange={(e) => setDestino(e.target.value)}>
                {destinos.map((f) => (
                  <option key={f} value={f}>{mundo.etapas[f].rotulo}</option>
                ))}
              </select>
            </div>
          ) : null
        }
        onFechar={() => {
          setRemovendo(null)
          remocao.setErro(null)
        }}
        onConfirmar={() =>
          removendo &&
          remocao.executar(
            () => removerEtapa(indices.etapas[removendo], indices.etapas[destino || destinos[0]]),
            "etapa removida, projetos movidos",
            () => setRemovendo(null)
          )
        }
      />
    </div>
  )
}

function EditorEtapa({ ctx, fase, onFechar }: { ctx: Contexto; fase: string | null; onFechar: () => void }) {
  const { mundo, config, indices } = ctx
  const et = fase ? etapaDe(config, fase) : { urgencia: 3, prazoDias: 15 }
  const [nome, setNome] = useState(fase ? mundo.etapas[fase].rotulo : "")
  const [urgencia, setUrgencia] = useState(et.urgencia)
  const [prazo, setPrazo] = useState(et.prazoDias)
  const acao = useAcao()

  const salvar = () => {
    if (!nome.trim()) return acao.setErro("Informe o nome da etapa.")
    acao.executar(
      () => salvarEtapa({ id: fase ? indices.etapas[fase] : null, rotulo: nome.trim(), urgencia, prazoDias: prazo }),
      fase ? "etapa atualizada" : "etapa criada, monte o playbook dela",
      onFechar
    )
  }

  return (
    <Modal aberto largura={520} onFechar={onFechar} rotulo={fase ? `Editar ${mundo.etapas[fase].rotulo}` : "Nova etapa"}>
      <EditorCab
        titulo={fase ? `Editar ${mundo.etapas[fase].rotulo}` : "Nova etapa"}
        meta={
          fase
            ? `${mundo.projetos.filter((p) => p.fase === fase).length} projeto(s), ${(mundo.playbook[fase] ?? []).length} cerimônia(s)`
            : "a etapa nasce sem cerimônias, o playbook dela é montado depois"
        }
      />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="eeNome">Nome da etapa</label>
          <input id="eeNome" type="text" value={nome} placeholder="Pré-kickoff comercial" onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="eeUrg">Urgência</label>
          <select id="eeUrg" value={urgencia} onChange={(e) => setUrgencia(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v}
                {v === 5 ? ", máxima" : v === 1 ? ", mínima" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="eePrazo">Prazo em dias úteis</label>
          <input
            id="eePrazo"
            type="number"
            min={1}
            max={60}
            value={prazo}
            onChange={(e) => setPrazo(Math.min(Math.max(1, Number(e.target.value) || 1), 60))}
          />
        </div>
        <div className="campo l4">
          <span className="dica">
            Prazo de até 7 dias úteis marca as cerimônias da etapa como críticas de SLA: elas entram na frente da fila e
            são puxadas para o início da semana.
          </span>
        </div>
      </div>
      <EditorPe erro={acao.erro} acao={fase ? "Salvar etapa" : "Criar etapa"} ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}

// ─────────────────────── playbook ───────────────────────

function AbaPlaybook({ ctx }: { ctx: Contexto }) {
  const { mundo, config, simulacao: sim, cenario, indices } = ctx
  const editarMundo = useCadencia((s) => s.editarMundo)
  const aoErro = useErroGravacao()
  const restauracao = useAcao()
  const exclusao = useAcao()
  const [editando, setEditando] = useState<{ ref: [string, number] | null } | null>(null)
  const [excluindo, setExcluindo] = useState<[string, number] | null>(null)

  const F = fatorMes(config)
  const uso: Record<string, { cer: number; h: number }> = {}
  sim.semanas.forEach((sm) =>
    resultadoDe(sm, cenario).alocadas.forEach((ev) => {
      const chave = `${ev.fase}|${ev.tipo}`
      uso[chave] = uso[chave] || { cer: 0, h: 0 }
      uso[chave].cer += F
      uso[chave].h += pessoaHora(ev) * F
    })
  )
  const total = Object.values(uso).reduce((s, x) => s + x.h, 0) || 1

  const definir = (f: string, i: number, campo: "dur" | "cada" | "prio" | "obrig", valor: number) => {
    const item = mundo.playbook[f][i]
    const id = indices.playbook[`${f}|${item.tipo}`]
    editarMundo(
      (m) => ({
        ...m,
        playbook: {
          ...m.playbook,
          [f]: m.playbook[f].map((c, j): ItemPlaybook => (j !== i ? c : campo === "obrig" ? { ...c, obrig: valor === 1 } : { ...c, [campo]: valor })),
        },
      }),
      campo === "cada" ? "recorrência alterada, cenário replanejado" : "playbook atualizado"
    )
    if (id) persistirAdiado(`playbook|${id}|${campo}`, () => editarCerimoniaCampo(id, campo, valor), aoErro, 400)
  }

  const alvo = excluindo ? mundo.playbook[excluindo[0]]?.[excluindo[1]] : null

  return (
    <section className="sec">
      <SecCab
        titulo="Playbook de cerimônias"
        apoio={
          <>
            a demanda de agenda nasce daqui
            <button
              type="button"
              className="mini-btn"
              disabled={restauracao.pendente}
              onClick={() => restauracao.executar(() => restaurarPlaybook(), "playbook restaurado ao padrão")}
            >
              Restaurar padrão
            </button>
            <button type="button" className="btn" onClick={() => setEditando({ ref: null })}>
              <IconeMais />
              Nova cerimônia
            </button>
          </>
        }
      />
      <p className="nota" style={{ marginBottom: 10 }}>
        Duração, recorrência e obrigatoriedade são editáveis na própria linha. Mudar a recorrência de uma etapa muda a
        demanda de todos os projetos naquela etapa, então o cenário é replanejado a cada alteração.
      </p>
      <div className="larga">
        <table style={{ minWidth: 1120 }}>
          <thead>
            <tr>
              <th>Etapa</th>
              <th className="n">Projetos</th>
              <th>Cerimônia</th>
              <th>Cargos obrigatórios</th>
              <th className="n">Duração<div className="meta">min</div></th>
              <th>Recorrência</th>
              <th className="n">Prioridade</th>
              <th>Tipo</th>
              <th className="n">Cerim./mês</th>
              <th className="n">Pessoa-hora/mês</th>
              <th style={{ width: 140 }}>Peso na agenda</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {Object.entries(mundo.playbook).map(([f, cs]) => {
              const nproj = mundo.projetos.filter((p) => p.fase === f).length
              const et = etapaDe(config, f)
              return (
                <Fragment key={f}>
                  {cs.map((c, i) => {
                    const u = uso[`${f}|${c.tipo}`] ?? { cer: 0, h: 0 }
                    return (
                      <tr key={`${f}-${i}`}>
                        <td>
                          {i === 0 ? (
                            <>
                              <SeloFase fase={f} etapas={mundo.etapas} />
                              <div className="meta">urgência {et.urgencia}, prazo {et.prazoDias}d</div>
                            </>
                          ) : null}
                        </td>
                        <td className="n">{i === 0 ? nproj : ""}</td>
                        <td><b>{c.tipo}</b></td>
                        <td>
                          <button type="button" className="mini-btn" style={{ fontWeight: 400 }} onClick={() => setEditando({ ref: [f, i] })}>
                            {c.papeis.join(" + ")}
                          </button>
                        </td>
                        <td className="edt">
                          <Celula valor={c.dur} min={15} max={240} passo={15} rotulo={`Duração de ${c.tipo}`} onValor={(v) => definir(f, i, "dur", Math.round(v / 15) * 15)} />
                        </td>
                        <td className="edt">
                          <select
                            className="cel-edit"
                            style={{ width: 132 }}
                            value={c.cada}
                            aria-label={`Recorrência de ${c.tipo}`}
                            onChange={(e) => definir(f, i, "cada", Number(e.target.value))}
                          >
                            {CADENCIAS.map((v) => (
                              <option key={v} value={v}>{v === 1 ? "semanal" : `a cada ${v} sem`}</option>
                            ))}
                          </select>
                        </td>
                        <td className="edt">
                          <select
                            className="cel-edit"
                            style={{ width: 52 }}
                            value={c.prio}
                            aria-label={`Prioridade de ${c.tipo}`}
                            onChange={(e) => definir(f, i, "prio", Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5].map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td className="edt">
                          <select
                            className="cel-edit"
                            style={{ width: 104 }}
                            value={c.obrig ? "1" : "0"}
                            aria-label={`Tipo de ${c.tipo}`}
                            onChange={(e) => definir(f, i, "obrig", Number(e.target.value))}
                          >
                            <option value="1">obrigatória</option>
                            <option value="0">opcional</option>
                          </select>
                        </td>
                        <td className="n">{n0(u.cer)}</td>
                        <td className="n">{n1(u.h)}</td>
                        <td>
                          <Trilha valor={u.h} max={total} />
                          <div className="meta">{n1((u.h / total) * 100)}%</div>
                        </td>
                        <td>
                          <span className="acoes">
                            <button type="button" className="mini-btn perigo" onClick={() => setExcluindo([f, i])}>excluir</button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="nota" style={{ marginTop: 9 }}>
        Cerimônias e pessoa-hora por mês vêm do cenário {cenario === "otm" ? "otimizado" : "vigente"}, projetados do
        horizonte de {config.horizonte} semanas. A prioridade é a ordem base na fila, corrigida pela urgência da etapa e
        pelo peso do cliente.
      </p>
      {restauracao.erro ? <p className="nota" style={{ color: "var(--bad)" }}>{restauracao.erro}</p> : null}

      {editando ? <EditorCerimonia ctx={ctx} referencia={editando.ref} onFechar={() => setEditando(null)} /> : null}

      <Confirmacao
        aberto={alvo !== null && alvo !== undefined}
        titulo={`Remover ${alvo?.tipo ?? ""} do playbook?`}
        acao="Remover cerimônia"
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        texto={
          excluindo
            ? `A série deixa de ser gerada para os ${mundo.projetos.filter((p) => p.fase === excluindo[0]).length} projeto(s) em ${mundo.etapas[excluindo[0]]?.rotulo}. O cenário é replanejado em seguida.`
            : ""
        }
        onFechar={() => {
          setExcluindo(null)
          exclusao.setErro(null)
        }}
        onConfirmar={() => {
          if (!excluindo || !alvo) return
          const id = indices.playbook[`${excluindo[0]}|${alvo.tipo}`]
          exclusao.executar(() => excluirCerimonia(id), "cerimônia removida do playbook", () => setExcluindo(null))
        }}
      />
    </section>
  )
}

function EditorCerimonia({
  ctx,
  referencia,
  onFechar,
}: {
  ctx: Contexto
  referencia: [string, number] | null
  onFechar: () => void
}) {
  const { mundo, config, indices } = ctx
  const atual = referencia ? mundo.playbook[referencia[0]][referencia[1]] : null
  const [nome, setNome] = useState(atual?.tipo ?? "")
  const [fase, setFase] = useState(referencia?.[0] ?? Object.keys(mundo.etapas)[0])
  const [dur, setDur] = useState(atual?.dur ?? 60)
  const [cada, setCada] = useState(atual?.cada ?? 1)
  const [obrig, setObrig] = useState(atual?.obrig ?? true)
  const [prio, setPrio] = useState(atual?.prio ?? 3)
  const [papeis, setPapeis] = useState<string[]>(atual?.papeis ?? [])
  const acao = useAcao()
  const todos = papeisDe(config)

  const salvar = () => {
    if (!nome.trim()) return acao.setErro("Informe o nome da cerimônia.")
    if (!papeis.length) return acao.setErro("Escolha ao menos um cargo obrigatório.")
    acao.executar(
      () =>
        salvarCerimonia({
          id: atual && referencia ? indices.playbook[`${referencia[0]}|${atual.tipo}`] : null,
          etapaId: indices.etapas[fase],
          tipo: nome.trim(),
          dur,
          cada,
          prio,
          obrig,
          cargos: papeis.map((pp) => indices.cargos[pp]),
        }),
      atual ? "cerimônia atualizada, squads remontados" : "cerimônia criada, squads atualizados",
      onFechar
    )
  }

  return (
    <Modal aberto largura={720} onFechar={onFechar} rotulo={atual ? `Editar ${atual.tipo}` : "Nova cerimônia"}>
      <EditorCab
        titulo={atual ? `Editar ${atual.tipo}` : "Nova cerimônia"}
        meta={
          atual
            ? `vale para os ${mundo.projetos.filter((p) => p.fase === fase).length} projeto(s) da etapa`
            : "a série passa a valer para todos os projetos da etapa escolhida"
        }
      />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="ekNome">Nome da cerimônia</label>
          <input id="ekNome" type="text" value={nome} placeholder="Revisão de Escopo" onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ekFase">Etapa</label>
          <select id="ekFase" value={fase} disabled={!!atual} onChange={(e) => setFase(e.target.value)}>
            {Object.entries(mundo.etapas).map(([k2, v]) => (
              <option key={k2} value={k2}>{v.rotulo}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ekDur">Duração em minutos</label>
          <input
            id="ekDur"
            type="number"
            min={15}
            max={240}
            step={15}
            value={dur}
            onChange={(e) => setDur(Math.min(Math.max(15, Number(e.target.value) || 15), 240))}
          />
        </div>
        <div className="campo">
          <label htmlFor="ekCada">Recorrência</label>
          <select id="ekCada" value={cada} onChange={(e) => setCada(Number(e.target.value))}>
            {CADENCIAS.map((v) => (
              <option key={v} value={v}>{v === 1 ? "semanal" : `a cada ${v} semanas`}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ekObrig">Tipo</label>
          <select id="ekObrig" value={obrig ? "1" : "0"} onChange={(e) => setObrig(e.target.value === "1")}>
            <option value="1">obrigatória</option>
            <option value="0">opcional</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ekPrio">Prioridade na fila</label>
          <select id="ekPrio" value={prio} onChange={(e) => setPrio(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v}
                {v === 1 ? ", mais alta" : v === 5 ? ", mais baixa" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="campo l4">
          <label>Cargos obrigatórios</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {todos.map((pp) => {
              const n = mundo.times.filter((t) => membrosDoTime(mundo, t.id).some((id) => mundo.pessoas[id].papel === pp)).length
              const on = papeis.includes(pp)
              return (
                <button
                  key={pp}
                  type="button"
                  className="slot nome"
                  aria-pressed={on}
                  data-dica={`${pp}: presente em ${n} de ${mundo.times.length} times`}
                  onClick={() => setPapeis(on ? papeis.filter((x) => x !== pp) : [...papeis, pp])}
                >
                  {pp}
                </button>
              )
            })}
          </div>
          <span className="dica">
            Define quem é obrigatório nesta reunião, na ordem em que os cargos foram marcados. Se um time não tiver o
            cargo, os projetos dele perdem esta cerimônia por falta de quórum.
          </span>
        </div>
      </div>
      <EditorPe erro={acao.erro} acao={atual ? "Salvar cerimônia" : "Criar cerimônia"} ocupado={acao.pendente} onCancelar={onFechar} onAcao={salvar} />
    </Modal>
  )
}
