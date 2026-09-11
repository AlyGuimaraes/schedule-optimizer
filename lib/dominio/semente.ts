import { mulberry32 } from "./aleatorio"
import { clonar, FASES_PADRAO, PLAYBOOK_PADRAO } from "./padroes"
import type { Etapa, Health, ItemPlaybook, Mundo, Papel, Prioridade, Projeto, Time } from "./tipos"

// Time de 20 pessoas e 112 projetos da simulação (R03). Em produção estes dados vêm do banco;
// a semente continua servindo para demonstração, seed do Supabase e testes de paridade.
const NOMES: [string, Papel][] = [
  ["Ana Ribeiro", "Analista"], ["Bruno Tavares", "Analista"], ["Camila Duarte", "Analista"],
  ["Diego Falcão", "Analista"], ["Eduarda Nunes", "Analista"],
  ["Felipe Marques", "Especialista"], ["Gabriela Rocha", "Especialista"], ["Henrique Sales", "Especialista"],
  ["Isabela Prado", "Especialista"], ["João Vasques", "Especialista"], ["Karina Lopes", "Especialista"],
  ["Leandro Bastos", "Especialista"],
  ["Mariana Cordeiro", "Analista Sênior"], ["Nelson Braga", "Analista Sênior"],
  ["Otávio Lima", "Analista Sênior"], ["Paula Monteiro", "Analista Sênior"],
  ["Rafael Antunes", "Arquiteto de Dados"],
  ["Sofia Mendes", "Líder Técnico"],
  ["Thiago Rezende", "Gerente de Projeto"], ["Vanessa Klein", "Gerente de Projeto"],
]

const CLIENTES_A = ["Grupo", "Cia", "Holding", "Rede", "Indústrias", "Agro", "Log", "Med"]
const CLIENTES_B = [
  "Aurora", "Vértice", "Montana", "Ipê", "Serra Azul", "Andorra", "Câmbio", "Delta Sul",
  "Everest", "Ferrolar", "Guaraí", "Horizonte", "Itaúna", "Jacarandá", "Kaporã", "Lumina",
  "Marfim", "Nortis", "Ourivés", "Pampulha", "Quatro Rios", "Rubi", "Solaris", "Tramontana",
  "Urano", "Verdaz", "Xisto", "Zênite", "Bandeirante", "Cristalina", "Diamantina", "Estrela",
]

const NOMES_TIME = ["Squad Alfa", "Squad Bravo", "Squad Charlie", "Squad Delta"]

export function iniciaisDe(n: string): string {
  return n.trim().split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase()
}

/**
 * Mundo determinístico por semente. A ordem das chamadas ao gerador é a mesma do protótipo,
 * porque é ela que define os projetos, os times e os squads.
 */
export function construirMundo(
  seed = 7,
  etapasBase: Record<string, Etapa> = FASES_PADRAO,
  playbookBase: Record<string, ItemPlaybook[]> = PLAYBOOK_PADRAO
): Mundo {
  const rnd = mulberry32(seed)
  const etapas = clonar(etapasBase)
  const playbook = clonar(playbookBase)

  const pessoas = NOMES.map((n, i) => ({
    id: i,
    nome: n[0],
    papel: n[1],
    iniciais: n[0].split(" ").map((x) => x[0]).join("").slice(0, 2),
  }))
  const pools: Record<Papel, number[]> = {}
  pessoas.forEach((p) => {
    ;(pools[p.papel] = pools[p.papel] || []).push(p.id)
  })

  // esqueleto dos projetos
  const projetos: Projeto[] = []
  let idx = 0
  Object.keys(etapas).forEach((fase) => {
    for (let k = 0; k < etapas[fase].qtd; k++) {
      const nome =
        CLIENTES_A[Math.floor(rnd() * CLIENTES_A.length)] +
        " " +
        CLIENTES_B[Math.floor(rnd() * CLIENTES_B.length)]
      const health: Health = rnd() < 0.72 ? "verde" : rnd() < 0.72 ? "amarelo" : "vermelho"
      const r = rnd()
      const prioridade: Prioridade = r < 0.18 ? "alta" : r < 0.62 ? "media" : "baixa"
      projetos.push({
        id: idx,
        nome: nome + " " + String.fromCharCode(65 + (idx % 26)),
        fase,
        squad: {},
        health,
        prioridade,
        produtos: {
          relatorios: 2 + Math.floor(rnd() * 6),
          dashboards: 1 + Math.floor(rnd() * 5),
          integracoes: Math.floor(rnd() * 3),
        },
        mes: 1 + Math.floor(rnd() * 14),
        timeId: 0,
      })
      idx++
    }
  })

  // times: cargos escassos circulam por todos, analistas e especialistas ficam em um só
  const times: Time[] = NOMES_TIME.map((nome, i) => ({ id: i, nome, membros: [] }))
  const porPapel2: Record<Papel, number[]> = {}
  pessoas.forEach((p) => {
    ;(porPapel2[p.papel] = porPapel2[p.papel] || []).push(p.id)
  })
  Object.keys(porPapel2).forEach((pp) => {
    const ids = porPapel2[pp]
    if (ids.length >= times.length) {
      ids.forEach((id, i) => times[i % times.length].membros.push(id))
    } else {
      ids.forEach((id) => times.forEach((t) => t.membros.push(id)))
    }
  })
  const baralhoTime: number[] = []
  while (baralhoTime.length < projetos.length) times.forEach((t) => baralhoTime.push(t.id))
  for (let i = baralhoTime.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[baralhoTime[i], baralhoTime[j]] = [baralhoTime[j], baralhoTime[i]]
  }
  projetos.forEach((pr, i) => {
    pr.timeId = baralhoTime[i]
  })

  // atribuição balanceada por cargo, sem correlação com o id do projeto
  const porPapel: Record<Papel, number[]> = {}
  projetos.forEach((pr) => {
    ;[...new Set(playbook[pr.fase].flatMap((c) => c.papeis))].forEach((pp) => {
      ;(porPapel[pp] = porPapel[pp] || []).push(pr.id)
    })
  })
  Object.keys(porPapel).forEach((pp) => {
    const alvos = porPapel[pp]
    const pool = pools[pp] || []
    if (!pool.length) return
    const baralho: number[] = []
    while (baralho.length < alvos.length) pool.forEach((id) => baralho.push(id))
    for (let i = baralho.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[baralho[i], baralho[j]] = [baralho[j], baralho[i]]
    }
    alvos.forEach((projId, i) => {
      projetos[projId].squad[pp] = baralho[i]
    })
  })

  return { pessoas, projetos, times, etapas, playbook }
}
