"use client"

import { useState } from "react"

import type { Contexto } from "@/components/cadencia/com-dados"
import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import { IconeMais, SecCab, Selo } from "@/components/cadencia/primitivas"
import { excluirAusencia, salvarAusencia } from "@/lib/dados/ausencias"
import { ROTULO_AUSENCIA, type AusenciaBanco, type TipoAusencia } from "@/lib/dados/mapeador"
import { dataDoDia } from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useCadencia } from "@/lib/estado/cadencia"

// Ausências e feriados (E14): o dia sai da agenda da pessoa e o teto da semana encolhe na mesma
// proporção. Feriado vale para todos. Cadastro manual até a integração com o RH (E23).

const TIPOS = Object.keys(ROTULO_AUSENCIA) as TipoAusencia[]
const NENHUMA: AusenciaBanco[] = []
const ehFeriado = (t: TipoAusencia) => t === "feriado_nacional" || t === "feriado_municipal"
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

function diasUteis(inicio: string, fim: string): number {
  let n = 0
  for (let t = Date.parse(`${inicio}T00:00:00Z`); t <= Date.parse(`${fim}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t).getUTCDay()
    if (d !== 0 && d !== 6) n++
  }
  return n
}

export function AbaAusencias({ ctx }: { ctx: Contexto }) {
  const { mundo, config, indices } = ctx
  const ausencias = useCadencia((s) => s.dadosAtuais?.ausencias) ?? NENHUMA
  const [editando, setEditando] = useState<AusenciaBanco | "nova" | null>(null)
  const [excluindo, setExcluindo] = useState<AusenciaBanco | null>(null)
  const exclusao = useAcao()

  const cal = config.calendario
  const inicioH = cal?.inicio ?? ""
  const fimH = cal ? dataDoDia(cal.inicio, config.horizonte, 4) : ""
  const situacao = (a: AusenciaBanco) =>
    !cal ? "" : a.fim < inicioH ? "passada" : a.inicio > fimH ? "depois do horizonte" : "no horizonte"
  const nomeDe = (id: string | null) => {
    if (!id) return "Todos"
    const i = indices.pessoas.indexOf(id)
    return mundo.pessoas[i]?.nome ?? "pessoa removida"
  }
  const lista = [...ausencias].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const noHorizonte = lista.filter((a) => situacao(a) === "no horizonte")

  return (
    <section className="sec">
      <SecCab
        titulo="Ausências e feriados"
        apoio={
          <>
            {cal
              ? `${noHorizonte.length} no horizonte de ${config.horizonte} semanas, de ${dataBr(inicioH)} a ${dataBr(fimH)}`
              : "o horizonte ainda não tem datas"}
            <button type="button" className="btn" onClick={() => setEditando("nova")}>
              <IconeMais />
              Nova ausência
            </button>
          </>
        }
      />
      <p className="nota" style={{ marginBottom: 12 }}>
        O dia de ausência sai da agenda da pessoa e o teto semanal dela encolhe na mesma proporção: três dias fora
        deixam 40% do teto. Feriado vale para todos. Os nacionais de 2026 e 2027 já estão cadastrados; inclua os
        municipais das cidades onde o time trabalha.
      </p>

      {lista.length ? (
        <div className="rolagem" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Quem</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th className="n">Dias úteis</th>
                <th>Situação</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} style={situacao(a) === "passada" ? { opacity: 0.55 } : undefined}>
                  <td className="mono">{a.inicio === a.fim ? dataBr(a.inicio) : `${dataBr(a.inicio)} a ${dataBr(a.fim)}`}</td>
                  <td>{nomeDe(a.pessoa_id)}</td>
                  <td>
                    <Selo tom={ehFeriado(a.tipo) ? "acento" : "neutro"}>{ROTULO_AUSENCIA[a.tipo]}</Selo>
                  </td>
                  <td>{a.descricao}</td>
                  <td className="n">{diasUteis(a.inicio, a.fim)}</td>
                  <td>{situacao(a)}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button type="button" className="mini-btn" onClick={() => setEditando(a)}>
                      editar
                    </button>
                    <button type="button" className="mini-btn perigo" onClick={() => setExcluindo(a)}>
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="nota">Nenhuma ausência cadastrada.</p>
      )}

      {editando ? (
        <EditorAusencia ctx={ctx} atual={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />
      ) : null}
      <Confirmacao
        aberto={excluindo !== null}
        titulo="Excluir esta ausência?"
        texto={
          excluindo
            ? `${nomeDe(excluindo.pessoa_id)}, ${ROTULO_AUSENCIA[excluindo.tipo]} de ${dataBr(excluindo.inicio)}. O dia volta para a agenda e o plano é recalculado.`
            : ""
        }
        acao="Excluir"
        perigo
        erro={exclusao.erro}
        ocupado={exclusao.pendente}
        onConfirmar={() => {
          if (excluindo)
            exclusao.executar(() => excluirAusencia(excluindo.id), "ausência excluída, cenário replanejado", () =>
              setExcluindo(null)
            )
        }}
        onFechar={() => setExcluindo(null)}
      />
    </section>
  )
}

function EditorAusencia({
  ctx,
  atual,
  onFechar,
}: {
  ctx: Contexto
  atual: AusenciaBanco | null
  onFechar: () => void
}) {
  const { mundo, indices } = ctx
  const [tipo, setTipo] = useState<TipoAusencia>(atual?.tipo ?? "ferias")
  const [pessoa, setPessoa] = useState<string>(atual?.pessoa_id ?? indices.pessoas[0] ?? "")
  const [inicio, setInicio] = useState(atual?.inicio ?? "")
  const [fim, setFim] = useState(atual?.fim ?? "")
  const [descricao, setDescricao] = useState(atual?.descricao ?? "")
  const acao = useAcao()
  const feriado = ehFeriado(tipo)

  const salvar = () => {
    if (!inicio) {
      acao.setErro("Informe a data de início.")
      return
    }
    acao.executar(
      () =>
        salvarAusencia({
          id: atual?.id ?? null,
          pessoaId: feriado ? null : pessoa,
          inicio,
          fim: fim || inicio,
          tipo,
          descricao,
        }),
      feriado ? "feriado salvo, cenário replanejado" : "ausência salva, cenário replanejado",
      onFechar
    )
  }

  return (
    <Modal aberto largura={560} onFechar={onFechar} rotulo={atual ? "Editar ausência" : "Nova ausência"}>
      <EditorCab
        titulo={atual ? "Editar ausência" : "Nova ausência"}
        meta="o dia sai da agenda e o teto da semana encolhe"
      />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="auTipo">Tipo</label>
          <select id="auTipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoAusencia)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_AUSENCIA[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo l2">
          <label htmlFor="auPessoa">Pessoa</label>
          <select
            id="auPessoa"
            value={feriado ? "" : pessoa}
            disabled={feriado}
            onChange={(e) => setPessoa(e.target.value)}
          >
            {feriado ? <option value="">Todos</option> : null}
            {mundo.pessoas.map((p) => (
              <option key={p.id} value={indices.pessoas[p.id]}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo l2">
          <label htmlFor="auInicio">Início</label>
          <input id="auInicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="campo l2">
          <label htmlFor="auFim">Fim</label>
          <input id="auFim" type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} />
          <span className="dica">Em branco, um dia só. Até 120 dias por registro.</span>
        </div>
        <div className="campo l4">
          <label htmlFor="auDescricao">Descrição</label>
          <input
            id="auDescricao"
            value={descricao}
            maxLength={120}
            placeholder={feriado ? "Aniversário da cidade" : "Férias programadas"}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
      </div>
      <EditorPe
        erro={acao.erro}
        acao={atual ? "Salvar ausência" : "Adicionar ausência"}
        ocupado={acao.pendente}
        onCancelar={onFechar}
        onAcao={salvar}
      />
    </Modal>
  )
}
