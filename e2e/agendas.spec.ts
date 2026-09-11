import { expect, test } from "@playwright/test"

import { esperarMotor } from "./telas"

// Grava no banco de demonstração: importa o .ics de exemplo para uma pessoa e limpa em seguida.
// A limpeza no final remove a importação mesmo se algum passo falhar.
const PESSOA = "Ana Ribeiro"

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` }
  const r = await fetch(`${url}/rest/v1/pessoas?select=id&nome=eq.${encodeURIComponent(PESSOA)}`, { headers: cabecalhos })
  const [p] = (await r.json()) as { id: string }[]
  if (!p) return
  await fetch(`${url}/rest/v1/eventos_externos?pessoa_id=eq.${p.id}&provedor=eq.ics`, { method: "DELETE", headers: cabecalhos })
  await fetch(`${url}/rest/v1/importacoes_agenda?pessoa_id=eq.${p.id}`, { method: "DELETE", headers: cabecalhos })
})

test("importar um .ics, ver a prévia e o resumo, e limpar a agenda importada", async ({ page }) => {
  await page.goto("/time?aba=agendas")
  await esperarMotor(page)
  const linha = page.locator("tr", { hasText: PESSOA })

  // importar
  await linha.getByRole("button", { name: "importar" }).click()
  await page.locator("#imArquivo").setInputFiles("tests/fixtures/agenda-exemplo.ics")
  await expect(page.getByRole("heading", { name: "Prévia" })).toBeVisible()
  const confirmar = page.getByRole("button", { name: /^Importar \d+ blocos$/ })
  await confirmar.click()
  await expect(confirmar).toBeHidden()
  await expect(linha.getByRole("button", { name: "limpar" })).toBeVisible()
  await expect(linha).not.toContainText("sem agenda")

  // a agenda da pessoa continua abrindo com os bloqueios aplicados
  await page.goto("/agenda?pessoas=0&semana=1")
  await esperarMotor(page)

  // limpar
  await page.goto("/time?aba=agendas")
  await esperarMotor(page)
  await linha.getByRole("button", { name: "limpar" }).click()
  await page.getByRole("button", { name: "Limpar agenda" }).click()
  await expect(linha).toContainText("sem agenda")
})
