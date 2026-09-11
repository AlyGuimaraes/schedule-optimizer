# Cadência · Schedule Optimizer

Sistema de gestão e otimização de agendas da operação de implantação LeverPro. A agenda deixa de ser consequência das marcações individuais e passa a ser gerada por um otimizador a partir da demanda de cerimônias de cada projeto, da capacidade de cada pessoa e das premissas de tempo definidas pela gestão.

- Especificação: [docs/referencia/especificacao-cadencia.md](docs/referencia/especificacao-cadencia.md)
- Protótipo aprovado (abrir no navegador): [docs/referencia/cadencia-leverpro.html](docs/referencia/cadencia-leverpro.html)
- Plano de execução em 26 etapas: [docs/PLANO-DE-EXECUCAO.md](docs/PLANO-DE-EXECUCAO.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui base-nova (preset `b37aFvF3Y`) com a paleta LeverPro · Supabase (Postgres 17, Auth, RLS) · Vercel · Claude API na camada de IA · OR-Tools CP-SAT no solver de produção.

## Rodando localmente

```bash
pnpm install
pnpm dev
```

O `.env.local` precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para puxar as variáveis da Vercel:

```bash
pnpm dlx vercel@latest env pull --scope leverproint
```

## Infraestrutura

| Serviço | Recurso |
|---|---|
| Supabase | projeto `Schedule Optimizer`, ref `bvccnzvvzidefhiakrez`, região sa-east-1 |
| Vercel | time LEVERPRO (`leverproint`), projeto `schedule-optimizer`, funções em gru1 |
| GitHub | `AlyGuimaraes/schedule-optimizer` (pendente, ver seção 9 do plano) |

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` | build de produção |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript sem emitir |
| `pnpm format` | Prettier com ordenação de classes Tailwind |
