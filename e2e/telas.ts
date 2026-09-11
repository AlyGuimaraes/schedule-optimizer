import { expect, type Page } from "@playwright/test"

/** O motor terminou quando a linha de estado do cabeçalho mostra o tempo do solver. */
export async function esperarMotor(page: Page) {
  await expect(page.locator("header").getByText(/solver \d+ ms/)).toBeVisible()
}

/** As sete telas do app, com o título que o cabeçalho mostra. */
export const TELAS = [
  { caminho: "/cockpit", titulo: "Cockpit" },
  { caminho: "/agenda", titulo: "Agenda" },
  { caminho: "/otimizador", titulo: "Otimizador" },
  { caminho: "/projetos", titulo: "Projetos" },
  { caminho: "/time", titulo: "Time" },
  { caminho: "/premissas", titulo: "Premissas" },
  { caminho: "/indicadores", titulo: "Indicadores" },
]
