import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  classificarEvento,
  desdobrarLinhas,
  desescapar,
  lerIcs,
  normalizarEventos,
  prepararEventos,
  type ContextoClassificacao,
} from "@/lib/calendario/ics"
import { janelaDeImportacao, linhasParaGravar, validarEventos } from "@/lib/calendario/importacao"

// Importação da agenda atual por .ics (E09): leitura, normalização, classificação e privacidade.

const FIXTURE = readFileSync(fileURLToPath(new URL("../fixtures/agenda-exemplo.ics", import.meta.url)), "utf8")
/** de segunda, 14/09/2026, a segunda, 12/10/2026, em São Paulo */
const JANELA = { inicio: Date.parse("2026-09-14T00:00:00-03:00"), fim: Date.parse("2026-10-12T00:00:00-03:00") }
const local = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 16).replace("T", " ")
const cal = (...linhas: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...linhas, "END:VCALENDAR"].join("\r\n")
const evento = (...linhas: string[]) => ["BEGIN:VEVENT", ...linhas, "END:VEVENT"]

const leitura = lerIcs(FIXTURE, JANELA)
const doUid = (uid: string) => leitura.eventos.filter((e) => e.uid === uid)

const CTX: ContextoClassificacao = {
  projetos: [
    { nome: "Grupo Aurora A", cliente: "Grupo Aurora" },
    { nome: "Rede Solaris B", cliente: "Rede Solaris" },
  ],
  tipos: ["Kickoff Executivo", "Reunião de Trabalho", "Status Report", "Sessão de Homologação"],
}

describe("leitura do .ics (RFC 5545)", () => {
  it("desdobra linhas e desfaz o escape do texto", () => {
    expect(desdobrarLinhas("SUMMARY:abc\r\n def\r\n\tghi\r\nUID:1\n")).toEqual(["SUMMARY:abcdefghi", "UID:1"])
    expect(desescapar("a\\, b\\; c\\nd\\\\e")).toBe("a, b; c\nd\\e")
  })

  it("lê o arquivo de exemplo: 14 eventos na janela, cancelado e livre de fora", () => {
    expect(leitura.eventos).toHaveLength(14)
    expect(leitura.ignorados).toEqual({ cancelados: 1, livres: 1, semData: 0 })
    expect(leitura.avisos).toEqual([])
    expect(leitura.eventos.some((e) => e.uid === "fora-da-janela@exemplo")).toBe(false)
    expect(leitura.eventos.map((e) => e.inicio)).toEqual([...leitura.eventos.map((e) => e.inicio)].sort((a, b) => a - b))
  })

  it("TZID IANA, participantes sem sala e parâmetro entre aspas com dois-pontos", () => {
    const [ev] = doUid("status-aurora@exemplo")
    expect([local(ev.inicio), local(ev.fim)]).toEqual(["2026-09-15 10:00", "2026-09-15 10:45"])
    expect(ev.titulo).toBe("Status Report - Grupo Aurora")
    expect(ev.participantes).toEqual(["gerente@exemplo.com.br", "analista@exemplo.com.br", "contato@aurora.com.br"])
    expect(ev.externalId).toBe("status-aurora@exemplo")
    expect(ev.recorrente).toBe(false)
  })

  it("UTC com Z e texto escapado", () => {
    const [ev] = doUid("consulta@exemplo")
    expect([local(ev.inicio), local(ev.fim)]).toEqual(["2026-09-16 14:00", "2026-09-16 15:00"])
    expect(ev.titulo).toBe("Consulta médica, retorno; levar exames")
  })

  it("dia inteiro ocupa o dia todo em São Paulo", () => {
    const [ev] = doUid("folga@exemplo")
    expect(ev.diaInteiro).toBe(true)
    expect([local(ev.inicio), local(ev.fim)]).toEqual(["2026-09-18 00:00", "2026-09-19 00:00"])
  })

  it("horário flutuante segue o X-WR-TIMEZONE; linha dobrada no meio da palavra", () => {
    const [ev] = doUid("treinamento@exemplo")
    expect([local(ev.inicio), local(ev.fim)]).toEqual(["2026-09-22 14:00", "2026-09-22 17:00"])
    expect(ev.titulo).toBe("Treinamento interno de ferramentas de dados para o time de implantação")
  })

  it("RRULE semanal com BYDAY e COUNT, no fuso do Windows que o Outlook grava", () => {
    const evs = doUid("um-a-um@exemplo")
    expect(evs.map((e) => local(e.inicio))).toEqual([
      "2026-09-14 09:00",
      "2026-09-16 09:00",
      "2026-09-21 09:00",
      "2026-09-23 09:00",
    ])
    expect(evs[0].externalId).toBe("um-a-um@exemplo|20260914T120000Z")
  })

  it("RRULE diária com UNTIL, EXDATE e ocorrência alterada por RECURRENCE-ID", () => {
    const evs = doUid("alinhamento@exemplo")
    expect(evs.map((e) => local(e.inicio))).toEqual([
      "2026-09-14 08:30",
      "2026-09-15 08:30",
      "2026-09-17 11:00",
      "2026-09-18 08:30",
    ])
    // a alterada guarda o id da ocorrência original (08:30 local, 11:30 UTC)
    expect(evs[2].externalId).toBe("alinhamento@exemplo|20260917T113000Z")
    expect(evs.every((e) => e.fim - e.inicio === 30 * 60_000)).toBe(true)
  })

  it("série sem fim com INTERVAL é expandida só dentro da janela", () => {
    expect(doUid("mentoria@exemplo").map((e) => local(e.inicio))).toEqual(["2026-09-17 16:00", "2026-10-01 16:00"])
  })

  it("UNTIL em série semanal é inclusivo", () => {
    const l = lerIcs(
      cal(
        ...evento(
          "UID:semanal",
          "DTSTART:20260915T110000Z",
          "DTEND:20260915T120000Z",
          "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260924T110000Z"
        )
      ),
      JANELA
    )
    expect(l.eventos.map((e) => local(e.inicio))).toEqual([
      "2026-09-15 08:00",
      "2026-09-17 08:00",
      "2026-09-22 08:00",
      "2026-09-24 08:00",
    ])
  })

  it("EXDATE conta para o COUNT, como no RFC", () => {
    const l = lerIcs(
      cal(
        ...evento(
          "UID:contada",
          "DTSTART;TZID=America/Sao_Paulo:20260914T150000",
          "DURATION:PT1H",
          "RRULE:FREQ=DAILY;COUNT=3",
          "EXDATE;TZID=America/Sao_Paulo:20260915T150000,20260920T150000"
        )
      ),
      JANELA
    )
    expect(l.eventos.map((e) => local(e.inicio))).toEqual(["2026-09-14 15:00", "2026-09-16 15:00"])
  })

  it("mensal não é expandida: só a primeira ocorrência, com aviso", () => {
    const l = lerIcs(
      cal(...evento("UID:mensal", "DTSTART:20260915T130000Z", "DTEND:20260915T140000Z", "RRULE:FREQ=MONTHLY;BYMONTHDAY=15")),
      JANELA
    )
    expect(l.eventos).toHaveLength(1)
    expect(l.avisos[0]).toContain("MONTHLY")
  })

  it("fuso no formato do Outlook, fuso desconhecido e evento sem data", () => {
    const l = lerIcs(
      cal(
        // parâmetro com dois-pontos vem entre aspas (RFC 5545 §3.2), como o Outlook grava
        ...evento(
          "UID:a",
          'DTSTART;TZID="(UTC-03:00) Brasília":20260915T100000',
          'DTEND;TZID="(UTC-03:00) Brasília":20260915T110000'
        ),
        ...evento("UID:b", "DTSTART;TZID=Fuso Inventado:20260916T100000", "DURATION:PT45M"),
        ...evento("UID:c", "SUMMARY:sem data")
      ),
      JANELA
    )
    expect(l.eventos.map((e) => [e.uid, local(e.inicio), local(e.fim)])).toEqual([
      ["a", "2026-09-15 10:00", "2026-09-15 11:00"],
      ["b", "2026-09-16 10:00", "2026-09-16 10:45"],
    ])
    expect(l.avisos.some((a) => a.includes("Fuso Inventado"))).toBe(true)
    expect(l.ignorados.semData).toBe(1)
  })
})

describe("normalização em slots de 30 minutos", () => {
  const n = normalizarEventos(leitura.eventos)

  it("arredonda para fora e prende à janela de trabalho", () => {
    const status = n.find((e) => e.externalId === "status-aurora@exemplo")!
    expect([status.data, status.slotInicio, status.slotFim]).toEqual(["2026-09-15", 4, 6])
    expect([local(status.inicio), local(status.fim)]).toEqual(["2026-09-15 10:00", "2026-09-15 11:00"])
    const folga = n.find((e) => e.externalId === "folga@exemplo")!
    expect([folga.data, folga.slotInicio, folga.slotFim]).toEqual(["2026-09-18", 0, 20])
  })

  it("evento de vários dias vira um pedaço por dia útil, com a data no id", () => {
    const l = lerIcs(
      cal(
        ...evento(
          "UID:viagem",
          "DTSTART;TZID=America/Sao_Paulo:20260918T170000",
          "DTEND;TZID=America/Sao_Paulo:20260921T090000"
        )
      ),
      JANELA
    )
    expect(normalizarEventos(l.eventos).map((e) => [e.externalId, e.slotInicio, e.slotFim])).toEqual([
      ["viagem|2026-09-18", 18, 20],
      ["viagem|2026-09-21", 0, 2],
    ])
  })

  it("o que começa antes das 8h é cortado; o que fica fora da jornada some", () => {
    const l = lerIcs(
      cal(
        ...evento("UID:cedo", "DTSTART;TZID=America/Sao_Paulo:20260915T070000", "DTEND;TZID=America/Sao_Paulo:20260915T083000"),
        ...evento("UID:noite", "DTSTART;TZID=America/Sao_Paulo:20260915T190000", "DTEND;TZID=America/Sao_Paulo:20260915T200000")
      ),
      JANELA
    )
    expect(normalizarEventos(l.eventos).map((e) => [e.externalId, e.slotInicio, e.slotFim])).toEqual([["cedo", 0, 1]])
    // janela de trabalho mais curta que a grade
    expect(normalizarEventos(l.eventos, { inicio: 2, fim: 18 })).toEqual([])
  })
})

describe("classificação", () => {
  const classe = (titulo: string, participantes: string[] = []) => classificarEvento(titulo, participantes, CTX)

  it("cerimônia: cliente ou projeto E tipo do playbook no título", () => {
    expect(classe("Status Report - Grupo Aurora")).toEqual({ classificacao: "cerimonia", projeto: 0, tipo: "Status Report" })
    expect(classe("Sessão de homologação Solaris")).toEqual({
      classificacao: "cerimonia",
      projeto: 1,
      tipo: "Sessão de Homologação",
    })
    // o domínio de um convidado vale como cliente
    expect(classe("Reunião de trabalho", ["ana@exemplo.com.br", "contato@aurora.com.br"])).toMatchObject({
      classificacao: "cerimonia",
      projeto: 0,
      tipo: "Reunião de Trabalho",
    })
  })

  it("só um dos dois não basta", () => {
    expect(classe("Status Report").classificacao).toBe("opaco")
    expect(classe("Almoço com o Grupo Aurora").classificacao).toBe("opaco")
  })

  it("institucional pelas palavras-chave, por palavra inteira", () => {
    expect(classe("1:1 com a liderança").classificacao).toBe("institucional")
    expect(classe("All hands de setembro").classificacao).toBe("institucional")
    expect(classe("RH: benefícios").classificacao).toBe("institucional")
    expect(classe("Rhythm check").classificacao).toBe("opaco")
    expect(classe("Consulta médica").classificacao).toBe("opaco")
  })
})

describe("privacidade: o título nunca sai do navegador", () => {
  it("prepara só os campos do contrato, com o SHA-256 do título", async () => {
    const prontos = await prepararEventos(normalizarEventos(leitura.eventos), CTX, (i) =>
      i === 0 ? "00000000-0000-4000-8000-000000000001" : undefined
    )
    expect(prontos).toHaveLength(14)
    const status = prontos.find((e) => e.externalId === "status-aurora@exemplo")!
    expect(Object.keys(status).sort()).toEqual([
      "cerimoniaTipo",
      "classificacao",
      "externalId",
      "fim",
      "inicio",
      "participantes",
      "projetoId",
      "tituloHash",
    ])
    expect(status).toMatchObject({
      classificacao: "cerimonia",
      participantes: 3,
      projetoId: "00000000-0000-4000-8000-000000000001",
      cerimoniaTipo: "Status Report",
      inicio: "2026-09-15T13:00:00.000Z",
      fim: "2026-09-15T14:00:00.000Z",
    })
    expect(status.tituloHash).toBe(createHash("sha256").update("Status Report - Grupo Aurora").digest("hex"))
    // 1:1 (4), alinhamento interno (4), mentoria (2) e treinamento interno (1)
    expect(prontos.filter((e) => e.classificacao === "institucional")).toHaveLength(11)

    const json = JSON.stringify(prontos)
    leitura.eventos.forEach((e) => {
      expect(json).not.toContain(e.titulo)
      e.participantes.forEach((p) => expect(json).not.toContain(p))
    })
  })

  it("o servidor descarta campo fora do contrato, evento fora da janela e classificação inválida", () => {
    const base = {
      externalId: "a",
      inicio: "2026-09-15T13:00:00.000Z",
      fim: "2026-09-15T14:00:00.000Z",
      participantes: 2,
      classificacao: "opaco",
      tituloHash: "ab".repeat(32),
    }
    const limpos = validarEventos(
      [
        { ...base, titulo: "Segredo", emails: ["x@y.z"], projetoId: "00000000-0000-4000-8000-000000000001" },
        { ...base, externalId: "b", inicio: "2027-01-05T13:00:00.000Z", fim: "2027-01-05T14:00:00.000Z" },
        { ...base, externalId: "c", classificacao: "qualquer" },
        { ...base, externalId: "a" },
      ],
      JANELA
    )
    expect(limpos).toHaveLength(1)
    expect(limpos[0]).not.toHaveProperty("titulo")
    expect(limpos[0].projetoId).toBeNull()
    const linhas = linhasParaGravar("pessoa", "importacao", limpos)
    expect(JSON.stringify(linhas)).not.toContain("Segredo")
    expect(linhas[0]).toEqual({
      pessoa_id: "pessoa",
      provedor: "ics",
      external_id: "a",
      inicio: "2026-09-15T13:00:00.000Z",
      fim: "2026-09-15T14:00:00.000Z",
      opaco: true,
      classificacao: "opaco",
      participantes: 2,
      titulo_hash: "ab".repeat(32),
      projeto_id: null,
      cerimonia_tipo: null,
      importacao_id: "importacao",
    })
  })

  it("janela padrão: da segunda desta semana ao fim do horizonte", () => {
    const j = janelaDeImportacao(13, Date.UTC(2026, 8, 11, 16))
    expect(new Date(j.inicio).toISOString()).toBe("2026-09-07T03:00:00.000Z")
    expect(new Date(j.fim).toISOString()).toBe("2026-12-14T03:00:00.000Z")
  })
})
