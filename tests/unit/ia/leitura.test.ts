import { createElement as h, Fragment, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TextoLeitura } from "@/components/cadencia/texto-leitura"
import {
  PERFIS,
  construirMundo,
  criarConfig,
  montarSquad,
  simular,
  type Config,
  type Mundo,
  type PerfilId,
  type Simulacao,
} from "@/lib/dominio"
import { n1, pc } from "@/lib/formato"
import type { ResumoExecucao } from "@/lib/ia/entradas"
import { leituraDeterministica, textoLeitura } from "@/lib/ia/leitura-deterministica"
import { resumirExecucao } from "@/lib/ia/resumo"

/**
 * A leitura como estava no JSX de components/telas/otimizador.tsx antes da extração (E18), com
 * os filhos exatamente como o JSX os produzia (texto aparado nas quebras de linha, `{" "}`).
 */
function leituraAntiga(config: Config, sim: Simulacao): ReactNode {
  const w = sim.semanas[0]
  const o = w.otm.kpi
  const R = w.otm
  const perfil = PERFIS[config.perfil] || PERFIS.equilibrio
  const conc = R.concessoes
  const trocas = R.trocas
  const adi = R.adiadas
  const quadro = Object.keys(config.papeis)
    .map((pp) => {
      const ps = o.porPessoa.filter((x) => x.papel === pp)
      if (!ps.length) return null
      const def = R.deficit[pp]
      return { fteObrig: def ? def.fteObrig : 0 }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  const fteObrig = quadro.reduce((s, x) => s + x.fteObrig, 0)
  const porPremissa: Record<string, number> = {}
  conc.forEach((c) => (porPremissa[c.premissa] = (porPremissa[c.premissa] || 0) + 1))
  const gargalo: Record<string, number> = {}
  adi.forEach((a) => a.papeis.forEach((pp) => (gargalo[pp] = (gargalo[pp] || 0) + 1)))
  const gargaloTop = Object.entries(gargalo).sort((a, c) => c[1] - a[1])[0]

  return h(
    "p",
    { className: "leitura" },
    "Com o perfil ",
    h("b", null, perfil.rotulo),
    ", o plano cobre ",
    h("b", null, pc(R.cobertura.total)),
    " da demanda do playbook (",
    pc(R.cobertura.obrigatoria),
    " das obrigatórias) e mantém ",
    h("b", null, pc(o.aderencia)),
    " do time dentro do alvo do próprio cargo.",
    " ",
    R.cobertura.relaxadas
      ? `Para chegar lá, ${R.cobertura.relaxadas} cerimônia(s) foram alocadas com concessão: ${Object.entries(porPremissa)
          .map(([k2, v]) => `${v} de ${k2}`)
          .join(", ")}.`
      : "Nenhuma premissa precisou ser cedida.",
    " ",
    adi.length
      ? h(
          Fragment,
          null,
          "Sobraram ",
          h("b", null, adi.length, " cerimônia(s)"),
          " fora do plano",
          fteObrig > 0
            ? h(Fragment, null, ", o equivalente a ", h("b", null, n1(fteObrig), " FTE"), gargaloTop ? ` em ${gargaloTop[0]}` : "")
            : ", todas opcionais",
          "."
        )
      : "Toda a demanda do playbook coube no plano.",
    " ",
    trocas.length ? `A camada 2 resolveu ${trocas.length} caso(s) apenas trocando a cadeira.` : ""
  )
}

const html = (no: ReactNode) => renderToStaticMarkup(no).replaceAll("<!-- -->", "")

function base(): Mundo {
  const mundo = construirMundo()
  mundo.projetos.forEach((pr) => montarSquad(mundo, pr))
  return mundo
}

/** Alvos apertados em 7 p.p. sobre o padrão, como no §4.4: é onde os perfis divergem. */
function apertada(cfg: Config): Config {
  const papeis = Object.fromEntries(
    Object.entries(cfg.papeis).map(([k, v]) => [k, { ...v, produtivoMin: v.produtivoMin + 7 }])
  )
  return { ...cfg, papeis }
}

describe("leitura determinística do Otimizador (extraída do JSX na E18)", () => {
  const mundo = base()
  const casos: { nome: string; config: Config }[] = []
  for (const perfil of Object.keys(PERFIS) as PerfilId[]) {
    casos.push({ nome: `${perfil}, alvos padrão`, config: criarConfig({ perfil, horizonte: 1 }) })
    casos.push({ nome: `${perfil}, alvos apertados`, config: apertada(criarConfig({ perfil, horizonte: 1 })) })
  }
  casos.push({ nome: "equilibrio, sem rebalancear", config: apertada(criarConfig({ horizonte: 1, rebalancear: false })) })

  const resumos: ResumoExecucao[] = []
  for (const caso of casos) {
    it(`renderiza o mesmo HTML que o JSX antigo: ${caso.nome}`, () => {
      const sim = simular(mundo, caso.config)
      const resumo = resumirExecucao({ mundo, config: caso.config, simulacao: sim, papeis: Object.keys(caso.config.papeis) })
      resumos.push(resumo)
      const nova = h("p", { className: "leitura" }, h(TextoLeitura, { trechos: leituraDeterministica(resumo) }))
      expect(html(nova)).toBe(html(leituraAntiga(caso.config, sim)))
    })
  }

  it("os casos do mundo semente passam pelos ramos de concessão, adiadas e déficit", () => {
    expect(resumos.some((r) => r.cobertura.relaxadas > 0)).toBe(true)
    expect(resumos.some((r) => r.adiadas.total > 0 && r.deficit.fte > 0)).toBe(true)
  })

  it("cobre os ramos que o mundo semente não exercita", () => {
    const r = resumos[0]
    const sem = {
      ...r,
      cobertura: { ...r.cobertura, relaxadas: 0 },
      adiadas: { total: 0, obrigatorias: 0, sla: 0 },
      trocas: 0,
    }
    expect(textoLeitura(leituraDeterministica(sem))).toMatch(
      /cargo\. Nenhuma premissa precisou ser cedida\. Toda a demanda do playbook coube no plano\. $/
    )
    const opcionais = { ...sem, adiadas: { total: 2, obrigatorias: 0, sla: 0 }, deficit: { ...r.deficit, fte: 0 } }
    expect(textoLeitura(leituraDeterministica(opcionais))).toContain("Sobraram 2 cerimônia(s) fora do plano, todas opcionais. ")
    const semGargalo = { ...opcionais, deficit: { ...r.deficit, fte: 1.25, gargalo: null } }
    expect(textoLeitura(leituraDeterministica(semGargalo))).toContain("fora do plano, o equivalente a 1,3 FTE. ")
    // a semente não gera troca de cadeira na semana 1; o ramo da camada 2 é conferido aqui
    const comTrocas = { ...sem, trocas: 3 }
    expect(textoLeitura(leituraDeterministica(comTrocas))).toMatch(
      /coube no plano\. A camada 2 resolveu 3 caso\(s\) apenas trocando a cadeira\.$/
    )
  })
})
