"use client"

import { useState } from "react"

import { GraficoBarras } from "@/components/cadencia/grafico-barras"
import { EditorCab, EditorPe } from "@/components/cadencia/modal"
import {
  Abas,
  Aviso,
  Chave,
  delta,
  Faixa,
  Health,
  IconeMais,
  Indicador,
  Painel,
  SecCab,
  Selo,
  SeloFase,
  TagCerimonia,
  Terminal,
  Trilha,
  VazioTela,
  type Tom,
} from "@/components/cadencia/primitivas"
import { Segmentado } from "@/components/cadencia/segmentado"
import { FASES_PADRAO } from "@/lib/dominio"
import { cn } from "@/lib/utils"

// Vitrine do design system (E01): cada primitiva nos dois temas, com dados fictícios estáticos.
// Serve de referência visual e de alvo para o axe; não aparece em produção.

const TONS: Tom[] = ["ok", "aviso", "ruim", "neutro", "acento"]
const CERIMONIAS = ["Status Report", "Reunião de Trabalho", "Sala de Guerra", "Checkpoint Executivo", "Validação de Dados"]
const TERMINAL: [string, string][] = [
  ["cmd", "> cadencia optimize --horizonte 4w --perfil equilibrio"],
  ["", "planejador  58 cerimônias derivadas do playbook"],
  ["bom", "camada 1    48 alocadas dentro do alvo, sem ceder nada"],
  ["at", "camada 3    4 com concessão, tolerância a 100%"],
  ["bom", "> plano pronto para publicação"],
]

function Amostras({ tema }: { tema: "claro" | "escuro" }) {
  const [aba, setAba] = useState<"um" | "dois" | "tres">("um")
  const [ligada, setLigada] = useState(true)
  const [segmento, setSegmento] = useState<"base" | "otm">("otm")
  const id = (s: string) => `${s}-${tema}`

  return (
    <>
      <Faixa>
        <Indicador rotulo="Aderência ao alvo" valor="85,0" un="%" delta={delta(75, 85, false, " p.p.")} />
        <Indicador rotulo="Cobertura total" valor="89,7" un="%" tom="ruim" contexto="52 de 58 cerimônias" />
        <Indicador rotulo="Com concessão" valor="4" contexto="4 pessoas cederam" />
        <Indicador rotulo="SLA de etapa" valor="100,0" un="%" tom="bom" />
        <Indicador rotulo="Adiadas" valor="6" delta={delta(9, 6, true)} />
        <Indicador rotulo="Déficit estrutural" valor="0,6" un="FTE" contexto="concentrado em Analista" />
      </Faixa>

      <section className="sec">
        <SecCab titulo="Selos, fases e cerimônias" apoio="tons semânticos e hue por fase" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TONS.map((t) => (
            <Selo key={t} tom={t}>
              {t}
            </Selo>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {Object.keys(FASES_PADRAO).map((f) => (
            <SeloFase key={f} fase={f} etapas={FASES_PADRAO} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {CERIMONIAS.map((c) => (
            <TagCerimonia key={c} tipo={c} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <Health health="verde" />
          <Health health="amarelo" />
          <Health health="vermelho" />
        </div>
      </section>

      <section className="sec">
        <SecCab titulo="Controles" apoio="abas, chave, segmentado e botões" />
        <Abas
          abas={[
            { id: "um" as const, rotulo: "Resultado", apoio: "desejado contra possível" },
            { id: "dois" as const, rotulo: "Concessões", apoio: "4 registradas" },
            { id: "tres" as const, rotulo: "Cenários", apoio: "salvar e publicar" },
          ]}
          ativa={aba}
          onChange={setAba}
        />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <Chave ligada={ligada} onChange={setLigada}>
            Rebalancear cadeiras
          </Chave>
          <Segmentado
            rotulo={`Cenário da vitrine, tema ${tema}`}
            valor={segmento}
            opcoes={[
              { valor: "base", rotulo: "Agenda atual" },
              { valor: "otm", rotulo: "Otimizada" },
            ]}
            onChange={setSegmento}
          />
          <button type="button" className="btn">
            <IconeMais />
            Novo projeto
          </button>
          <button type="button" className="btn leve">
            Redistribuir alocação
          </button>
          <button type="button" className="mini-btn">
            editar
          </button>
          <button type="button" className="mini-btn perigo">
            excluir
          </button>
        </div>
      </section>

      <section className="sec">
        <SecCab titulo="Tabela densa" apoio="colunas numéricas em mono, célula editável" />
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              <th className="n">Pessoas</th>
              <th className="n">Teto</th>
              <th style={{ width: 150 }}>Ocupação</th>
              <th className="n">Jornada</th>
            </tr>
          </thead>
          <tbody>
            {[
              { c: "Analista", p: 5, t: 5.9, o: 62 },
              { c: "Líder Técnico", p: 1, t: 10.2, o: 96 },
            ].map((l) => (
              <tr key={l.c}>
                <td>{l.c}</td>
                <td className="n">{l.p}</td>
                <td className="n">{String(l.t).replace(".", ",")}h</td>
                <td>
                  <Trilha valor={l.o} max={100} limite={85} tom={l.o > 85 ? "ruim" : "ok"} />
                  <div className="meta">{l.o}% do teto</div>
                </td>
                <td className="n">
                  <input className="cel-edit" type="number" defaultValue={40} aria-label={`Jornada de ${l.c}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="colunas c-2 sec">
        <Painel titulo="Painel">
          <p className="nota">
            Texto de apoio em 12px com entrelinha de 1,6. <b>Destaque</b> em foreground.
          </p>
          <Aviso titulo="Cargos sem ninguém alocável: Arquiteto de Dados">
            As cerimônias que exigem esse cargo ficam sem quórum e não entram no plano.
          </Aviso>
        </Painel>
        <section>
          <SecCab titulo="Gráfico de barras" apoio="referência tracejada por barra" />
          <GraficoBarras
            dados={[
              { l: "Analista", v: 15.8, ref: 18, t: "15,8%" },
              { l: "Sênior", v: 19, ref: 22, t: "19,0%" },
              { l: "Líder", v: 24, ref: 25, t: "24,0%" },
              { l: "Gerente", v: 12.4, ref: 30, t: "12,4%" },
            ]}
            valores
            alt={`gráfico de exemplo, tema ${tema}`}
          />
        </section>
      </div>

      <div className="colunas c-2 sec">
        <section>
          <SecCab titulo="Terminal" apoio="linhas surgindo a cada 130ms" />
          <Terminal linhas={TERMINAL} animado={false} />
        </section>
        <section>
          <SecCab titulo="Estados" apoio="vazio e esqueleto" />
          <VazioTela titulo="Nenhum projeto encontrado">Ajuste a busca ou o filtro de fase.</VazioTela>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div className="esqueleto" style={{ width: "60%" }} />
            <div className="esqueleto" style={{ width: "85%" }} />
          </div>
        </section>
      </div>

      <section className="sec">
        <SecCab titulo="Editor" apoio="cabeçalho, formulário em 4 colunas e rodapé" />
        <div className="caixa" style={{ position: "static", maxWidth: 560 }}>
          <EditorCab titulo="Editar Ana Ribeiro" meta="13 projeto(s) alocados" />
          <div className="form">
            <div className="campo l2">
              <label htmlFor={id("nome")}>Nome</label>
              <input id={id("nome")} defaultValue="Ana Ribeiro" />
            </div>
            <div className="campo l2">
              <label htmlFor={id("cargo")}>Cargo</label>
              <select id={id("cargo")} defaultValue="Analista">
                <option>Analista</option>
                <option>Líder Técnico</option>
              </select>
              <span className="dica">O cargo define todas as restrições de agenda desta pessoa.</span>
            </div>
          </div>
          <EditorPe erro={null} acao="Salvar pessoa" onCancelar={() => {}} onAcao={() => {}} />
        </div>
      </section>
    </>
  )
}

export function Vitrine() {
  return (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <h1 className="mb-1 text-[17px] font-semibold tracking-[-0.02em]">Vitrine do design system</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Primitivas do Cadência nos dois temas, com dados de exemplo. Visível só em desenvolvimento e preview.
      </p>
      <div className="grid gap-6 2xl:grid-cols-2">
        {(["claro", "escuro"] as const).map((tema) => (
          <section
            key={tema}
            aria-label={`Tema ${tema}`}
            className={cn("cad rounded-xl border bg-background p-5 text-foreground", tema === "escuro" && "dark")}
          >
            <h2 className="mb-4 text-sm font-medium">Tema {tema}</h2>
            <Amostras tema={tema} />
          </section>
        ))}
      </div>
    </main>
  )
}
