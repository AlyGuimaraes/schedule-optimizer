# Solver CP-SAT da Cadência (E15)

Serviço Python com OR-Tools CP-SAT e FastAPI que aloca **uma semana** de cerimônias. É o solver de produção previsto no §4.1 da especificação; o guloso de `lib/dominio/otimizador.ts` continua sendo o warm start, a referência e o fallback.

Por enquanto roda **só localmente**. Hospedagem, autenticação e fila dependem da decisão D-11 (ver [Estado](#estado)).

## Estrutura

| Caminho | O que é |
|---|---|
| `contrato/semana.schema.json` | contrato único (JSON Schema 2020-12) de requisição e resposta |
| `cadencia_solver/contrato.py` | o mesmo contrato em Pydantic (snake_case no Python, camelCase no JSON) |
| `cadencia_solver/modelo.py` | modelo CP-SAT, pós-processamento (motivos e concessões) e avaliação da dica gulosa |
| `cadencia_solver/api.py` | `GET /saude` e `POST /resolver` |
| `tests/` | pytest: regras rígidas, camadas, âncora, estabilidade, dica, API e paridade do contrato |
| `tests/dados/semana-1.json` | requisição real da semana 1 da semente, gerada pelo script de comparação |

Do lado do app: `lib/solver/contrato.ts` (tipos TS do contrato), `lib/solver/mapeamento.ts` (domínio ↔ contrato, puro), `lib/solver/cliente.ts` (server-only: chamada e fallback) e `scripts/solver-comparar.ts`.

## Rodando localmente

Precisa de Python 3.12. Se o sistema só tem outra versão, o `uv` instala uma (`uv python install 3.12`).

```bash
cd solver
python3.12 -m venv .venv            # ou: uv venv --python 3.12 .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python -m pytest          # cerca de 25 s; a semana da semente leva 20 s
.venv/bin/uvicorn cadencia_solver.api:app --port 8000
```

Com o serviço no ar, na raiz do repositório:

```bash
pnpm solver:comparar                          # guloso × CP-SAT na semana 1, com validarPlano
SOLVER_LIMITE=20 pnpm solver:comparar         # limite menor do CP-SAT, em segundos
SOLVER_URL=http://127.0.0.1:8765 pnpm solver:comparar
pnpm solver:comparar --exportar               # regrava tests/dados/semana-1.json
```

Variáveis de ambiente:

| Variável | Onde | Efeito |
|---|---|---|
| `SOLVER_URL` | app | endereço do serviço. Sem ela, `otimizarComSolver` usa o guloso |
| `SOLVER_TOKEN` | app e serviço | segredo compartilhado, enviado como `Authorization: Bearer`. Sem ele no serviço, `/resolver` fica aberto |

## API

- `GET /saude` devolve `{"status": "ok", "versaoContrato": "1", "ortools": "9.x"}`.
- `POST /resolver` recebe `RequisicaoSemana` e devolve `RespostaSemana`. Campo fora do contrato dá 422.

A requisição leva a demanda da semana com as cadeiras de cada cerimônia (titular e candidatos à troca), as pessoas com as premissas **já resolvidas** no alvo e no máximo que o perfil autoriza ceder, as premissas gerais, o acumulado do mês, a âncora e a posição no plano vigente de cada cerimônia, a dica gulosa e as opções (`limiteSegundos` 60, `workers` 8, `semente` 0, `avaliarDica`). O TS resolve cargo, exceção e perfil; o Python não repete essas fórmulas.

A resposta traz as alocadas com dia, slot, camada, participantes e trocas, as não alocadas com motivo no vocabulário do guloso, as concessões, o status do CP-SAT, o objetivo, o limite inferior e `objetivoDica`, que é o objetivo do plano guloso no mesmo modelo.

## Modelo

**Variáveis.** Uma booleana por cerimônia × dia × slot inicial, só para inícios que passam no pré-filtro de jornada, almoço, dia protegido, duração máxima e janela protegida de cada participante (R4, R6, R7, R13). Para cadeiras com candidatos, uma booleana por candidato × início, somando exatamente o início escolhido (camada 2). Uma booleana `rel` por obrigatória (camada 3). Um escape `nao` por obrigatória.

**Restrições rígidas** (as mesmas de `lib/dominio/validador.ts`):

- R1, R2: exatamente um início ou o escape para obrigatória; no máximo um para opcional
- R3, R5: intervalos opcionais por pessoa com `AddNoOverlap`, cada um estendido pelo intervalo obrigatório; os dias ficam separados na linha do tempo para o intervalo não vazar de um dia para o outro
- R6, R7: início só relaxado exige `rel`; troca de cadeira nunca junto com `rel`
- R8, R9: reuniões e minutos por pessoa e dia, com a folga do perfil só no dia em que a pessoa tem cerimônia relaxada
- R10: minutos na semana até o teto mais uma variável de folga limitada ao limite aceitável, que só abre com cerimônia relaxada da pessoa
- R11: minutos na semana até o orçamento mensal pró-rata menos o acumulado
- R12: toda cadeira ocupada pelo titular ou por um candidato do mesmo cargo

**Objetivo.** Soma ponderada, em inteiros, com os termos que vêm do guloso na mesma escala dele × 100:

| Termo | Como entra | Peso |
|---|---|---|
| w3 não alocada | escape por cerimônia | 100.000 obrigatória (+50.000 com SLA, +10.000 por nível de prioridade, +1.000 × score); 15.000 opcional |
| camada 3 | por cerimônia relaxada, mais a folga semanal | 30.000 + 100 por minuto acima do teto |
| camada 2 | por cadeira trocada | 8.000 |
| âncora (§12) | início fora da âncora | 20.000 |
| w1 fragmentação | `custoDia` do guloso linearizado: livre fora de bloco de foco + ½ por bloco | 100 × `pesoFrag` do perfil |
| w4 contexto | dia com reunião, projeto distinto no dia | 120 e 30 |
| w5 desbalanceamento | diferença de ocupação do teto entre pessoas do mesmo cargo, em milésimos | 1 |
| w6 estabilidade | início diferente do plano vigente | 100 × `pesoEstabilidade` |
| w7 preferência | slot fora da faixa preferencial, por participante | 100 × `pesoPreferencia` |
| w8 prazo | dia e slot, mais forte com SLA | 240/dia e 6/slot com SLA; 2 e 1 sem |

A ordem das camadas do §4.3 sai dos pesos: dentro do alvo custa zero, trocar cadeira custa menos que relaxar, e relaxar custa menos que perder uma obrigatória. Uma opcional custa menos que uma concessão, então uma opcional nunca provoca camada 3.

**Pós-processamento.** As concessões seguem a regra de `registrar` do guloso: as relaxadas entram depois de todas as outras, em ordem de prioridade, e cada participante registra o que passou do alvo. O motivo de não alocação usa as mesmas frases do guloso.

**Warm start.** A solução gulosa entra com `AddHint`, com cadeiras e relaxamento. Com `avaliarDica`, o serviço também resolve o modelo com a dica fixada, o que dá o objetivo do guloso na mesma função e permite comparar os dois de forma justa.

## Resultado na semana 1 da semente

Medido em 11/09/2026 num Mac Apple Silicon, com 8 workers e limite de 60 s (`pnpm solver:comparar`):

| | guloso | CP-SAT |
|---|---:|---:|
| alocadas (de 58) | 56 | 56 |
| cobertura total | 96,6% | 96,6% |
| cobertura obrigatória | 98,1% | 100% |
| SLA | 88,9% | 100% |
| trocas de cadeira (camada 2) | 5 | 9 |
| relaxadas (camada 3) | 3 | 0 |
| concessões | 3 | 0 |
| violações rígidas (`validarPlano`) | 0 | 0 |
| objetivo (menor é melhor) | 189.289 | −52.813 |
| tempo | 4,7 ms | 60,6 s |

O CP-SAT parou no limite de tempo com gap de 11,2% (status `viavel`, cerca de 20 mil variáveis). Ele aloca a obrigatória que o guloso perdia e troca uma opcional por outra. As três concessões somem porque ele usa mais trocas de cadeira.

## Estado

Feito, só local:

- serviço, modelo, contrato em JSON Schema, Pydantic e TS, com teste de paridade dos dois lados
- cliente server-only com fallback para o guloso quando falta URL, a chamada falha ou estoura o tempo, o solver não acha solução, a resposta sai do contrato, `validarPlano` acha violação ou o CP-SAT fica pior que o guloso no mesmo objetivo
- comparação guloso × CP-SAT na semana 1 da semente

Depende da D-11 (hospedagem):

- container e deploy (Cloud Run southamerica-east1 ou equivalente) e token assinado no lugar do segredo compartilhado
- fila `solver_jobs` no Supabase, disparo pela server action e gravação do resultado pelo worker

Ainda em aberto, independente da D-11:

- ligar `otimizarComSolver` ao app e ao horizonte: o cliente resolve uma semana; `simular` ainda chama só o guloso. Com 60 s por semana, 4 semanas passam dos 3 minutos do critério 3, então o limite por semana ou a paralelização precisa de ajuste
- camadas como otimização lexicográfica de verdade (hoje são pesos), pesos por perfil além de `pesoFrag` e decomposição por squad acima de um limiar
- bateria de sementes para o critério "igual ou melhor que o guloso em 95% dos casos". O teste da semente 7 e o fallback por objetivo já cobrem a semana 1
- determinismo: com 8 workers e limite de tempo, duas execuções podem dar planos diferentes. Para reproduzir, use `workers: 1` ou um limite de tempo determinístico
