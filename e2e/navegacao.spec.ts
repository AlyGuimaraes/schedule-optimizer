import { expect, test } from "@playwright/test"

import { esperarMotor, TELAS } from "./telas"

for (const t of TELAS) {
  test(`${t.titulo} abre com dados e sem erro no console`, async ({ page }) => {
    const erros: string[] = []
    page.on("pageerror", (e) => erros.push(e.message))
    page.on("console", (m) => {
      // o websocket do recarregamento em desenvolvimento não é erro do app
      if (m.type() === "error" && !/webpack-hmr|WebSocket/i.test(m.text())) erros.push(m.text())
    })
    await page.goto(t.caminho)
    await expect(page.getByRole("heading", { level: 1, name: t.titulo })).toBeVisible()
    await esperarMotor(page)
    expect(erros).toEqual([])
  })
}

test("a raiz leva ao Cockpit", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/cockpit$/)
})

test("o menu lateral navega entre as telas", async ({ page }) => {
  await page.goto("/cockpit")
  await page.getByRole("link", { name: "Agenda" }).click()
  await expect(page).toHaveURL(/\/agenda/)
  await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible()
})

test("a resposta traz a CSP com nonce e os cabeçalhos de segurança", async ({ page }) => {
  const resposta = await page.goto("/cockpit")
  const h = resposta?.headers() ?? {}
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
  expect(h["x-frame-options"]).toBe("DENY")
  expect(h["x-content-type-options"]).toBe("nosniff")
})
