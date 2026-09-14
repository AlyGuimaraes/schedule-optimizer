import { defineConfig, devices } from "@playwright/test"

// o teste de cadastro limpa o banco de demonstração pela API; as chaves vêm do .env.local
try {
  process.loadEnvFile(".env.local")
} catch {
  // sem o arquivo, a limpeza é pulada
}

// Testes de ponta a ponta (E05, E17). Rodam contra o servidor de desenvolvimento, que precisa do
// .env.local com o Supabase, e usam o Chrome instalado na máquina: nenhum navegador é baixado.
//   pnpm e2e
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } },
    },
  ],
  // no CI o build já aconteceu: sobe o servidor de produção, com a vitrine liberada
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITRINE: "1" },
  },
})
