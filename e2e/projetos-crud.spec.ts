import { expect, test } from "@playwright/test"

import { esperarMotor } from "./telas"

// Único teste que grava no banco de demonstração: cria um projeto, edita trocando fase e time e
// exclui. A limpeza no final remove o projeto e o cliente de teste mesmo se algum passo falhar.
const NOME = "Zeta Verificação E2E A"
const CLIENTE = "Zeta Verificação E2E"

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` }
  await fetch(`${url}/rest/v1/projetos?nome=eq.${encodeURIComponent(NOME)}`, { method: "DELETE", headers: cabecalhos })
  await fetch(`${url}/rest/v1/clientes?nome=eq.${encodeURIComponent(CLIENTE)}`, { method: "DELETE", headers: cabecalhos })
})

test("criar, editar com troca de fase e de time, e excluir um projeto", async ({ page }) => {
  await page.goto("/projetos")
  await esperarMotor(page)
  const salvar = page.getByRole("button", { name: "Salvar projeto" })

  // criar
  await page.getByRole("button", { name: "Novo projeto" }).click()
  await page.getByLabel("Cliente e projeto").fill(NOME)
  await page.getByLabel("Fase", { exact: true }).selectOption("kickoff")
  await salvar.click()
  await expect(salvar).toBeHidden()
  await page.getByLabel("Buscar cliente").fill(CLIENTE)
  const linha = page.locator("tr", { hasText: NOME })
  await expect(linha).toBeVisible()
  await expect(linha).toContainText("Kickoff")

  // editar: outra fase e outro time
  await linha.getByRole("button", { name: "editar" }).click()
  await page.getByLabel("Fase", { exact: true }).selectOption("discovery")
  const time = page.getByLabel("Time responsável")
  const atual = await time.inputValue()
  const opcoes = await time.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
  await time.selectOption(opcoes.find((v) => v !== atual) ?? atual)
  await salvar.click()
  await expect(salvar).toBeHidden()
  await expect(linha).toContainText("Discovery")

  // excluir
  await linha.getByRole("button", { name: "excluir" }).click()
  await page.getByRole("button", { name: "Excluir projeto" }).click()
  await expect(linha).toBeHidden()
})
