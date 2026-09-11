import type {
  Etapa,
  ItemPlaybook,
  Papel,
  Perfil,
  PerfilId,
  PremissasCargoEntrada,
  PremissasGerais,
  UrgenciaEtapa,
} from "./tipos"

/** Grade de 30 minutos, segunda a sexta, das 08:00 às 18:00. */
export const SLOTS_DIA = 20
export const DIAS = 5

/** Premissas gerais (§2.2). Tudo em slots de 30 min a partir das 08:00 (slot 0). */
export const GERAL_PADRAO: PremissasGerais = {
  inicio: 0,
  fim: 20,
  almocoInicio: 8,
  almocoDur: 2,
  buffer: 1,
  preferidos: [4, 5, 6, 7, 10, 11, 12, 13, 14, 15],
  pesoPreferencia: 1.5,
  diaProtegido: "nenhum",
}

/** Urgência e prazo por etapa (§2.5). Prazo de até 7 dias úteis marca cerimônia crítica. */
export const ETAPAS_PADRAO: Record<string, UrgenciaEtapa> = {
  kickoff: { urgencia: 5, prazoDias: 7 },
  discovery: { urgencia: 4, prazoDias: 10 },
  construcao: { urgencia: 2, prazoDias: 15 },
  homologacao: { urgencia: 4, prazoDias: 10 },
  golive: { urgencia: 5, prazoDias: 5 },
  sustentacao: { urgencia: 1, prazoDias: 30 },
}

/** Peso da prioridade do cliente, que multiplica a urgência da etapa. */
export const CLIENTES_PADRAO: Record<string, number> = { alta: 3, media: 2, baixa: 1 }

/** Matriz padrão por cargo (§2.3). */
export const PREM_PADRAO: Record<Papel, PremissasCargoEntrada> = {
  Analista: { jornada: 40, fatorAusencia: 10, tempoInstitucional: 3, produtivoMin: 82, tolerancia: 4, maxReunioesDia: 4, maxHorasDia: 3, maxHorasSemana: 8, maxHorasMes: 30, blocoFocoMin: 4, focoProt: 4, duracaoMax: 4 },
  "Analista Sênior": { jornada: 40, fatorAusencia: 10, tempoInstitucional: 4, produtivoMin: 78, tolerancia: 5, maxReunioesDia: 5, maxHorasDia: 3.5, maxHorasSemana: 9, maxHorasMes: 34, blocoFocoMin: 4, focoProt: 4, duracaoMax: 4 },
  Especialista: { jornada: 40, fatorAusencia: 12, tempoInstitucional: 4, produtivoMin: 75, tolerancia: 6, maxReunioesDia: 5, maxHorasDia: 4, maxHorasSemana: 10, maxHorasMes: 38, blocoFocoMin: 4, focoProt: 4, duracaoMax: 4 },
  "Arquiteto de Dados": { jornada: 40, fatorAusencia: 10, tempoInstitucional: 3, produtivoMin: 85, tolerancia: 3, maxReunioesDia: 3, maxHorasDia: 2.5, maxHorasSemana: 6, maxHorasMes: 22, blocoFocoMin: 6, focoProt: 6, duracaoMax: 2 },
  "Líder Técnico": { jornada: 40, fatorAusencia: 12, tempoInstitucional: 6, produtivoMin: 65, tolerancia: 8, maxReunioesDia: 6, maxHorasDia: 5, maxHorasSemana: 13, maxHorasMes: 48, blocoFocoMin: 4, focoProt: 2, duracaoMax: 4 },
  "Gerente de Projeto": { jornada: 40, fatorAusencia: 12, tempoInstitucional: 6, produtivoMin: 58, tolerancia: 10, maxReunioesDia: 8, maxHorasDia: 6, maxHorasSemana: 16, maxHorasMes: 60, blocoFocoMin: 2, focoProt: 0, duracaoMax: 3 },
}

/** Perfis de otimização (§4.4): quanto o solver pode ceder e o que ele prioriza. */
export const PERFIS: Record<PerfilId, Perfil> = {
  foco: {
    rotulo: "Foco máximo",
    desc: "protege o trabalho profundo; adia cerimônia antes de invadir a janela protegida",
    usaTolerancia: 0.4, extraReunioes: 0, extraHoras: 0, cedeJanela: false, pesoFrag: 1.7, ancorar: false, extraDuracao: 0, fila: "prioridade",
  },
  equilibrio: {
    rotulo: "Equilíbrio",
    desc: "usa toda a tolerância declarada e afrouxa o limite diário em 1 reunião",
    usaTolerancia: 1, extraReunioes: 1, extraHoras: 0.5, cedeJanela: false, pesoFrag: 1, ancorar: false, extraDuracao: 1, fila: "prioridade",
  },
  cliente: {
    rotulo: "Prioridade ao cliente",
    desc: "cobertura máxima: cede janela protegida e limites diários se preciso",
    usaTolerancia: 1, extraReunioes: 2, extraHoras: 1, cedeJanela: true, pesoFrag: 0.5, ancorar: false, extraDuracao: 2, fila: "criticidade",
  },
  estabilidade: {
    rotulo: "Estabilidade de agenda",
    desc: "ancora cada projeto num dia fixo da semana e cede pouco",
    usaTolerancia: 0.7, extraReunioes: 1, extraHoras: 0.5, cedeJanela: false, pesoFrag: 1, ancorar: true, extraDuracao: 1, fila: "prioridade",
  },
}

/** Etapas do ciclo; `qtd` é a distribuição de projetos da simulação. */
export const FASES_PADRAO: Record<string, Etapa> = {
  kickoff: { rotulo: "Kickoff", qtd: 4, hue: 300 },
  discovery: { rotulo: "Discovery", qtd: 10, hue: 245 },
  construcao: { rotulo: "Construção", qtd: 24, hue: 145 },
  homologacao: { rotulo: "Homologação", qtd: 8, hue: 35 },
  golive: { rotulo: "Go-live", qtd: 6, hue: 170 },
  sustentacao: { rotulo: "Sustentação", qtd: 60, hue: 95 },
}

/** Catálogo de cerimônias por fase (§3.1). É daqui que nasce toda a demanda. */
export const PLAYBOOK_PADRAO: Record<string, ItemPlaybook[]> = {
  kickoff: [
    { tipo: "Kickoff Executivo", dur: 60, cada: 2, papeis: ["Gerente de Projeto", "Analista Sênior", "Líder Técnico"], obrig: true, prio: 1 },
    { tipo: "Levantamento de Requisitos", dur: 90, cada: 1, papeis: ["Especialista", "Analista Sênior"], obrig: true, prio: 2 },
  ],
  discovery: [
    { tipo: "Reunião de Trabalho", dur: 90, cada: 1, papeis: ["Analista", "Especialista"], obrig: true, prio: 2 },
    { tipo: "Status Report", dur: 45, cada: 3, papeis: ["Gerente de Projeto", "Analista Sênior"], obrig: true, prio: 3 },
    { tipo: "Validação de Dados", dur: 60, cada: 4, papeis: ["Arquiteto de Dados", "Analista Sênior"], obrig: false, prio: 5 },
  ],
  construcao: [
    { tipo: "Reunião de Trabalho", dur: 60, cada: 4, papeis: ["Analista", "Especialista"], obrig: true, prio: 2 },
    { tipo: "Status Report", dur: 30, cada: 6, papeis: ["Líder Técnico"], obrig: true, prio: 3 },
    { tipo: "Validação de Produto", dur: 60, cada: 8, papeis: ["Analista Sênior", "Especialista"], obrig: false, prio: 5 },
  ],
  homologacao: [
    { tipo: "Sessão de Homologação", dur: 90, cada: 1, papeis: ["Especialista", "Analista Sênior"], obrig: true, prio: 1 },
    { tipo: "Status Report", dur: 45, cada: 2, papeis: ["Gerente de Projeto", "Líder Técnico"], obrig: true, prio: 3 },
  ],
  golive: [
    { tipo: "Acompanhamento Pós Go-live", dur: 30, cada: 2, papeis: ["Analista"], obrig: true, prio: 2 },
    { tipo: "Treinamento de Usuários", dur: 120, cada: 8, papeis: ["Especialista", "Analista"], obrig: false, prio: 4 },
  ],
  sustentacao: [
    { tipo: "Check-in de Sustentação", dur: 30, cada: 8, papeis: ["Analista"], obrig: true, prio: 4 },
  ],
}

export const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
