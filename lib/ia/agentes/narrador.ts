import "server-only"

import { chamarAgente, iaDisponivel } from "../cliente"
import {
  SaidaNarradorV1,
  VERSAO_CONTRATO_NARRADOR,
  type AlertaNarrador,
  type Narracao,
} from "../contratos/narrador"
import type { EntradaNarrador } from "../entradas"
import { leituraDeterministica, textoLeitura } from "../leitura-deterministica"
import { blocosDoSistema, semTravessao, serializarEstavel, textoDoContexto } from "../prefixo"

// Narrador (§4.5, E20): explica o plano e os trade-offs para o gestor. Entrada: o resumo da
// execução do otimizador e o contexto vigente. Saída: resumo executivo e alertas. Sem chave, ou
// se a chamada falhar, devolve a leitura determinística na hora.

export const VERSAO_PROMPT_NARRADOR = "narrador/2026-09-11.1"

const INSTRUCOES = `Você é Levi, o narrador do Cadência. Recebe o resumo de uma execução do otimizador (semana 1 do horizonte) e escreve para o gestor da operação.

resumo: um parágrafo de no máximo 120 palavras. Diga o que o plano entrega (cobertura total e das obrigatórias, aderência ao alvo), o que custou (concessões e trocas de cadeira) e o que sobrou (adiadas e déficit, e em que cargo se concentra). Compare com a agenda atual só quando a diferença mudar a leitura.

alertas: de zero a quatro, só o que pede decisão. Candidatos: SLA de etapa abaixo de 100%, cerimônia obrigatória adiada, déficit acima de 0,5 FTE num cargo, pessoas acima do limite aceitável, estabilidade abaixo de 80% quando houver plano vigente. Quando nada pede decisão, a lista fica vazia. Cada alerta pode apontar uma alavanca de configuração (contratar, baixar a cadência do playbook, rever o alvo do cargo, trocar o perfil), sempre como opção.

A leitura determinística vem junto como referência de números; não a repita palavra por palavra.`

/** Reserva: a leitura que a tela já mostra, em texto corrido. */
export function narracaoDeterministica(entrada: EntradaNarrador): Narracao {
  return {
    origem: "deterministica",
    resumo: textoLeitura(leituraDeterministica(entrada.resumo)).trim(),
    alertas: [],
    modelo: null,
  }
}

export async function narrar(entrada: EntradaNarrador): Promise<Narracao> {
  const reserva = narracaoDeterministica(entrada)
  if (!iaDisponivel()) return reserva

  const r = await chamarAgente({
    agente: "narrador",
    versaoPrompt: `${VERSAO_PROMPT_NARRADOR}+${VERSAO_CONTRATO_NARRADOR}`,
    schema: SaidaNarradorV1,
    sistema: blocosDoSistema(INSTRUCOES, textoDoContexto(entrada.contexto)),
    mensagem: [
      `<resumo_da_execucao>\n${serializarEstavel(entrada.resumo)}\n</resumo_da_execucao>`,
      `<leitura_deterministica>\n${reserva.resumo}\n</leitura_deterministica>`,
      "Escreva o resumo executivo e os alertas desta execução.",
    ].join("\n\n"),
    maxTokens: 16_000,
    entrada,
    cenarioId: entrada.cenarioId ?? null,
  })
  if (!r.ok) return reserva

  const resumo = semTravessao(r.dados.resumo)
  if (!resumo) return reserva
  return {
    origem: "ia",
    modelo: r.modelo,
    resumo,
    alertas: r.dados.alertas.slice(0, 4).map(
      (a): AlertaNarrador => ({
        gravidade: a.gravidade,
        titulo: semTravessao(a.titulo).replace(/[.;:]+$/, ""),
        detalhe: semTravessao(a.detalhe),
      })
    ),
  }
}
