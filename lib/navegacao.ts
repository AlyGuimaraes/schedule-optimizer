import {
  Activity,
  Archive,
  CalendarDays,
  ChartColumnBig,
  ChartNoAxesColumn,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"

export const GRUPOS = ["Operação", "Base"] as const

export type Tela = {
  slug: string
  href: string
  titulo: string
  subtitulo: string
  grupo: (typeof GRUPOS)[number]
  icone: LucideIcon
  /** etapa do docs/PLANO-DE-EXECUCAO.md que entrega o conteúdo da tela */
  etapa: string
  secoes: string[]
}

// Ordem, títulos e subtítulos idênticos ao protótipo (TELAS em docs/referencia/cadencia-leverpro.html).
export const TELAS: Tela[] = [
  {
    slug: "cockpit",
    href: "/cockpit",
    titulo: "Cockpit",
    subtitulo: "Visão consolidada da operação de implantação",
    grupo: "Operação",
    icone: Activity,
    etapa: "E10",
    secoes: [
      "Faixa com seis indicadores: tempo produtivo, aderência ao alvo, cobertura do playbook, reunião por pessoa no mês, déficit de capacidade em FTE e cerimônias adiadas",
      "Mapa de calor de carga por pessoa e dia, relativo ao máximo diário do cargo",
      "Ocupação do teto por cargo, com o marcador do limite",
      "Portfólio por fase e pessoa-hora por tipo de cerimônia",
    ],
  },
  {
    slug: "agenda",
    href: "/agenda",
    titulo: "Agenda",
    subtitulo: "Grade por pessoa ou por cliente, semanal e mensal",
    grupo: "Operação",
    icone: CalendarDays,
    etapa: "E11",
    secoes: [
      "Grade semanal com linhas de 31px por meia hora e visão mensal cobrindo o horizonte",
      "Filtros Pessoas e Clientes de seleção múltipla, com busca, selecionar todos e limpar",
      "Cerimônias simultâneas em faixas lado a lado, concessão em borda tracejada",
      "Painel lateral individual, de projeto ou agregado, conforme a seleção",
    ],
  },
  {
    slug: "otimizador",
    href: "/otimizador",
    titulo: "Otimizador",
    subtitulo: "Cenário, execução em camadas e desejado contra possível",
    grupo: "Operação",
    icone: ChartNoAxesColumn,
    etapa: "E12",
    secoes: [
      "Seis indicadores do cenário",
      "Configuração: horizonte, perfil, rebalanceamento e o que o perfil autoriza ceder",
      "Execução camada a camada e leitura do agente",
      "Abas Resultado, Concessões, Trocas de cadeira e Não atendida",
    ],
  },
  {
    slug: "projetos",
    href: "/projetos",
    titulo: "Projetos",
    subtitulo: "Portfólio, produtos e horas de cerimônia por etapa",
    grupo: "Base",
    icone: Archive,
    etapa: "E05",
    secoes: [
      "Horas de reunião por etapa, com urgência, prazo e participação nas horas",
      "Lista com busca por cliente e filtros por time e por fase",
      "Criação, edição e exclusão em modal, com squad pelos cargos que a fase exige",
    ],
  },
  {
    slug: "time",
    href: "/time",
    titulo: "Time",
    subtitulo: "Capacidade e carga contra o teto de cada cargo",
    grupo: "Base",
    icone: Users,
    etapa: "E06",
    secoes: [
      "Aba Pessoas: capacidade, teto, carga, foco, fragmentação e orçamento mensal",
      "Aba Times: composição por cargo, ocupação e cobertura das etapas",
      "Aba Cargos: criar, renomear com propagação e excluir com trava",
      "Saída de pessoa e redistribuição explícita da alocação",
    ],
  },
  {
    slug: "premissas",
    href: "/premissas",
    titulo: "Premissas",
    subtitulo: "Gerais, por cargo, urgência e playbook",
    grupo: "Base",
    icone: SlidersHorizontal,
    etapa: "E07",
    secoes: [
      "Gerais: jornada, almoço, intervalo, dia protegido e faixa de horários preferenciais",
      "Por cargo: matriz de doze campos com cinco colunas calculadas",
      "Urgência: etapas editáveis e peso por prioridade de cliente",
      "Playbook: catálogo editável de cerimônias por etapa",
    ],
  },
  {
    slug: "indicadores",
    href: "/indicadores",
    titulo: "Indicadores",
    subtitulo: "Séries do horizonte e consolidado mensal",
    grupo: "Base",
    icone: ChartColumnBig,
    etapa: "E08",
    secoes: [
      "Seis métricas mensais e séries por semana",
      "Quadro de pessoal por cargo, com saldo em FTE e recomendação",
      "Capacidade por time",
      "Taxa de reunião por cargo e consolidado mensal",
    ],
  },
]

export function telaDoCaminho(pathname: string): Tela {
  return (
    TELAS.find(
      (t) => pathname === t.href || pathname.startsWith(`${t.href}/`)
    ) ?? TELAS[0]
  )
}

export function telaPorSlug(slug: string): Tela {
  const tela = TELAS.find((t) => t.slug === slug)
  if (!tela) throw new Error(`Tela desconhecida: ${slug}`)
  return tela
}
