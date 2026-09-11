# Camada de IA (`lib/ia`)

Fundação da E18 e Narrador da E20, prontos no código e **desligados até existir `ANTHROPIC_API_KEY`**.

Regra de arquitetura (§4.5): a IA nunca decide horário. Os agentes produzem demanda, configuração ou texto; a alocação é do solver. Isso é garantido na estrutura: nenhum contrato de saída tem campo de hora, dia, slot, início ou fim (teste `tests/unit/ia/guardrail.test.ts`), e o Orquestrador só propõe um diff que nunca é aplicado sem aprovação humana.

## Liga e desliga

- `iaDisponivel()` é verdadeiro só com `ANTHROPIC_API_KEY` não vazia.
- Sem a chave: nenhum cliente é criado, nenhuma requisição sai e nada é gravado em `agente_execucoes`. O Narrador devolve a leitura determinística; Classificador e Orquestrador devolvem `null`. A página do Otimizador passa `narradorIa={false}` e a tela nem chama a server action: visual e comportamento iguais aos de antes da E18.
- Para ligar: cadastrar `ANTHROPIC_API_KEY` como variável sensível na Vercel (produção e preview) e em `.env.local` no desenvolvimento, e refazer o deploy. Antes disso, ver "Ativação em produção" abaixo.

## Arquivos

| Arquivo | Papel |
|---|---|
| `cliente.ts` | Só no servidor. `iaDisponivel()`, cliente criado na primeira chamada, `chamarAgente()`: modelo `claude-opus-5`, pensamento adaptativo, esforço por agente, fallback do servidor, saída estruturada Zod, recusa conferida antes do conteúdo, erros tipados e registro |
| `registro.ts` | Só no servidor. Monta a linha de `agente_execucoes` (função pura `montarRegistro`) e grava pelo `clienteAdmin()`. Falha do banco vira aviso no log, nunca derruba a resposta |
| `contratos/` | Schemas Zod versionados das saídas: Classificador (`classificador.v1`), Narrador (`narrador.v1`), Orquestrador (`orquestrador.v1`) |
| `entradas.ts` | Schemas Zod das entradas, com limites de tamanho. Validados no servidor antes de qualquer chamada |
| `prefixo.ts` | Glossário comum, blocos do `system` com breakpoints de cache e serialização estável |
| `resumo.ts` | Funções puras: `resumirExecucao` (resultado do otimizador) e `contextoDaOperacao` (premissas vigentes, etapas, playbook) |
| `leitura-deterministica.ts` | A "Leitura do agente" do Otimizador, extraída do JSX. Usada pela tela e como reserva do Narrador. O teste `tests/unit/ia/leitura.test.ts` confere que o HTML é idêntico ao do JSX antigo |
| `agentes/narrador.ts` | Resumo executivo e alertas; reserva determinística |
| `agentes/classificador.ts` | Fase, health, justificativa e confiança; fase conferida contra a lista enviada; `null` sem chave. Ainda não ligado à tela |
| `agentes/orquestrador.ts` | Comando vira diff de premissas, perfil ou peso (`montarDiff`), sempre `aplicada: false`; `null` sem chave. Ainda não ligado à tela |
| `acoes.ts` | Server action `narrarResultado`, usada pelo painel "Leitura do agente" |

## Decisões

- **Modelo e profundidade.** `claude-opus-5` em todos os agentes, com `thinking: { type: "adaptive" }` explícito (já é o padrão do modelo). Esforço em `output_config.effort`: Classificador `low`, Narrador `medium`, Orquestrador `high`.
- **Fallback do servidor.** `fallbacks: "default"` com o beta `server-side-fallback-2026-07-01`, pelo endpoint `client.beta.messages`: se o classificador de segurança recusar, a API refaz a chamada no modelo recomendado para a categoria. `resposta.model` diz quem respondeu e vai para o registro. Esse parâmetro não existe na Batches API nem em Bedrock, Vertex ou Foundry.
- **Recusa antes do conteúdo.** A chamada usa `create` com o formato do helper `betaZodOutputFormat` e só faz o parse depois de conferir `stop_reason`. O plano fala em `messages.parse`; a troca é intencional: o `parse` do SDK interpreta todos os blocos de texto antes de qualquer checagem, e numa recusa o conteúdo pode vir parcial. `refusal`, `max_tokens` e saída fora do contrato viram status próprios no registro e fazem o agente cair na reserva.
- **Retries e erros.** SDK com `maxRetries: 3` e timeout de 120 s (429, 5xx e rede são retentados pelo SDK). O que sobra é classificado pelas classes tipadas (`AuthenticationError`, `RateLimitError`, `APIConnectionError` etc.) e registrado com `status = 'erro'`.
- **Cache de prompt.** `system` em dois blocos, cada um com `cache_control`: (1) glossário e instruções do agente; (2) premissas vigentes, etapas e playbook, serializados com chaves ordenadas. O resultado da execução, que muda sempre, vai na mensagem do usuário, depois do último breakpoint. O perfil fica fora do prefixo porque o gestor troca de perfil a toda hora.
- **Registro.** Toda chamada feita grava agente, entrada, saída, modelo, tokens, custo, duração e versão (`<prompt>+<contrato>`). `tokens_entrada` é o prompt inteiro (sem cache, escrita e leitura de cache); o detalhe de cache fica em `saida.cache`. O custo é estimado pela tabela de preços do código (US$ 5 de entrada e US$ 25 de saída por milhão; escrita de cache a 1,25 vez, leitura a 0,1 vez). Enquanto o login da E03 não existe, grava com a service role, como o resto do app.

## O que falta e depende da chave

Nada abaixo foi executado contra a API; não há custo medido nem resposta real observada.

1. **Avaliações por agente** (critério de aceite da E18): casos reais anonimizados, critério de nota e custo medido por execução, rodados com a chave antes de ativar qualquer agente em produção.
2. **Confirmar o cache na prática:** a segunda chamada com a mesma configuração precisa mostrar `saida.cache.leitura > 0` no registro. O prefixo precisa passar de 512 tokens no Opus 5 para cachear.
3. **Confirmar o beta de fallback** na conta (`server-side-fallback-2026-07-01`). Se a API recusar o header, tirar `betas` e `fallbacks` de `cliente.ts`: a recusa continua tratada e cai na reserva.
4. **Streaming do Narrador para a tela.** Hoje a action espera a resposta inteira e só então troca o texto. O streaming pede um route handler com `client.beta.messages.stream`.
5. **Batches API** para o Classificador semanal sobre os 112 projetos (metade do custo). O fallback do servidor não vale na Batches API.
6. **Sentinela** (realizado contra planejado), que depende também da leitura dos calendários (E09) e da escrita (E16).
7. **Cron da E21** (sexta às 14:00): Sentinela, Classificador, Planejador, solver, Narrador e link do diff para o gestor.
8. **Agentes da E19 e interface da E20:** Classificador na tela Projetos com aceitar e rejeitar, Planejador de Cadência, Compositor de Squad, e o Orquestrador com tool runner (`ler_premissas`, `ler_cenario`, `simular_alteracao`, `propor_alteracao`) e a interface de comando com diff.
9. **Ativação em produção.** A server action é alcançável por POST direto e, com a chave, cada chamada custa. Antes de cadastrar a chave em produção: login (E03), autorização na action e limite de taxa (E17).
