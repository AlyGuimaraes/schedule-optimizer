import type { ReactNode } from "react"

import type { Etapa, Health } from "@/lib/dominio"
import { estiloHue, hueCer, hueFase } from "@/lib/cores"
import { n1 } from "@/lib/formato"
import { cn } from "@/lib/utils"

// Primitivas visuais do protótipo, com as mesmas classes de app/cadencia.css.

export type Tom = "ok" | "aviso" | "ruim" | "neutro" | "acento"
export type Delta = { d: number; bom: boolean; suf: string }

export function delta(antes: number, depois: number, menorMelhor: boolean, suf = ""): Delta {
  const d = depois - antes
  return { d, bom: menorMelhor ? d < 0 : d > 0, suf }
}

/** Card de indicador (.ind): rótulo, valor em mono, unidade separada e linha de contexto fixa. */
export function Indicador({
  rotulo,
  valor,
  un,
  tom,
  contexto,
  delta: v,
}: {
  rotulo: string
  valor: ReactNode
  un?: string
  tom?: "bom" | "ruim" | ""
  contexto?: ReactNode
  delta?: Delta
}) {
  // o rodapé também é um dd do mesmo termo: dentro de <dl> só cabem dt e dd (axe, definition-list)
  let rodape = <dd className="var">{contexto ?? " "}</dd>
  if (v) {
    const igual = Math.abs(v.d) < 0.05
    const seta = igual ? "=" : v.d > 0 ? "▲" : "▼"
    rodape = (
      <dd className={cn("var", !igual && (v.bom ? "sobe" : "desce"))}>
        {seta} {n1(Math.abs(v.d))}
        {v.suf} vs. atual
      </dd>
    )
  }
  return (
    <dl className="ind">
      <dt>{rotulo}</dt>
      <dd className={tom || undefined}>
        {valor}
        <small>{un ?? ""}</small>
      </dd>
      {rodape}
    </dl>
  )
}

export function Faixa({ children }: { children: ReactNode }) {
  return <div className="faixa">{children}</div>
}

export function SecCab({
  titulo,
  apoio,
  style,
}: {
  titulo: ReactNode
  apoio?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div className="sec-cab" style={style}>
      <h2>{titulo}</h2>
      {apoio !== undefined ? <span className="apoio">{apoio}</span> : null}
    </div>
  )
}

export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={cn("selo", tom)}>{children}</span>
}

export function SeloFase({ fase, etapas }: { fase: string; etapas: Record<string, Etapa> }) {
  if (!etapas[fase]) return <span className="selo neutro">etapa removida</span>
  return (
    <span className="selo fase" style={estiloHue(hueFase(etapas, fase))}>
      {etapas[fase].rotulo}
    </span>
  )
}

export function TagCerimonia({ tipo }: { tipo: string }) {
  return (
    <span className="tag-cer" style={estiloHue(hueCer(tipo))}>
      {tipo}
    </span>
  )
}

const COR_HEALTH: Record<Health, string> = {
  verde: "var(--ok)",
  amarelo: "var(--warn)",
  vermelho: "var(--bad)",
}

export function Ponto({ health }: { health: Health }) {
  return <span className="ponto" style={{ background: COR_HEALTH[health] }} />
}

export function Health({ health }: { health: Health }) {
  return (
    <>
      <Ponto health={health} />
      {health}
    </>
  )
}

/** Progress com marcador de limite (.trilha). */
export function Trilha({
  valor,
  max,
  limite,
  tom,
}: {
  valor: number
  max: number
  limite?: number
  tom?: "ok" | "ruim" | ""
}) {
  return (
    <div className="trilha">
      <i className={tom || undefined} style={{ width: `${Math.min((valor / max) * 100, 100)}%` }} />
      {limite !== undefined ? (
        <span className="marca-lim" style={{ left: `${Math.min((limite / max) * 100, 100)}%` }} />
      ) : null}
    </div>
  )
}

/** Tom da trilha de ocupação: acima de 100% ruim, acima do limiar em primary, abaixo em success. */
export const tomOcupacao = (ocup: number, limiar = 85): "ok" | "ruim" | "" =>
  ocup > 100 ? "ruim" : ocup > limiar ? "" : "ok"

export function Abas<T extends string>({
  abas,
  ativa,
  onChange,
}: {
  abas: { id: T; rotulo: string; apoio: string }[]
  ativa: T
  onChange: (id: T) => void
}) {
  return (
    <div className="abas" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          className="aba"
          role="tab"
          aria-selected={ativa === a.id}
          onClick={() => onChange(a.id)}
        >
          {a.rotulo}
          <em>{a.apoio}</em>
        </button>
      ))}
    </div>
  )
}

export function Chave({
  ligada,
  onChange,
  children,
}: {
  ligada: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <button type="button" className="chave" aria-pressed={ligada} onClick={() => onChange(!ligada)}>
      <i />
      {children}
    </button>
  )
}

export function Painel({
  titulo,
  children,
  className,
  corpoStyle,
}: {
  titulo: string
  children: ReactNode
  className?: string
  corpoStyle?: React.CSSProperties
}) {
  return (
    <section className={cn("painel", className)}>
      <header>
        <h3>{titulo}</h3>
      </header>
      <div className="corpo" style={corpoStyle}>
        {children}
      </div>
    </section>
  )
}

export function Aviso({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return (
    <div className="aviso" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <b>{titulo}</b>
      {children ? <p>{children}</p> : null}
    </div>
  )
}

export function IconeCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Estado vazio (.vazio): explica por que está vazio e o que fazer. */
export function VazioTela({
  titulo,
  children,
  acao,
}: {
  titulo: string
  children?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="vazio">
      <div className="media">
        <IconeCalendario />
      </div>
      <b>{titulo}</b>
      {children}
      {acao ? <div style={{ marginTop: 12 }}>{acao}</div> : null}
    </div>
  )
}

/** Terminal da execução em camadas. */
export function Terminal({ linhas, animado }: { linhas: [string, string][]; animado: boolean }) {
  return (
    <div className="terminal">
      {linhas.map(([classe, texto], i) => (
        <div key={i} className={classe || undefined} style={{ animationDelay: `${animado ? i * 0.13 : 0}s` }}>
          {texto}
        </div>
      ))}
    </div>
  )
}

/** Esqueleto com a forma de uma tela: faixa de indicadores e dois blocos (§14.8). */
export function EsqueletoTela() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="faixa">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ind" style={{ gap: 10 }}>
            <div className="esqueleto" style={{ width: "55%" }} />
            <div className="esqueleto" style={{ height: 22, width: "40%" }} />
            <div className="esqueleto" style={{ width: "70%" }} />
          </div>
        ))}
      </div>
      <div className="colunas c-ab sec">
        {[0, 1].map((b) => (
          <div key={b} style={{ display: "grid", gap: 9 }}>
            <div className="esqueleto" style={{ width: "30%", height: 12 }} />
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="esqueleto" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
