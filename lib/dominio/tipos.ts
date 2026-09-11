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
  /** quando o item vem de um modificador automático (§3.3), qual */
  origem?: string
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
  /** desvio de cronograma em dias; acima de 10 dobra a cadência de status report (§3.3) */
  atrasoDias?: number
  /** nome do cliente, quando vem do banco; na semente é derivado do nome do projeto */
  cliente?: string
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
  /** Liga os modificadores automáticos do playbook (§3.3). */
  modificadores?: boolean
  /** Exceções por pessoa (§2.1), pelo índice da pessoa: o nível mais específico vence o cargo. */
  excecoesPessoa?: Record<number, Partial<PremissasCargoEntrada>>
  /** Custo por hora-pessoa de cada cargo (§6); sem valor, vale o do protótipo. */
  custoHora?: Record<Papel, number>
  /** Exceções por projeto (§2.1), pelo índice do projeto: janela do cliente e duração máxima. */
  excecoesProjeto?: Record<number, ExcecaoProjeto>
  /** Fração máxima de cerimônias movidas por ciclo (§2.2), só com plano vigente; 0,2 por padrão. */
  limiteMovidas?: number
  /** Datas reais do horizonte. Ausente, o motor usa a semana abstrata do protótipo. */
  calendario?: Calendario
}

/**
 * Exceção de um projeto (§2.1), em slots de 30 minutos. A janela combinada com o cliente soma-se
 * às restrições das pessoas; a duração máxima, por ser o nível mais específico, vence a do cargo.
 */
export interface ExcecaoProjeto {
  /** primeiro slot em que as cerimônias do projeto podem começar */
  inicioMin?: number
  /** slot em que elas precisam ter terminado */
  fimMax?: number
  /** duração máxima das cerimônias do projeto */
  duracaoMax?: number
}

/** Horizonte ancorado no calendário (E14): cadência real, ausências, feriados e antecedência. */
export interface Calendario {
  /** segunda-feira (AAAA-MM-DD) que abre o horizonte */
  inicio: string
  /** semana absoluta da semana 1 do horizonte */
  semana0: number
  /** semana absoluta em que cada série começou, por `projeto|cerimônia` */
  inicioSerie?: Record<string, number>
  /** posições da semana 1 (dia × slots por dia + slot) congeladas pela antecedência de 48h */
  congeladoAte?: number
  /** ausências e feriados: semana do horizonte → pessoa → dia → motivo */
  indisponivel?: Record<number, Record<number, Record<number, string>>>
  /** feriados: semana do horizonte → dia → nome */
  feriados?: Record<number, Record<number, string>>
  /**
   * Compromissos da agenda importada (E09) que não são cerimônia de projeto reconhecida:
   * semana do horizonte → pessoa → blocos em slots, com `fim` exclusivo. Ninguém é convocado por
   * cima nem colado neles (intervalo obrigatório), e o tempo bloqueado não conta como foco livre.
   */
  bloqueios?: Record<number, Record<number, Bloqueio[]>>
}

/** Bloco ocupado por um compromisso de fora do Cadência (§8), num dia útil da semana. */
export interface Bloqueio {
  dia: number
  /** primeiro slot ocupado */
  inicio: number
  /** slot em que o bloco termina (exclusivo) */
  fim: number
  motivo: string
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
  /** modificador automático que gerou ou alterou a cerimônia */
  origem?: string
  /** ficou no lugar do plano vigente por estar a menos de 48h (§2.2) */
  congelada?: boolean
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
  estabilidade?: {
    comparaveis: number
    movidas: number
    pct: number
    /** o limite de movidas por ciclo não coube nem reforçando o peso: restrição relaxada, registrada */
    relaxada?: boolean
    /** peso de estabilidade que produziu este plano, quando o limite exigiu reforço */
    peso?: number
  }
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
