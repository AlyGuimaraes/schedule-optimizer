import { n1, pc } from "@/lib/formato"

import type { ResumoExecucao } from "./entradas"

// Leitura determinística do Otimizador ("Leitura do agente", §7.3). Era montada direto no JSX da
// tela; agora é uma função pura usada pela tela e como reserva do Narrador quando a IA não está
// disponível. O texto e os destaques são os mesmos do protótipo, espaço por espaço.

export interface TrechoLeitura {
  texto: string
  /** renderizado em negrito */
  destaque?: boolean
}

export function leituraDeterministica(r: ResumoExecucao): TrechoLeitura[] {
  const t: TrechoLeitura[] = []
  const simples = (texto: string) => t.push({ texto })
  const negrito = (texto: string) => t.push({ texto, destaque: true })
  const c = r.cobertura

  simples("Com o perfil ")
  negrito(r.perfil.rotulo)
  simples(", o plano cobre ")
  negrito(pc(c.total))
  simples(` da demanda do playbook (${pc(c.obrigatoria)} das obrigatórias) e mantém `)
  negrito(pc(r.indicadores.otimizado.aderencia))
  simples(" do time dentro do alvo do próprio cargo. ")
  simples(
    c.relaxadas
      ? `Para chegar lá, ${c.relaxadas} cerimônia(s) foram alocadas com concessão: ${r.concessoes.porPremissa
          .map((p) => `${p.qtd} de ${p.premissa}`)
          .join(", ")}.`
      : "Nenhuma premissa precisou ser cedida."
  )
  simples(" ")
  if (r.adiadas.total) {
    simples("Sobraram ")
    negrito(`${r.adiadas.total} cerimônia(s)`)
    simples(" fora do plano")
    if (r.deficit.fte > 0) {
      simples(", o equivalente a ")
      negrito(`${n1(r.deficit.fte)} FTE`)
      simples(r.deficit.gargalo !== null ? ` em ${r.deficit.gargalo}` : "")
    } else {
      simples(", todas opcionais")
    }
    simples(".")
  } else {
    simples("Toda a demanda do playbook coube no plano.")
  }
  simples(" ")
  simples(r.trocas ? `A camada 2 resolveu ${r.trocas} caso(s) apenas trocando a cadeira.` : "")

  return juntar(t)
}

/** Texto corrido da leitura, sem marcação. */
export const textoLeitura = (trechos: TrechoLeitura[]) => trechos.map((x) => x.texto).join("")

/** Junta trechos vizinhos do mesmo tipo e descarta os vazios. */
function juntar(trechos: TrechoLeitura[]): TrechoLeitura[] {
  const saida: TrechoLeitura[] = []
  for (const x of trechos) {
    if (!x.texto) continue
    const ultimo = saida[saida.length - 1]
    if (ultimo && !ultimo.destaque === !x.destaque) ultimo.texto += x.texto
    else saida.push({ ...x })
  }
  return saida
}
