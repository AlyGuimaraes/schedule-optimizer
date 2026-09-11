import "server-only"

import { PERFIS } from "@/lib/dominio"

import { chamarAgente, iaDisponivel } from "../cliente"
import {
  CAMPOS_CARGO,
  CAMPOS_GERAIS,
  PropostaOrquestradorV1,
  VERSAO_CONTRATO_ORQUESTRADOR,
  type ItemDiff,
  type PropostaOrquestrada,
  type PropostaOrquestrador,
} from "../contratos/orquestrador"
import type { ContextoOperacao, EntradaOrquestrador } from "../entradas"
import { blocosDoSistema, semTravessao, textoDoContexto } from "../prefixo"

// Orquestrador (§4.5, E20): comando em linguagem natural vira proposta de premissas, perfil ou
// peso, em forma de diff contra a configuração vigente. Nunca aplica: a proposta volta como
// rascunho (`aplicada: false`) para o motor simular e o gestor aprovar. Ainda sem tool runner nem
// interface de comando. Sem chave, ou se a chamada falhar, devolve null.

export const VERSAO_PROMPT_ORQUESTRADOR = "orquestrador/2026-09-11.1"

const INSTRUCOES = `Você é o Orquestrador do Cadência. Traduz um comando do gestor numa proposta de alteração de configuração: premissas por cargo, premissas gerais, perfil de otimização ou peso de estabilidade. A proposta é um rascunho que passa pelo motor e por aprovação humana.

Campos e unidades:
- escopo cargo (informe o nome exato do cargo): produtivoMin e tolerancia em pontos percentuais; maxReunioesDia em reuniões; maxHorasDia, maxHorasSemana e maxHorasMes em horas; blocoFocoMin, focoProt (janela protegida) e duracaoMax em slots de 30 minutos.
- escopo geral: pesoPreferencia (número), buffer (slots de intervalo entre reuniões), diaProtegido (nenhum, sexta-tarde ou sexta).
- escopo perfil: campo perfil, valor foco, equilibrio, cliente ou estabilidade.
- escopo peso: campo pesoEstabilidade, de 0 a 20 (padrão 3).

Proponha o menor conjunto de alterações que realiza a intenção. Se o comando pede um horário ou lugar específico para uma cerimônia, uma vigência por data, ou qualquer coisa que esses campos não expressam, não force: explique em foraDoEscopo e proponha só a parte que a configuração expressa. Liste em riscos o que a alteração pode custar em cobertura, déficit ou concessões.`

export async function orquestrar(entrada: EntradaOrquestrador): Promise<PropostaOrquestrada | null> {
  if (!iaDisponivel()) return null

  const r = await chamarAgente({
    agente: "orquestrador",
    versaoPrompt: `${VERSAO_PROMPT_ORQUESTRADOR}+${VERSAO_CONTRATO_ORQUESTRADOR}`,
    schema: PropostaOrquestradorV1,
    sistema: blocosDoSistema(INSTRUCOES, textoDoContexto(entrada.contexto)),
    mensagem: [
      `Perfil atual: ${entrada.perfilAtual}. Peso de estabilidade atual: ${entrada.pesoEstabilidade}.`,
      `<comando>\n${entrada.comando}\n</comando>`,
    ].join("\n\n"),
    maxTokens: 16_000,
    entrada,
  })
  if (!r.ok) return null

  const { itens, descartadas } = montarDiff(r.dados, entrada)
  return {
    interpretacao: semTravessao(r.dados.interpretacao),
    itens,
    descartadas,
    riscos: r.dados.riscos.map(semTravessao),
    foraDoEscopo: r.dados.foraDoEscopo ? semTravessao(r.dados.foraDoEscopo) : null,
    aplicada: false,
    modelo: r.modelo,
  }
}

const DIAS_PROTEGIDOS = ["nenhum", "sexta-tarde", "sexta"]
const PERCENTUAIS = new Set<string>(["produtivoMin", "tolerancia"])

/**
 * Diff da proposta contra a configuração vigente. Descarta, com o motivo, o que não passa: cargo
 * inexistente, campo fora do escopo, valor de tipo ou faixa errada, ou valor igual ao atual.
 */
export function montarDiff(
  proposta: PropostaOrquestrador,
  vigente: { contexto: ContextoOperacao; perfilAtual: string; pesoEstabilidade: number }
): Pick<PropostaOrquestrada, "itens" | "descartadas"> {
  const itens: ItemDiff[] = []
  const descartadas: PropostaOrquestrada["descartadas"] = []

  for (const a of proposta.alteracoes) {
    const descartar = (razao: string) => descartadas.push({ campo: a.campo, cargo: a.cargo, razao })
    let atual: number | string | null = null

    if (a.escopo === "cargo") {
      const premissa = vigente.contexto.premissasCargo.find((p) => p.cargo === a.cargo)
      if (!premissa) {
        descartar("cargo inexistente")
        continue
      }
      if (!(CAMPOS_CARGO as readonly string[]).includes(a.campo)) {
        descartar("campo não é premissa de cargo")
        continue
      }
      if (typeof a.valor !== "number" || !Number.isFinite(a.valor) || a.valor < 0) {
        descartar("valor precisa ser um número não negativo")
        continue
      }
      if (PERCENTUAIS.has(a.campo) && a.valor > 100) {
        descartar("percentual acima de 100")
        continue
      }
      atual = premissa[a.campo as (typeof CAMPOS_CARGO)[number]]
    } else if (a.escopo === "geral") {
      if (!(CAMPOS_GERAIS as readonly string[]).includes(a.campo)) {
        descartar("campo não é premissa geral alterável")
        continue
      }
      if (a.campo === "diaProtegido") {
        if (typeof a.valor !== "string" || !DIAS_PROTEGIDOS.includes(a.valor)) {
          descartar("dia protegido inválido")
          continue
        }
      } else if (typeof a.valor !== "number" || !Number.isFinite(a.valor) || a.valor < 0) {
        descartar("valor precisa ser um número não negativo")
        continue
      }
      atual = vigente.contexto.premissasGerais[a.campo as (typeof CAMPOS_GERAIS)[number]]
    } else if (a.escopo === "perfil") {
      if (a.campo !== "perfil" || typeof a.valor !== "string" || !(a.valor in PERFIS)) {
        descartar("perfil inválido")
        continue
      }
      atual = vigente.perfilAtual
    } else {
      if (a.campo !== "pesoEstabilidade" || typeof a.valor !== "number" || a.valor < 0 || a.valor > 20) {
        descartar("peso de estabilidade inválido")
        continue
      }
      atual = vigente.pesoEstabilidade
    }

    if (atual === a.valor) {
      descartar("igual ao valor vigente")
      continue
    }
    itens.push({
      escopo: a.escopo,
      cargo: a.escopo === "cargo" ? a.cargo : null,
      campo: a.campo,
      atual,
      proposto: a.valor,
      motivo: semTravessao(a.motivo),
    })
  }
  return { itens, descartadas }
}
