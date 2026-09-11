import { describe, expect, it } from "vitest"

import {
  construirMundo,
  criarConfig,
  gerarDemanda,
  itensDoProjeto,
  medianaProdutos,
  montarSquad,
  papeisDoProjeto,
  simular,
  squadIncompleto,
  validarPlano,
  type Mundo,
} from "@/lib/dominio"

/** Base com squads montados já com os modificadores ligados. */
function baseComModificadores() {
  const mundo = construirMundo()
  const cfg = criarConfig({ modificadores: true })
  mundo.projetos.forEach((pr) => montarSquad(mundo, pr, cfg))
  return { mundo, cfg }
}

const doProjeto = (mundo: Mundo, id: number) => mundo.projetos[id]

describe("modificadores automáticos do playbook (§3.3)", () => {
  it("desligados, a demanda é a mesma do protótipo", () => {
    const mundo = construirMundo()
    expect(gerarDemanda(mundo, 1, criarConfig()).length).toBe(58)
    expect(gerarDemanda(mundo, 1, criarConfig({ modificadores: false })).length).toBe(58)
  })

  it("projeto em vermelho ganha sala de guerra semanal com o Líder Técnico", () => {
    const { mundo, cfg } = baseComModificadores()
    const vermelho = mundo.projetos.find((p) => p.health === "vermelho")
    expect(vermelho).toBeDefined()
    const itens = itensDoProjeto(mundo, vermelho!, medianaProdutos(mundo))
    const sala = itens.find((i) => i.tipo === "Sala de Guerra")
    expect(sala?.cada).toBe(1)
    expect(sala?.papeis).toContain("Líder Técnico")
    expect(papeisDoProjeto(mundo, vermelho!, cfg)).toContain("Líder Técnico")
    for (let w = 1; w <= 2; w++) {
      const d = gerarDemanda(mundo, w, cfg).filter((e) => e.projetoId === vermelho!.id && e.tipo === "Sala de Guerra")
      expect(d).toHaveLength(1)
      expect(d[0].origem).toBe("health vermelho")
    }
  })

  it("projeto em amarelo tem status report toda semana", () => {
    const { mundo } = baseComModificadores()
    const amarelo = mundo.projetos.find((p) => p.health === "amarelo" && ["discovery", "construcao", "homologacao"].includes(p.fase))
    expect(amarelo).toBeDefined()
    const status = itensDoProjeto(mundo, amarelo!, medianaProdutos(mundo)).find((i) => i.tipo === "Status Report")
    expect(status?.cada).toBe(1)
    expect(status?.origem).toBe("health amarelo")
  })

  it("cliente prioritário tem checkpoint executivo mensal e cadeira de Gerente de Projeto", () => {
    const { mundo, cfg } = baseComModificadores()
    const alta = mundo.projetos.find((p) => p.prioridade === "alta" && p.fase === "sustentacao")
    expect(alta).toBeDefined()
    const chk = itensDoProjeto(mundo, alta!, medianaProdutos(mundo)).find((i) => i.tipo === "Checkpoint Executivo")
    expect(chk?.cada).toBe(4)
    expect(alta!.squad["Gerente de Projeto"]).toBeDefined()
    expect(squadIncompleto(mundo, alta!, cfg)).toEqual([])
  })

  it("atraso acima de 10 dias dobra a cadência do status report", () => {
    const mundo = construirMundo()
    const pr = mundo.projetos.find((p) => p.fase === "construcao" && p.health === "verde")!
    const antes = itensDoProjeto(mundo, pr, medianaProdutos(mundo)).find((i) => i.tipo === "Status Report")!
    pr.atrasoDias = 15
    const depois = itensDoProjeto(mundo, pr, medianaProdutos(mundo)).find((i) => i.tipo === "Status Report")!
    expect(depois.cada).toBe(Math.max(1, Math.floor(antes.cada / 2)))
    expect(depois.origem).toBe("atraso de cronograma")
  })

  it("volume de produtos acrescenta uma validação a cada 3 produtos acima da mediana", () => {
    const mundo = construirMundo()
    const mediana = medianaProdutos(mundo)
    const pr = doProjeto(mundo, mundo.projetos.findIndex((p) => p.fase === "discovery"))
    pr.produtos = { relatorios: Math.ceil(mediana) + 7, dashboards: 0, integracoes: 0 }
    const extras = itensDoProjeto(mundo, pr, mediana).filter((i) => i.origem === "volume de produtos")
    const esperado = Math.floor((pr.produtos.relatorios - mediana) / 3)
    expect(extras).toHaveLength(esperado)
    extras.forEach((i) => expect(i.tipo.startsWith("Validação de Dados extra")).toBe(true))
  })

  it("com os modificadores a demanda cresce e o plano segue sem violar restrição rígida", () => {
    const { mundo, cfg } = baseComModificadores()
    const sim = simular(mundo, cfg)
    expect(sim.semanas[0].demanda.length).toBeGreaterThan(58)
    sim.semanas.forEach((w) =>
      expect(validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, semanaIdx: w.semana }, mundo, { conferirTime: true })).toEqual([])
    )
  })
})

describe("exceções por pessoa (§2.1)", () => {
  it("janela protegida da própria pessoa vence a do cargo", () => {
    const mundo = construirMundo()
    mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
    const cfg = criarConfig()
    const pessoa = 5 // uma Especialista
    const excecoesPessoa = { [pessoa]: { focoProt: 8 } } // manhã inteira protegida, até 12:00
    const sim = simular(mundo, { ...cfg, excecoesPessoa })
    sim.semanas.forEach((w) => {
      w.otm.alocadas
        .filter((ev) => ev.participantes.includes(pessoa))
        .forEach((ev) => expect((ev.slot ?? 0) >= 8 || ev.relaxado).toBe(true))
      expect(
        validarPlano(w.otm, w.demanda, mundo.pessoas, { ...cfg, excecoesPessoa, semanaIdx: w.semana }, mundo)
      ).toEqual([])
    })
  })
})
