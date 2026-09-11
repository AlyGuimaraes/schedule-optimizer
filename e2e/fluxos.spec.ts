import { expect, test } from "@playwright/test"

import { esperarMotor } from "./telas"

// Fluxos de leitura: nenhum teste aqui grava no banco.

test("Agenda de uma pessoa mostra datas reais nos dias da semana", async ({ page }) => {
  await page.goto("/agenda?pessoas=0&semana=1")
  await esperarMotor(page)
  await expect(page.locator(".grade .gh").nth(1)).toContainText(/Segunda \d{2}\/\d{2}/)
})

test("E se: a curva de contratação responde com a leitura", async ({ page }) => {
  await page.goto("/otimizador?aba=simulacao")
  await page.getByRole("button", { name: "Simular curva" }).click()
  await expect(page.getByRole("cell", { name: "+0" })).toBeVisible()
  await expect(page.getByText(/déficit/).first()).toBeVisible()
})

test("Ausências lista os feriados nacionais cadastrados", async ({ page }) => {
  await page.goto("/time?aba=ausencias")
  await expect(page.getByRole("cell", { name: "Nossa Senhora Aparecida" }).first()).toBeVisible()
})

test("o seletor de cenário lista as premissas atuais", async ({ page }) => {
  await page.goto("/cockpit")
  await esperarMotor(page)
  await page.getByRole("button", { name: "Escolher o cenário comparado" }).click()
  await expect(page.getByRole("menuitem", { name: /Premissas atuais/ })).toBeVisible()
})

test("Premissas por cargo mostra o custo por hora", async ({ page }) => {
  await page.goto("/premissas?aba=cargo")
  await expect(page.getByRole("heading", { name: "Custo por hora do cargo" })).toBeVisible()
})

test("Indicadores mostram o custo por cliente e o benchmark", async ({ page }) => {
  await page.goto("/indicadores")
  await expect(page.getByRole("heading", { name: "Custo por cliente" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Benchmark por volume de produtos" })).toBeVisible()
})
