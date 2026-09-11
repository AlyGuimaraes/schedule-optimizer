import { n0 } from "@/lib/formato"

export interface Barra {
  /** rótulo do eixo */
  l: string
  /** valor */
  v: number
  /** texto do valor, quando diferente de n0(v) */
  t?: string
  /** linha de referência tracejada sobre a barra (teto) */
  ref?: number
  cor?: string
}

/**
 * Porte exato do `barras()` do protótipo: anatomia do Recharts usada pelo shadcn, com grade só
 * horizontal tracejada, eixos sem linha, barras com canto superior de 6px, rótulo de valor e
 * linha de referência por barra. Desenhado em SVG puro para ficar idêntico ao protótipo.
 */
export function GraficoBarras({
  dados,
  h = 170,
  valores = false,
  dicas = false,
  eixoY = true,
  alt = "gráfico de barras",
}: {
  dados: Barra[]
  h?: number
  valores?: boolean
  dicas?: boolean
  eixoY?: boolean
  alt?: string
}) {
  const W = 560
  const padT = 22
  const padB = 30
  const padL = eixoY ? 30 : 4
  const max = Math.max(...dados.map((d) => Math.max(d.v, d.ref ?? 0)), 0) * 1.18 || 1
  const util = h - padT - padB
  const lg = (W - padL - 6) / Math.max(dados.length, 1)
  const r = 6
  const texto = { fontFamily: "var(--font-sans)" }

  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={alt}>
      {[0, 1, 2, 3].map((i) => {
        const y = padT + util * (i / 3)
        return (
          <g key={i}>
            <line x1={padL} x2={W - 6} y1={y} y2={y} style={{ stroke: "var(--border)" }} strokeDasharray="3 3" />
            {eixoY ? (
              <text x={padL - 7} y={y + 4} fontSize={11} textAnchor="end" style={{ ...texto, fill: "var(--muted-foreground)" }}>
                {n0(max - max * (i / 3))}
              </text>
            ) : null}
          </g>
        )
      })}
      {dados.map((d, i) => {
        const alto = Math.max(util * (d.v / max), 2)
        const largura = lg * 0.62
        const x = padL + i * lg + (lg - largura) / 2
        const y = padT + util - alto
        const raio = Math.min(r, alto, largura / 2)
        const base = padT + util
        return (
          <g key={`${d.l}-${i}`}>
            <path
              d={`M${x},${base} L${x},${y + raio} Q${x},${y} ${x + raio},${y} L${x + largura - raio},${y} Q${x + largura},${y} ${x + largura},${y + raio} L${x + largura},${base} Z`}
              style={{ fill: d.cor ?? "var(--chart-1)" }}
              data-dica={dicas ? `${d.l}: ${d.t ?? n0(d.v)}` : undefined}
            >
              <animate attributeName="opacity" from="0" to="1" dur="0.35s" fill="freeze" />
            </path>
            {d.ref !== undefined ? (
              <line
                x1={x - 3}
                x2={x + largura + 3}
                y1={base - util * (d.ref / max)}
                y2={base - util * (d.ref / max)}
                style={{ stroke: "var(--foreground)" }}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.65}
              />
            ) : null}
            <text x={x + largura / 2} y={h - 10} fontSize={11} textAnchor="middle" style={{ ...texto, fill: "var(--muted-foreground)" }}>
              {d.l}
            </text>
            {valores ? (
              <text x={x + largura / 2} y={y - 6} fontSize={11} fontWeight={500} textAnchor="middle" style={{ ...texto, fill: "var(--foreground)" }}>
                {d.t ?? n0(d.v)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
