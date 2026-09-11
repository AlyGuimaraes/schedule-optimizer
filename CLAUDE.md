@AGENTS.md

# Cadência (Schedule Optimizer)

Sistema de gestão e otimização de agendas da operação de implantação LeverPro.

## Fontes de verdade

- Comportamento e regras: `docs/referencia/especificacao-cadencia.md` (v2.0).
- Design e estrutura de telas: `docs/referencia/cadencia-leverpro.html` (protótipo aprovado). Na dúvida entre spec e protótipo, siga o protótipo e registre a divergência no plano.
- Plano e estado de cada etapa: `docs/PLANO-DE-EXECUCAO.md`. Ao concluir uma tarefa, marque o checkbox e atualize o status da etapa.

## Convenções

- Idioma: interface, domínio, nomes de tabela e de função em português, como no protótipo (`premissas`, `cerimonia`, `otimizar`). Copy sem travessão.
- Tokens: nunca use cor fixa. Toda cor vem de `app/globals.css`, sempre com o par `-foreground`. Hues de fase e de cerimônia usam `--fh` com as variáveis `--cor-chip-*`.
- Números: `font-mono` + `tabular`, formatados em pt-BR (vírgula decimal), unidade separada do valor.
- Componentes: shadcn base-nova (Base UI, prop `render` em vez de `asChild`). Primitivas do produto ficam em `components/cadencia/`.
- Motor de domínio (`lib/dominio/`, a partir da E02): funções puras, sem estado global, determinísticas por seed, cobertas por teste de paridade com o protótipo.
- A IA nunca decide horário: agentes produzem demanda, configuração ou texto; a alocação é do solver.

## Comandos

- `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`
- Supabase (projeto `bvccnzvvzidefhiakrez`, sa-east-1): `supabase db push`, `supabase gen types typescript --linked`
- Vercel (time `leverproint`, projeto `schedule-optimizer`, região gru1): `pnpm dlx vercel@latest deploy`
