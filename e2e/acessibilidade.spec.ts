import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { esperarMotor, TELAS } from "./telas"

// axe (WCAG 2.1 A e AA) em todas as telas e na vitrine (E01, E17). Falha em violação séria ou
// crítica. A única exceção conhecida é o contraste da cor primária com texto, que aguarda a
// decisão D-14 do plano: o filtro abaixo tira só os nós em que o azul primário está envolvido.
const PRIMARIO = new Set(["#0084d1", "#80c2e8"])

const alvos = [...TELAS.map((t) => t.caminho), "/design"]

for (const caminho of alvos) {
  test(`axe sem violação séria em ${caminho}`, async ({ page }) => {
    await page.goto(caminho)
    if (caminho === "/design") await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    else await esperarMotor(page)
    // a tela entra com fade; contraste medido no meio da animação sai menor do que é
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity)
    )

    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    const graves = r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({
        id: v.id,
        nos: v.nodes.filter((n) => {
          if (v.id !== "color-contrast") return true
          const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string }
          return !PRIMARIO.has(d.fgColor ?? "") && !PRIMARIO.has(d.bgColor ?? "")
        }),
      }))
      .filter((v) => v.nos.length > 0)
      .map(
        (v) =>
          `${v.id}: ${v.nos
            .map((n) => {
              const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
              return d.fgColor ? `${n.target.join(" ")} (${d.fgColor} sobre ${d.bgColor}, ${d.contrastRatio})` : n.target.join(" ")
            })
            .join(", ")}`
      )
    expect(graves).toEqual([])
  })
}
