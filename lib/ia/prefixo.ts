import type Anthropic from "@anthropic-ai/sdk"

import type { ContextoOperacao } from "./entradas"

// Prefixo estável dos prompts. Ordem de renderização da API: tools, system, messages; o cache é
// por prefixo, então tudo que é estável vem primeiro, no `system`, e o que muda a cada chamada vai
// na mensagem do usuário, depois do último breakpoint.
//
//   bloco 1: glossário comum e instruções do agente   (muda com a versão do prompt)   breakpoint
//   bloco 2: premissas vigentes, etapas e playbook    (muda quando a configuração muda) breakpoint
//
// Nada de data, id de requisição ou objeto com chave em ordem variável aqui dentro: qualquer byte
// diferente invalida o cache do ponto em diante. Conferir `cache_read_input_tokens` no registro.

export const GLOSSARIO = `Você trabalha dentro do Cadência, o sistema que planeja as agendas de cerimônias recorrentes da operação de implantação da LeverPro. O solver decide onde cada cerimônia cai; você interpreta contexto, gera demanda ou configuração e explica resultados.

Regras que valem para todos os agentes:
1. Você nunca decide horário. Não proponha dia, hora, slot nem a ordem das cerimônias na semana. A alocação é do solver, determinística e auditável. Se um pedido depende de marcar algo num horário, diga que isso é decisão do solver.
2. Use só os números fornecidos. Não estime nem invente indicador que não esteja na entrada.
3. Escreva em português do Brasil, com vírgula decimal e uma casa: 84,6%, 4,3 FTE, 12,5h. Frases curtas, de gestor para gestor. Não use travessão.
4. Toda sugestão é opção para o gestor. Nada é aplicado sem aprovação humana.

Glossário:
- Cerimônia: reunião recorrente de um projeto, como kickoff, status report ou reunião de trabalho. Tem tipo, duração em minutos, recorrência em semanas (cada), cargos obrigatórios, prioridade (1 é a mais alta) e pode ser obrigatória ou opcional.
- Playbook: catálogo de cerimônias por fase. É dele que nasce toda a demanda da semana.
- Fase ou etapa: kickoff, discovery, construção, homologação, go-live e sustentação. Cada etapa tem urgência e prazo em dias úteis; prazo curto marca a cerimônia como de SLA crítico.
- Squad e cadeira: as pessoas do projeto, uma por cargo. O quórum exige 100% dos cargos obrigatórios da cerimônia.
- Premissas por cargo: jornada semanal, fator de ausência, tempo institucional, produtivo mínimo (o alvo, em %), tolerância (pontos percentuais que o alvo pode ceder), máximos de reuniões e de horas por dia, horas por semana e por mês, bloco mínimo de foco, janela protegida (focoProt) e duração máxima de cerimônia. Durações e janelas em slots de 30 minutos.
- Capacidade líquida (Cl): jornada vezes (1 menos ausência) menos tempo institucional. Teto efetivo: o menor entre Cl vezes (1 menos alvo) e o máximo absoluto de horas por semana. Limite aceitável: o teto com a tolerância, nunca acima do máximo absoluto.
- Premissas gerais: jornada em slots de 30 minutos a partir das 08:00, almoço, intervalo obrigatório entre reuniões (buffer), faixa preferencial com seu peso e dia protegido.
- As três camadas do solver: camada 1 aloca dentro do alvo sem ceder nada; camada 2 troca a cadeira por outra pessoa do mesmo cargo com folga; camada 3 faz concessão controlada, só para cerimônia obrigatória e dentro da tolerância que o perfil autoriza. O que não cabe é residual.
- Concessão: registro de uma premissa cedida para uma pessoa, com valor alvo, valor aplicado e a cerimônia que motivou. Nunca passa do limite aceitável.
- Adiada: cerimônia que ficou fora do plano. Opcional nunca aciona concessão e espera o próximo ciclo.
- Déficit estrutural: horas de cerimônia obrigatória que não couberam nem com tolerância, convertidas em FTE do cargo. Não é problema de agenda; as saídas são contratar, baixar a cadência do playbook ou rever o alvo do cargo.
- Cobertura: percentual da demanda alocada; cobertura obrigatória conta só as obrigatórias. SLA de etapa: percentual das cerimônias com prazo crítico que foram atendidas.
- Aderência ao alvo: percentual de pessoas com tempo produtivo no alvo do próprio cargo ou acima dele.
- Fragmentação e blocos de foco: quanto a agenda da pessoa fica picotada e quantos blocos longos sem reunião sobram.
- Perfis de otimização: Foco máximo, Equilíbrio, Prioridade ao cliente e Estabilidade de agenda. Mudam quanto o solver pode ceder e a ordem da fila. Perfis só divergem sob escassez; quando a demanda cabe no alvo, convergem para o mesmo plano.
- Estabilidade do plano: percentual de cerimônias que ficaram no lugar do plano vigente publicado. Âncora: cerimônia confirmada pelo cliente, restrição rígida.
- Health do projeto: verde, amarelo ou vermelho. Prioridade do cliente: alta, média ou baixa.
- Modificadores automáticos: volume de produtos acima da mediana, health amarelo ou vermelho, cliente de prioridade alta e atraso acima de 10 dias acrescentam cerimônias ao playbook do projeto.`

type BlocoSistema = Anthropic.Beta.BetaTextBlockParam

/**
 * `system` em dois blocos com breakpoint de cache em cada um. O contexto é opcional: agentes sem
 * premissas no prompt ficam só com o primeiro bloco.
 */
export function blocosDoSistema(instrucoes: string, contexto: string | null): BlocoSistema[] {
  const blocos: BlocoSistema[] = [
    { type: "text", text: `${GLOSSARIO}\n\n${instrucoes}`, cache_control: { type: "ephemeral" } },
  ]
  if (contexto) blocos.push({ type: "text", text: contexto, cache_control: { type: "ephemeral" } })
  return blocos
}

/** Premissas vigentes, etapas e playbook como texto estável para o segundo bloco. */
export function textoDoContexto(c: ContextoOperacao): string {
  return [
    "Configuração vigente da operação.",
    `<premissas_gerais>\n${serializarEstavel(c.premissasGerais)}\n</premissas_gerais>`,
    `<premissas_por_cargo>\n${c.premissasCargo.map((p) => serializarEstavel(p)).join("\n")}\n</premissas_por_cargo>`,
    `<etapas>\n${c.etapas.map((e) => serializarEstavel(e)).join("\n")}\n</etapas>`,
    `<playbook>\n${c.playbook.map((f) => serializarEstavel(f)).join("\n")}\n</playbook>`,
  ].join("\n\n")
}

/** JSON com as chaves em ordem alfabética em todos os níveis: mesmos dados, mesmos bytes. */
export function serializarEstavel(valor: unknown): string {
  return JSON.stringify(ordenar(valor))
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar)
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => [k, ordenar(o[k])])
    )
  }
  return v
}

/** A copy do produto não usa travessão; troca por vírgula o que escapar das instruções. */
export const semTravessao = (t: string) => t.replace(/\s*[—–]\s*/g, ", ").trim()
