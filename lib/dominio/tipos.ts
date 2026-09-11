// Tipos do motor de domínio. Espelham o protótipo (docs/referencia/cadencia-leverpro.html),
// que continua sendo a referência numérica: o teste de paridade compara os dois.

export type Papel = string
export type Health = "verde" | "amarelo" | "vermelho"
export type Prioridade = "alta" | "media" | "baixa"
export type DiaProtegido = "nenhum" | "sexta-tarde" | "sexta"
export type PerfilId = "foco" | "equilibrio" | "cliente" | "estabilidade"

/** Premissas por cargo como são editadas na tela. Durações em slots de 30 min, horas em horas. */
export interface PremissasCargoEntrada {
  jornada: number
  fatorAusencia: number
  tempoInstitucional: number
  produtivoMin: number
  tolerancia: number
  maxReunioesDia: number
  maxHorasDia: number
  maxHorasSemana: number
  maxHorasMes: number
  blocoFocoMin: number
  focoProt: number
  duracaoMax: number
}

/** Premissas por cargo com as cinco colunas calculadas (§5). */
export interface PremissasCargo extends PremissasCargoEntrada {
  /** capacidade líquida: jornada × (1 − ausência) − institucional */
  Cl: number
  /** teto vindo só do alvo percentual */
  tetoAlvo: number
  /** menor entre o teto do alvo e o máximo absoluto de horas por semana */
  teto: number
  /** limite aceitável: alvo menos tolerância, nunca acima do máximo absoluto */
  tetoMax: number
  limitadoPorHoras: boolean
}

export interface PremissasGerais {
  inicio: number
  fim: number
  almocoInicio: number
  almocoDur: number
  buffer: number
  preferidos: number[]
  pesoPreferencia: number
  diaProtegido: DiaProtegido
}

export interface UrgenciaEtapa {
  urgencia: number
  prazoDias: number
}

export interface Etapa {
  rotulo: string
  /** quantidade de projetos na simulação da semente */
  qtd: number
  hue: number
}

export interface ItemPlaybook {
  tipo: string
  /** duração em minutos */
  dur: number
  /** recorrência em semanas */
  cada: number
  papeis: Papel[]
  obrig: boolean
  prio: number
}

export interface Perfil {
  rotulo: string
  desc: string
  usaTolerancia: number
  extraReunioes: number
  extraHoras: number
  cedeJanela: boolean
  pesoFrag: number
  ancorar: boolean
  extraDuracao: number
  fila: "prioridade" | "criticidade"
}

export interface Pessoa {
  id: number
  nome: string
  papel: Papel
  iniciais: string
}

export interface Produtos {
  relatorios: number
  dashboards: number
  integracoes: number
}

export interface Projeto {
  id: number
  nome: string
  fase: string
  squad: Record<Papel, number | undefined>
  health: Health
  prioridade: Prioridade
  produtos: Produtos
  mes: number
  timeId: number
}

export interface Time {
  id: number
  nome: string
  membros: number[]
}

/** Estado do mundo. No protótipo, etapas e playbook eram globais mutáveis. */
export interface Mundo {
  pessoas: Pessoa[]
  projetos: Projeto[]
  times: Time[]
  etapas: Record<string, Etapa>
  playbook: Record<string, ItemPlaybook[]>
}

export interface Config {
  horizonte: number
  perfil: PerfilId
  rebalancear: boolean
  papeis: Record<Papel, PremissasCargoEntrada>
  geral: Partial<PremissasGerais>
  etapas: Record<string, UrgenciaEtapa>
  clientes: Record<string, number>
  /** horas já consumidas nas semanas anteriores do horizonte */
  acumulado?: number[]
  /** semana do horizonte, base do orçamento mensal pró-rata */
  semanaIdx?: number
  /**
   * Plano vigente (publicado), por `chaveOcorrencia`. Quando presente, mover uma cerimônia de
   * lugar custa `pesoEstabilidade` (termo w6 do §4.1). Ausente, o motor é o do protótipo.
   */
  planoVigente?: Record<string, { dia: number; slot: number }>
  pesoEstabilidade?: number
  /** Cerimônias ancoradas pelo cliente (§12), por `chaveSerie`: restrição rígida, alocadas primeiro. */
  ancoras?: Record<string, { dia: number; slot: number }>
}

export interface TrocaCadeira {
  de: number
  para: number
  papel: Papel
}

/** Cerimônia da demanda; ganha dia, slot e marcas conforme é alocada. */
export interface Cerimonia {
  id: number
  projetoId: number
  projeto: string
  fase: string
  tipo: string
  dur: number
  slots: number
  participantes: number[]
  papeis: Papel[]
  obrig: boolean
  prio: number
  health: Health
  timeId: number
  prioridade: Prioridade
  urgencia: number
  prazoDias: number
  pesoCliente: number
  score: number
  sla: boolean
  dia?: number
  slot?: number
  relaxado?: boolean
  trocas?: TrocaCadeira[]
  motivo?: string
  /** camada que alocou: 1 dentro do alvo, 2 troca de cadeira, 3 concessão (§4.3) */
  camada?: 1 | 2 | 3
  ancorada?: boolean
  /** saiu do lugar que tinha no plano vigente */
  movida?: boolean
}

export interface Concessao {
  /** id da cerimônia (na demanda da semana) que motivou a concessão */
  evId: number
  pessoa: string
  pessoaId: number
  papel: Papel
  projeto: string
  cerimonia: string
  premissa: string
  alvo: number
  valor: number
  un: string
}

export interface Deficit {
  horas: number
  cerimonias: number
  obrigatorias: number
  fte: number
  horasObrig: number
  fteObrig: number
}

export interface Cobertura {
  total: number
  obrigatoria: number
  relaxadas: number
  sla: number
  slaTotal: number
  slaViolado: Cerimonia[]
}

/** Ocupação: por pessoa, por dia, por slot. Guarda o id da cerimônia ou null. */
export type Ocupacao = (number | null)[][][]

export interface KpiPessoa {
  id: number
  nome: string
  papel: Papel
  iniciais: string
  Cl: number
  teto: number
  tetoPct: number
  produtivoMin: number
  horas: number
  reunioes: number
  taxa: number
  produtivo: number
  folga: number
  blocosFoco: number
  frag: number
  diasComReuniao: number
  tetoMax: number
  tolerancia: number
  tetoAlvo: number
  maxHorasSemana: number
  maxHorasMes: number
  limitadoPorHoras: boolean
  acimaTeto: boolean
  acimaLimite: boolean
  noAlvo: boolean
}

export interface KpiCenario {
  porPessoa: KpiPessoa[]
  ClMedio: number
  tetoMedio: number
  produtivoMedio: number
  alvoMedio: number
  taxaMedia: number
  horasTotais: number
  reunioesTotais: number
  blocosFocoMedio: number
  fragMedia: number
  acimaTeto: number
  acimaLimite: number
  aderencia: number
}

export interface ResultadoBaseline {
  oc: Ocupacao
  alocadas: Cerimonia[]
  naoAlocadas: Cerimonia[]
  kpi?: KpiCenario
}

export interface ResultadoOtimizacao {
  oc: Ocupacao
  alocadas: Cerimonia[]
  adiadas: Cerimonia[]
  trocas: { ev: Cerimonia; subs: TrocaCadeira[] }[]
  concessoes: Concessao[]
  deficit: Record<Papel, Deficit>
  cobertura: Cobertura
  carga: number[]
  acum: number[]
  PP: PremissasCargo[]
  perfil: Perfil
  perfilId: PerfilId
  kpi?: KpiCenario
  /** só com plano vigente: quantas cerimônias comparáveis saíram do lugar (§6, estabilidade do plano) */
  estabilidade?: { comparaveis: number; movidas: number; pct: number }
}

export interface SemanaSimulada {
  semana: number
  demanda: Cerimonia[]
  base: ResultadoBaseline & { kpi: KpiCenario }
  otm: ResultadoOtimizacao & { kpi: KpiCenario }
}

export interface ResumoMes {
  reunioes: number
  horas: number
  produtivo: number
  acimaTeto: number
  porPessoa: { id: number; reunioes: number; horas: number }[]
}

export interface Simulacao {
  semanas: SemanaSimulada[]
  mes: { base: ResumoMes; otm: ResumoMes }
}

export interface LinhaCapacidade {
  papel: Papel
  pessoas: number
  teto: number
  demanda: number
  cerimonias: number
  semQuorum: number
  capacidade: number
  saldoH: number
  fteNecessario: number
  saldoFte: number
  ocupacao: number
  situacao: "sem ninguém" | "falta gente" | "no limite" | "folga" | "equilibrado"
  acao: string
}
