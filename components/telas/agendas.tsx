"use client"

import { useEffect, useMemo, useState } from "react"

import type { Contexto } from "@/components/cadencia/com-dados"
import { Confirmacao, EditorCab, EditorPe, Modal } from "@/components/cadencia/modal"
import { Aviso, IconeMais, SecCab, Selo } from "@/components/cadencia/primitivas"
import {
  classificarEvento,
  lerIcs,
  normalizarEventos,
  prepararEventos,
  type ContextoClassificacao,
  type EventoNormalizado,
  type LeituraIcs,
} from "@/lib/calendario/ics"
import { janelaDeImportacao, type ResumoImportacao } from "@/lib/calendario/importacao"
import { importarIcs, limparImportacao, resumoImportacoes } from "@/lib/dados/importacao"
import type { ClassificacaoEvento } from "@/lib/dados/mapeador"
import { dataDoDia, dataLocal, geralDe, type Mundo } from "@/lib/dominio"
import { useAcao } from "@/lib/estado/acao"
import { useCadencia } from "@/lib/estado/cadencia"

// Agenda atual importada por .ics (E09), a alternativa sem integração com o Outlook. O arquivo é
// lido neste navegador e só início, fim, número de participantes, id e hash do título vão ao banco.
// Compromisso de fora bloqueia a pessoa no otimizador; cerimônia reconhecida não, porque é ele
// quem planeja as cerimônias.

const SEMANAS = [4, 8, 13] as const
const MAX_BYTES = 5 * 1024 * 1024

const dataBr = (ms: number) => {
  const d = dataLocal(ms)
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}
/** período com fim exclusivo, como as janelas: o último dia é o anterior ao fim */
const periodo = (inicio: number, fim: number) => `${dataBr(inicio)} a ${dataBr(fim - 1)}`
const quando = (iso: string) => {
  const t = new Date(Date.parse(iso) - 3 * 3_600_000).toISOString()
  return `${t.slice(8, 10)}/${t.slice(5, 7)} às ${t.slice(11, 16)}`
}

function contextoDe(mundo: Mundo): ContextoClassificacao {
  return {
    projetos: mundo.projetos.map((p) => ({ nome: p.nome, cliente: p.cliente })),
    tipos: [...new Set(Object.values(mundo.playbook).flatMap((cs) => cs.map((c) => c.tipo)))],
  }
}

export function AbaAgendas({ ctx }: { ctx: Contexto }) {
  const { mundo, config, indices } = ctx
  const dados = useCadencia((s) => s.dadosAtuais)
  const [resumo, setResumo] = useState<ResumoImportacao[] | null>(null)
  const [erroResumo, setErroResumo] = useState<string | null>(null)
  const [importando, setImportando] = useState<{ pessoa: string | null } | null>(null)
  const [limpando, setLimpando] = useState<number | null>(null)
  const limpeza = useAcao()

  // o resumo volta do banco a cada recarga do mundo, que acontece depois de toda gravação
  useEffect(() => {
    let vivo = true
    resumoImportacoes().then((r) => {
      if (!vivo) return
      if (r.ok) {
        setResumo(r.dados)
        setErroResumo(null)
      } else setErroResumo(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [dados])

  const cal = config.calendario
  const fimHorizonte = cal ? Date.parse(`${dataDoDia(cal.inicio, config.horizonte, 4)}T18:00:00-03:00`) : null
  const doIcs = (p: number) => resumo?.find((r) => r.pessoaId === indices.pessoas[p] && r.provedor === "ics")
  const comAgenda = mundo.pessoas.filter((p) => doIcs(p.id)).length
  const alvo = limpando !== null ? mundo.pessoas[limpando] : null
  const resumoAlvo = limpando !== null ? doIcs(limpando) : undefined
  const totalAlvo = resumoAlvo ? resumoAlvo.cerimonia + resumoAlvo.institucional + resumoAlvo.opaco : 0

  return (
    <section className="sec">
      <SecCab
        titulo="Agendas importadas"
        apoio={
          <>
            {resumo ? `${comAgenda} de ${mundo.pessoas.length} pessoas com agenda importada` : "carregando o resumo"}
            <button type="button" className="btn" onClick={() => setImportando({ pessoa: null })}>
              <IconeMais />
              Importar .ics
            </button>
          </>
        }
      />
      <p className="nota" style={{ marginBottom: 12 }}>
        O arquivo é lido neste navegador: ao banco vão só início, fim, número de participantes, um identificador e um
        hash do título. Compromissos de fora viram bloqueio: o otimizador não marca cerimônia por cima nem colada neles,
        e esse tempo deixa de contar como foco. Reunião reconhecida como cerimônia de projeto, com cliente e tipo do
        playbook no título, não bloqueia, porque o próprio otimizador a planeja. Na Agenda, com uma pessoa selecionada,
        os compromissos aparecem hachurados.
      </p>

      {erroResumo ? <Aviso titulo="Resumo das importações indisponível">{erroResumo}</Aviso> : null}

      <div className="rolagem" style={{ maxHeight: "none" }}>
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Cargo</th>
              <th className="n">Cerimônias</th>
              <th className="n">Institucionais</th>
              <th className="n">Compromissos</th>
              <th>Janela importada</th>
              <th>Importada em</th>
              <th>Situação</th>
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {mundo.pessoas.map((p) => {
              const r = doIcs(p.id)
              const inicio = r?.janelaInicio ? Date.parse(r.janelaInicio) : null
              const fim = r?.janelaFim ? Date.parse(r.janelaFim) : null
              const curta = fim !== null && fimHorizonte !== null && fim < fimHorizonte
              return (
                <tr key={p.id}>
                  <td>
                    <b>{p.nome}</b>
                  </td>
                  <td className="meta">{p.papel}</td>
                  <td className="n">{r ? r.cerimonia : ""}</td>
                  <td className="n">{r ? r.institucional : ""}</td>
                  <td className="n">{r ? r.opaco : ""}</td>
                  <td className="mono">{inicio !== null && fim !== null ? periodo(inicio, fim) : ""}</td>
                  <td className="mono">{r?.importadoEm ? quando(r.importadoEm) : ""}</td>
                  <td>
                    {!r ? (
                      <Selo tom="neutro">sem agenda</Selo>
                    ) : curta ? (
                      <Selo tom="aviso">não cobre o horizonte</Selo>
                    ) : (
                      <Selo tom="ok">cobre o horizonte</Selo>
                    )}
                  </td>
                  <td>
                    <span className="acoes">
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => setImportando({ pessoa: indices.pessoas[p.id] })}
                      >
                        {r ? "reimportar" : "importar"}
                      </button>
                      {r ? (
                        <button type="button" className="mini-btn perigo" onClick={() => setLimpando(p.id)}>
                          limpar
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

      {importando ? (
        <EditorImportacao ctx={ctx} pessoaInicial={importando.pessoa} onFechar={() => setImportando(null)} />
      ) : null}

      <Confirmacao
        aberto={alvo !== null}
        titulo={`Limpar a agenda importada de ${alvo?.nome ?? ""}?`}
        acao="Limpar agenda"
        erro={limpeza.erro}
        ocupado={limpeza.pendente}
        texto={`${totalAlvo} evento(s) importado(s) saem do banco. Os horários voltam a ficar livres para o otimizador e o plano é recalculado.`}
        onFechar={() => {
          setLimpando(null)
          limpeza.setErro(null)
        }}
        onConfirmar={() =>
          alvo &&
          limpeza.executar(() => limparImportacao(indices.pessoas[alvo.id]), "agenda importada removida, cenário replanejado", () =>
            setLimpando(null)
          )
        }
      />
    </section>
  )
}

type Previa =
  | { ok: true; leitura: LeituraIcs; normalizados: EventoNormalizado[]; contagem: Record<ClassificacaoEvento, number> }
  | { ok: false; erro: string }

function EditorImportacao({
  ctx,
  pessoaInicial,
  onFechar,
}: {
  ctx: Contexto
  pessoaInicial: string | null
  onFechar: () => void
}) {
  const { mundo, config, indices } = ctx
  const [pessoa, setPessoa] = useState(pessoaInicial ?? indices.pessoas[0] ?? "")
  const [semanas, setSemanas] = useState<number>(13)
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string } | null>(null)
  const [agora] = useState(() => Date.now())
  const acao = useAcao()
  const G = geralDe(config)
  const contexto = useMemo(() => contextoDe(mundo), [mundo])
  const janela = useMemo(() => janelaDeImportacao(semanas, agora), [semanas, agora])

  const previa = useMemo<Previa | null>(() => {
    if (!arquivo) return null
    try {
      const leitura = lerIcs(arquivo.texto, janela)
      const normalizados = normalizarEventos(leitura.eventos, { inicio: G.inicio, fim: G.fim })
      const contagem: Record<ClassificacaoEvento, number> = { cerimonia: 0, institucional: 0, opaco: 0 }
      normalizados.forEach((e) => contagem[classificarEvento(e.titulo, e.participantes, contexto).classificacao]++)
      return { ok: true, leitura, normalizados, contagem }
    } catch (e) {
      return { ok: false, erro: `Não foi possível ler o arquivo: ${e instanceof Error ? e.message : String(e)}` }
    }
  }, [arquivo, janela, G.inicio, G.fim, contexto])

  const escolher = (f: File | undefined) => {
    acao.setErro(null)
    setArquivo(null)
    if (!f) return
    if (f.size > MAX_BYTES) {
      acao.setErro("Arquivo acima de 5 MB. Exporte um período menor.")
      return
    }
    f.text().then(
      (texto) => {
        if (!/BEGIN:VCALENDAR/i.test(texto)) acao.setErro("Não parece um arquivo .ics: falta o cabeçalho VCALENDAR.")
        else setArquivo({ nome: f.name, texto })
      },
      () => acao.setErro("Não foi possível ler o arquivo.")
    )
  }

  const importar = () => {
    if (!pessoa) return acao.setErro("Escolha a pessoa.")
    if (!previa) return acao.setErro("Escolha o arquivo .ics exportado do Outlook ou do Google Agenda.")
    if (!previa.ok) return acao.setErro(previa.erro)
    const { normalizados } = previa
    acao.executar(
      async () => {
        try {
          const eventos = await prepararEventos(normalizados, contexto, (i) => indices.projetos[i])
          return await importarIcs(pessoa, eventos, {
            inicio: new Date(janela.inicio).toISOString(),
            fim: new Date(janela.fim).toISOString(),
          })
        } catch (e) {
          return { ok: false as const, erro: e instanceof Error ? e.message : String(e) }
        }
      },
      "agenda importada, cenário replanejado",
      onFechar
    )
  }

  const blocos = previa?.ok ? previa.normalizados : []
  const primeiro = blocos.length ? Math.min(...blocos.map((b) => b.inicio)) : 0
  const ultimo = blocos.length ? Math.max(...blocos.map((b) => b.fim)) : 0

  return (
    <Modal aberto largura={640} onFechar={onFechar} rotulo="Importar agenda">
      <EditorCab titulo="Importar agenda (.ics)" meta="lido neste navegador; o título não sai daqui" />
      <div className="form">
        <div className="campo l2">
          <label htmlFor="imPessoa">Pessoa</label>
          <select id="imPessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            {mundo.pessoas.map((p) => (
              <option key={p.id} value={indices.pessoas[p.id]}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo l2">
          <label htmlFor="imSemanas">Semanas do horizonte</label>
          <select id="imSemanas" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            {SEMANAS.map((s) => (
              <option key={s} value={s}>
                {s} semanas
              </option>
            ))}
          </select>
          <span className="dica">Janela de {periodo(janela.inicio, janela.fim)}, a partir da semana atual.</span>
        </div>
        <div className="campo l4">
          <label htmlFor="imArquivo">Arquivo .ics</label>
          <input id="imArquivo" type="file" accept=".ics,text/calendar" onChange={(e) => escolher(e.target.files?.[0])} />
          <span className="dica">
            No Outlook, Salvar calendário; no Google Agenda, Configurações, Importar e exportar. Reimportar substitui o
            que havia desta pessoa dentro da janela.
          </span>
        </div>
        {previa?.ok && arquivo ? (
          <div className="l4">
            <SecCab titulo="Prévia" apoio={arquivo.nome} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Selo tom="acento">{previa.contagem.cerimonia} cerimônias reconhecidas</Selo>
              <Selo tom="neutro">{previa.contagem.institucional} institucionais</Selo>
              <Selo tom="aviso">{previa.contagem.opaco} compromissos</Selo>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>Janela importada</td>
                  <td className="n">{periodo(janela.inicio, janela.fim)}</td>
                </tr>
                <tr>
                  <td>Eventos do arquivo na janela</td>
                  <td className="n">{previa.leitura.eventos.length}</td>
                </tr>
                <tr>
                  <td>Blocos na grade, em dias úteis e na jornada</td>
                  <td className="n">{blocos.length}</td>
                </tr>
                <tr>
                  <td>Do primeiro ao último bloco</td>
                  <td className="n">{blocos.length ? periodo(primeiro, ultimo) : "nenhum"}</td>
                </tr>
                <tr>
                  <td>Ignorados no arquivo</td>
                  <td className="n">
                    {previa.leitura.ignorados.cancelados} cancelados, {previa.leitura.ignorados.livres} livres,{" "}
                    {previa.leitura.ignorados.semData} sem data
                  </td>
                </tr>
              </tbody>
            </table>
            {previa.leitura.avisos.map((a) => (
              <p key={a} className="nota" style={{ marginTop: 6 }}>
                {a}
              </p>
            ))}
            <p className="meta" style={{ marginTop: 8 }}>
              Cerimônia reconhecida não bloqueia: o otimizador a planeja. Institucionais e compromissos bloqueiam a pessoa
              no horário deles.
            </p>
          </div>
        ) : null}
      </div>
      <EditorPe
        erro={acao.erro ?? (previa && !previa.ok ? previa.erro : null)}
        acao={previa?.ok ? `Importar ${blocos.length} blocos` : "Importar"}
        ocupado={acao.pendente}
        onCancelar={onFechar}
        onAcao={importar}
      />
    </Modal>
  )
}
