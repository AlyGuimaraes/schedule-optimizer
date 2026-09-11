import type { Config, Mundo, Simulacao } from "@/lib/dominio"

import type { Cenario } from "@/lib/estado/cadencia"

type Linha = [string, string, string, number, number, number]

const CABECALHO = ["recorte", "nome", "detalhe", "reunioes_mes", "horas_agenda_mes", "pessoa_hora_mes"]

/**
 * Relatório mensal de reuniões por pessoa, cargo, projeto e etapa (critério 7 do §13).
 * Projeta o horizonte simulado para um mês (× 4,33 / H), como os indicadores da tela.
 */
export function relatorioMensal({
  mundo,
  config,
  simulacao,
  cenario,
}: {
  mundo: Mundo
  config: Config
  simulacao: Simulacao
  cenario: Cenario
}): string[][] {
  const F = 4.33 / config.horizonte
  const soma = new Map<string, { detalhe: string; reunioes: number; horas: number; ph: number }>()
  const somar = (chave: string, detalhe: string, horas: number, ph: number) => {
    const atual = soma.get(chave) ?? { detalhe, reunioes: 0, horas: 0, ph: 0 }
    atual.reunioes += F
    atual.horas += horas * F
    atual.ph += ph * F
    soma.set(chave, atual)
  }

  simulacao.semanas.forEach((w) => {
    const r = cenario === "otm" ? w.otm : w.base
    r.alocadas.forEach((ev) => {
      const h = ev.dur / 60
      const ph = h * ev.participantes.length
      somar(`projeto|${ev.projeto}`, mundo.etapas[ev.fase]?.rotulo ?? ev.fase, h, ph)
      somar(`etapa|${mundo.etapas[ev.fase]?.rotulo ?? ev.fase}`, "", h, ph)
      ev.participantes.forEach((p) => {
        const pessoa = mundo.pessoas[p]
        somar(`pessoa|${pessoa.nome}`, pessoa.papel, h, h)
        somar(`cargo|${pessoa.papel}`, "", h, h)
      })
    })
  })

  const ordem = ["pessoa", "cargo", "projeto", "etapa"]
  const linhas: Linha[] = [...soma.entries()]
    .map(([chave, v]) => {
      const [recorte, nome] = chave.split("|")
      return [recorte, nome, v.detalhe, Math.round(v.reunioes), +v.horas.toFixed(1), +v.ph.toFixed(1)] as Linha
    })
    .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]) || a[1].localeCompare(b[1]))

  return [CABECALHO, ...linhas.map((l) => l.map((x) => (typeof x === "number" ? String(x).replace(".", ",") : x)))]
}

export function paraCsv(linhas: string[][]): string {
  const campo = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  // ponto e vírgula, porque o Excel em pt-BR usa vírgula como decimal
  return "﻿" + linhas.map((l) => l.map(campo).join(";")).join("\n")
}

export function baixarCsv(linhas: string[][], nome = `cadencia-relatorio-mensal-${new Date().toISOString().slice(0, 7)}.csv`) {
  const blob = new Blob([paraCsv(linhas)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
