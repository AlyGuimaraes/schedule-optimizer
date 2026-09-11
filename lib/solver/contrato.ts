// Contrato do solver CP-SAT (E15), uma semana por chamada. A fonte única é o JSON Schema em
// solver/contrato/semana.schema.json; o Pydantic do serviço (solver/cadencia_solver/contrato.py)
// e estes tipos o espelham, e os testes dos dois lados conferem que não divergem.
//
// Unidades: horas em horas decimais, `dur` em minutos, `slot` em slots de 30 minutos a partir do
// início da grade, `dia` de 0 (segunda) a `grade.dias - 1`. Os nomes seguem as `$defs` do esquema.

export const VERSAO_CONTRATO = "1" as const

export type DiaProtegido = "nenhum" | "sexta-tarde" | "sexta"
export type Status = "otimo" | "viavel" | "inviavel" | "sem_solucao" | "invalido"

// ─────────────────────────── requisição ───────────────────────────

export interface Grade {
  dias: number
  slotsDia: number
}

/** Premissas gerais (§2.2), em slots. */
export interface Geral {
  inicio: number
  fim: number
  almocoInicio: number
  almocoDur: number
  buffer: number
  preferidos: number[]
  pesoPreferencia: number
  diaProtegido: DiaProtegido
}

/** O que do perfil (§4.4) ainda pesa no objetivo; as folgas já chegam resolvidas por pessoa. */
export interface Perfil {
  id: string
  pesoFrag: number
  ancorar: boolean
}

/** Premissas da pessoa resolvidas (cargo com exceção), no alvo e no máximo que o perfil cede. */
export interface PremissasPessoa {
  teto: number
  tetoRelaxado: number
  maxReunioesDia: number
  maxReunioesDiaRelaxado: number
  maxHorasDia: number
  maxHorasDiaRelaxado: number
  focoProt: number
  focoProtRelaxado: number
  duracaoMax: number
  duracaoMaxRelaxada: number
  blocoFocoMin: number
  /** orçamento mensal pró-rata até esta semana, em horas (R11) */
  orcamentoMensal: number
}

export interface Pessoa {
  id: number
  nome: string
  papel: string
  /** horas já consumidas nas semanas anteriores do horizonte */
  acumulado: number
  premissas: PremissasPessoa
}

/** Cadeira do quórum (R12): o titular do squad e quem pode sentar no lugar dele na camada 2. */
export interface Cadeira {
  papel: string
  titular: number
  candidatos: number[]
}

export interface Posicao {
  dia: number
  slot: number
}

export interface Cerimonia {
  id: number
  projetoId: number
  projeto: string
  tipo: string
  /** em minutos */
  dur: number
  slots: number
  cadeiras: Cadeira[]
  obrigatoria: boolean
  prio: number
  sla: boolean
  score: number
  /** horário imposto pelo cliente (§12) */
  ancora?: Posicao
  /** posição no plano publicado (w6) */
  vigente?: Posicao
}

/** Uma cerimônia da solução gulosa, usada como warm start. */
export interface Dica {
  cerimoniaId: number
  dia: number
  slot: number
  relaxada: boolean
  participantes: number[]
}

export interface Opcoes {
  limiteSegundos?: number
  workers?: number
  semente?: number
  /** calcula o objetivo da dica no mesmo modelo, para comparar guloso e CP-SAT */
  avaliarDica?: boolean
}

export interface RequisicaoSemana {
  versao: typeof VERSAO_CONTRATO
  semana: number
  grade: Grade
  geral: Geral
  perfil: Perfil
  pesoEstabilidade: number
  permitirTroca: boolean
  permitirRelaxar: boolean
  pessoas: Pessoa[]
  cerimonias: Cerimonia[]
  dica?: Dica[]
  opcoes?: Opcoes
}

// ─────────────────────────── resposta ───────────────────────────

export interface Troca {
  de: number
  para: number
  papel: string
}

export interface Alocacao {
  cerimoniaId: number
  dia: number
  slot: number
  camada: 1 | 2 | 3
  participantes: number[]
  trocas: Troca[]
  relaxada: boolean
  ancorada: boolean
}

export interface NaoAlocada {
  cerimoniaId: number
  motivo: string
}

export interface Concessao {
  cerimoniaId: number
  pessoaId: number
  premissa: string
  alvo: number
  valor: number
  un: string
}

export interface Estatisticas {
  variaveis: number
  restricoes: number
  workers: number
  conflitos: number
  ramos: number
  /** segundos de parede dentro do CP-SAT */
  tempoSolver: number
}

export interface RespostaSemana {
  versao: typeof VERSAO_CONTRATO
  status: Status
  objetivo: number | null
  limiteInferior: number | null
  /** objetivo da dica gulosa no mesmo modelo, quando avaliada */
  objetivoDica: number | null
  ms: number
  alocadas: Alocacao[]
  naoAlocadas: NaoAlocada[]
  concessoes: Concessao[]
  estatisticas: Estatisticas
}
