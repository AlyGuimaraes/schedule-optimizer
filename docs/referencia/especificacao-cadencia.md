# Cadência
## Sistema de Gestão e Otimização de Agendas
### Operação de Implantação LeverPro · Especificação consolidada v2.0

Documento único. Consolida todos os requisitos levantados ao longo da conversa, a especificação funcional completa, a especificação de interface e o registro de decisões. Substitui o documento de escopo anterior.

---

# Parte I · Registro de requisitos

Cada linha registra o que foi pedido, o requisito derivado, a decisão tomada e onde ela vive no produto. Serve para auditar se o protótipo cobre o que foi solicitado e para retomar o contexto em qualquer ponto.

## Rodada 1 · Conceito inicial

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R01 | Sistema de gestão de agendas para o time de operação de implantação | Produto próprio, não um calendário genérico | Módulo Cadência, integrado ao ecossistema LeverPro | todo o produto |
| R02 | Analistas, especialistas, líderes e outras cadeiras nos projetos | Papel como entidade de primeira classe | Cargo governa a agenda, não a pessoa | §2.1, tela Time |
| R03 | Mais de 100 projetos simultâneos, time de cerca de 20 pessoas | Escala de 100+ projetos com 20 pessoas | 112 projetos e 20 pessoas na simulação | tela Projetos |
| R04 | Cada projeto tem N produtos (3 relatórios, 5 dashboards) | Contagem de produtos por projeto | Relatórios, dashboards e integrações por projeto | tela Projetos |
| R05 | Reuniões de trabalho, status report e outros tipos | Catálogo de tipos de cerimônia | Playbook com 13 tipos distribuídos em 6 fases | aba Playbook |
| R06 | Cada tipo exige combinação específica de pessoas | Cargos obrigatórios por cerimônia | Quórum rígido: sem os cargos, a cerimônia não existe | §3.2 |
| R07 | Manter tempo mínimo de trabalho, por exemplo 80% | Piso de tempo produtivo | Alvo de tempo produtivo por cargo | aba Por cargo |
| R08 | E um tanto Y de reuniões | Teto de tempo em reunião | Teto derivado do alvo, travado por máximo absoluto | §2.4 |
| R09 | Otimizador de agenda | Alocação automática sob restrições | Solver guloso com custo de fragmentação, em três camadas | §4 |
| R10 | Feito com IA | Camada de inteligência | Agentes para classificar, planejar, narrar e monitorar; o solver decide o horário | §4.5 |
| R11 | Planejamento para tanto tempo à frente | Horizonte configurável | 2, 4, 6 ou 8 semanas | tela Otimizador |
| R12 | Situação do cliente: início, após 3 meses e assim por diante | Fase do projeto define a cadência | 6 fases com playbook próprio | §3.1 |
| R13 | Configurações personalizadas nas premissas | Premissas editáveis | Todas as premissas editáveis em tela, com recálculo imediato | tela Premissas |
| R14 | Indicadores de número de reuniões por mês e tempo de reuniões | Métricas mensais | Reuniões e pessoa-hora por mês, por pessoa, cargo, projeto e etapa | tela Indicadores |

## Rodada 2 · Premissas por cargo

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R15 | Campos editáveis nas premissas | Edição direta, não leitura | Inputs numéricos na própria célula da tabela | aba Por cargo |
| R16 | Premissas em tabela, porque tem que ser por cargo | Matriz cargo × premissa | Uma linha por cargo, doze campos editáveis, cinco colunas calculadas | aba Por cargo |
| R17 | É isso que define as premissas da otimização | O cargo é a unidade de restrição | Toda restrição do solver é avaliada por participante, pelo cargo dele | §4.2 |

## Rodada 3 · Cadastros

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R18 | Poder incluir projetos | CRUD de projetos | Criar, editar e excluir, com squad por cargo exigido pela fase | tela Projetos |
| R19 | Poder incluir times | CRUD de pessoas | Criar, editar e excluir, com reatribuição automática de cadeiras | tela Time |
| R20 | Revisão geral com isso | Consistência das contagens e dos avisos | Contagens vivas, aviso de squad incompleto, aviso de cargo sem gente | telas Projetos e Time |
| R21 | (derivado) | Absorver entrada e saída de pessoas | Ação explícita de redistribuir alocação, nunca automática | tela Time |

## Rodada 4 · Premissas como alvo

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R22 | O otimizador tem que considerar as premissas do cenário | Premissa como objetivo, não só como corte | Alvo mais tolerância declarada por cargo | §2.4 |
| R23 | As premissas simuladas têm que ver o que queremos | Separar desejado de possível | Quadro Desejado contra possível, por cargo | tela Otimizador |
| R24 | Otimizar ao máximo o que é possível | Relaxamento controlado e auditável | Três camadas, com registro de cada concessão | §4.3 |
| R25 | (derivado) | O que não cabe precisa virar decisão | Déficit estrutural em FTE por cargo | tela Otimizador |

## Rodada 5 · Ajuste de interface

| # | O que foi pedido | Decisão | Onde |
|---|---|---|---|
| R26 | Tirar o grupo de alertas do cockpit | Removido. O conteúdo vive na tela de Time e no quadro do otimizador | tela Cockpit |

## Rodada 6 · Premissas gerais

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R27 | Tempo permitido entre as agendas | Intervalo obrigatório entre cerimônias | Sem intervalo, 30 ou 60 minutos, padrão 30 | aba Gerais |
| R28 | Melhores horas para as agendas | Faixa preferencial de horário | Faixa clicável de 20 blocos de meia hora, com peso de 0 a 4 | aba Gerais |
| R29 | Tempo máximo de reunião por tipo de cargo | Duração máxima de uma cerimônia | Campo por cargo, relaxável na camada 3 | aba Por cargo |
| R30 | (derivado) | Jornada e almoço configuráveis | Início e fim da jornada, início e duração do almoço, dia protegido | aba Gerais |

## Rodada 7 · Agenda, projetos e urgência

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R31 | Filtros de agenda por cliente | Recorte por projeto | Seletor de projeto que troca a agenda para a do cliente, com a pessoa destacada | tela Agenda |
| R32 | Agenda mensal, não só semanal | Duas escalas | Grade de semanas por dias, cobrindo o horizonte inteiro | tela Agenda |
| R33 | Horas de reunião definidas para cada projeto | Consumo por projeto | Cerimônias por semana, pessoa-hora por semana e por mês | tela Projetos |
| R34 | Horas de reunião para cada etapa | Consumo por fase | Consolidado por etapa com participação percentual nas horas | tela Projetos |
| R35 | Nível de urgência por etapa e por cliente | Prioridade que reordena a fila | Urgência de 1 a 5 e prazo em dias úteis por etapa, peso por prioridade de cliente | aba Urgência |
| R36 | Kickoff em até 7 dias úteis do fechamento do contrato | SLA de etapa | Prazo de até 7 dias marca cerimônia crítica, com três efeitos no solver | §4.4 |

## Rodada 8 · Tempo máximo acumulado

| # | O que foi pedido | Requisito derivado | Decisão | Onde |
|---|---|---|---|---|
| R37 | Tempo máximo de reuniões para cada cargo | Teto absoluto em horas, não só percentual | Máximo por semana e orçamento por mês, acumulado pró-rata | §2.4 |

## Rodada 10 · Ajustes de organização

| # | O que foi pedido | Decisão | Onde |
|---|---|---|---|
| R42 | Periodicidade de reuniões por etapa, recorrentes | Playbook editável: duração, recorrência, prioridade e obrigatoriedade na linha, mais criar e excluir cerimônia | aba Playbook |
| R43 | Indicadores superiores desalinhados e com números estranhos | Linha de contexto sempre presente, unidade separada do número, altura fixa, sem valores sem unidade | todas as telas com faixa |
| R44 | Tipos abaixo da agenda em formato de tag | Legenda em tags arredondadas, listando só os tipos presentes na semana visível | tela Agenda |
| R45 | Agenda mensal maior | Células de 138px, até 6 cerimônias por dia antes do resumo | tela Agenda |
| R46 | Otimizador melhor organizado | Três blocos, com as quatro tabelas de detalhe em abas | tela Otimizador |
| R47 | Cadastro de cargos no Time | Time com abas Pessoas e Cargos, incluindo renomeação que propaga | tela Time |
| R48 | Cabeçalho da tabela de cargos quebrando linha, colunas com larguras diferentes | Cabeçalho em dois níveis com grupos, rótulos em linha única, layout fixo com colunas iguais, coluna de cargo congelada e faixa de totais | aba Por cargo |
| R49 | Trocar blocos de foco e SLA de etapa na faixa do cockpit | Entraram reunião por pessoa no mês e déficit de capacidade em FTE; os dois substituídos seguem nas telas de diagnóstico | tela Cockpit |
| R50 | Selecionar mais de uma pessoa e múltiplos clientes na agenda, inclusive todos | Filtros de seleção múltipla com busca, selecionar todos e limpar; nada marcado significa tudo; blocos simultâneos em faixas lado a lado; painel lateral agregado | tela Agenda |
| R51 | Novo projeto e demais editores devem abrir em modal, sem interferir na tela | Todos os editores e confirmações migrados para modal com escurecimento, Esc, clique fora e foco no primeiro campo | telas Projetos, Time, Premissas |
| R52 | Etapas editáveis, tirar e colocar novas, como nos projetos | CRUD de etapas na aba Urgência, com urgência e prazo próprios, playbook próprio e destino obrigatório para os projetos ao remover | aba Urgência |
| R53 | Instalar e atualizar o design com shadcn/ui | Tokens oficiais em OKLCH com base slate e primary azul LeverPro, mais o arquivo de tema pronto para um projeto React | Parte III e leverpro-shadcn-theme.css |
| R54 | Componentes ainda fora do padrão, gráficos e menu entre eles | Revisão componente a componente: sidebar com as constantes oficiais, gráficos na anatomia do Recharts do shadcn, além de alert, empty, dialog com X, tooltip, progress, switch e trigger | Parte III, tabela de componentes |
| R55 | Aplicar o preset `b1YofKqES` | Preset decodificado localmente a partir do pacote npm; tokens montados com as escalas mist, sky e blue; fonte Inter | Parte III e leverpro-shadcn-theme.css |
| R56 | Criar times, com os projetos de cada squad | Time como entidade, projeto pertence a um time, squad montado só com membros dele; CRUD completo e remanejo na exclusão | §2.0, tela Time, aba Times |
| R57 | Análise de se precisamos de mais gente ou está demais, e para quais cargos | Quadro de pessoal por cargo com demanda teórica, capacidade, horas sem quórum, saldo em FTE, situação e recomendação em número de pessoas; mais capacidade por time | tela Indicadores |
| R58 | Definir quais cargos são obrigatórios em cada tipo de reunião | Cargos editáveis por cerimônia no playbook, com indicação de em quantos times aquele cargo existe | aba Playbook |

## Rodada 9 · Interface

| # | O que foi pedido | Decisão | Onde |
|---|---|---|---|
| R38 | Playbook em aba separada nas premissas | Quatro abas: Gerais, Por cargo, Urgência, Playbook | tela Premissas |
| R39 | Botão para abrir e fechar o menu | Rail colapsa para 56px, só ícones | topo do rail |
| R40 | Modo claro e escuro | Tokens OKLCH com dois temas completos | todo o produto |
| R41 | Refazer o artefato do zero | Interface reescrita sobre as skills de UI instaladas | Parte III |

---

# Parte II · Especificação funcional

## 1. Contexto e objetivos

A operação de implantação opera com cerca de 20 profissionais em mais de 100 projetos simultâneos. A agenda hoje se forma por acúmulo: cada líder marca o que precisa no horário que encontra livre. O resultado é erosão do tempo produtivo, fragmentação, gargalo nos cargos sênior, cadência igual para projetos em fases distintas e ausência de números confiáveis.

Cadência inverte a lógica. A agenda deixa de ser consequência das marcações individuais e passa a ser gerada por um otimizador a partir de três insumos: a demanda de cerimônias derivada da fase e do escopo de cada projeto, a capacidade e disponibilidade real de cada pessoa, e as premissas de política de tempo definidas pela gestão.

| # | Objetivo | Métrica |
|---|---|---|
| O1 | Garantir tempo produtivo mínimo por cargo | cada pessoa dentro do alvo do próprio cargo |
| O2 | Preservar blocos de trabalho profundo | ao menos 3 blocos por pessoa por semana, na duração definida para o cargo |
| O3 | Padronizar a cadência por fase | 100% dos projetos com playbook aplicado |
| O4 | Balancear a carga entre pessoas do mesmo cargo | desvio padrão da taxa de reunião abaixo de 5 p.p. |
| O5 | Dar visibilidade gerencial | reuniões e horas por mês, por pessoa, cargo, projeto e etapa |
| O6 | Planejar com antecedência | horizonte de 2 a 8 semanas, replanejado semanalmente |

**Fora de escopo na v1:** substituir Google Calendar ou Outlook como agenda pessoal; gestão de tarefas e execução do trabalho; timesheet de horas realizadas; alocação financeira; matriz de competências individuais, já que a v1 assume intercambiabilidade dentro do cargo.

## 2. Premissas

### 2.0 Times

O time é a unidade de alocação. Cada projeto pertence a um time, e o squad dele é montado **apenas com membros daquele time**, pelo cargo que a etapa exige e pela menor carga interna. É isso que impede colocar qualquer pessoa em qualquer projeto.

Uma pessoa pode estar em mais de um time, o que resolve o caso dos cargos escassos: existe um único Arquiteto de Dados e um único Líder Técnico para quatro squads, então eles circulam por todos. Analistas e Especialistas ficam em um time só.

A consequência operacional é direta: se o time não tem ninguém do cargo obrigatório de uma cerimônia, aquela cerimônia não acontece nos projetos dele, por falta de quórum. O sistema mostra isso em três lugares, na lista de times, no editor de time e no formulário de projeto, sempre nomeando o cargo que falta.

### 2.1 Três escopos

```
Gerais  →  Por cargo  →  Por pessoa  →  Por projeto
```

O nível mais específico vence. Toda sobreposição tem vigência e autor registrados. A v1 implementa os dois primeiros níveis em tela; pessoa e projeto entram na fase 2.

### 2.2 Premissas gerais

Valem para todos, independentemente do cargo.

| Premissa | Padrão | Tipo | O que governa |
|---|---|---|---|
| Início da jornada | 08:00 | rígida | primeiro horário possível para qualquer cerimônia |
| Fim da jornada | 18:00 | rígida | último horário possível |
| Início do almoço | 12:00 | rígida | bloqueio total, sem exceção por perfil |
| Duração do almoço | 1h | rígida | |
| Intervalo entre reuniões | 30 min | rígida | respiro obrigatório antes e depois de cada cerimônia |
| Horários preferenciais | 10:00 às 12:00 e 13:00 às 16:00 | flexível | faixa em que o solver procura primeiro |
| Força da preferência | 1,5 numa escala de 0 a 4 | peso | 0 ignora a faixa, 4 só sai dela sem alternativa |
| Dia protegido | nenhum | rígida | nenhum, sexta à tarde ou sexta inteira |
| Quórum mínimo | 100% dos cargos obrigatórios | rígida | sem quórum, a cerimônia não existe |
| Antecedência de convocação | 48h | rígida | nenhuma alocação abaixo desse prazo |
| Estabilidade de agenda | máximo de 20% movidas por ciclo | flexível | limite de mudança a cada replanejamento |

### 2.3 Premissas por cargo

Doze campos editáveis por cargo. Esta é a principal superfície de configuração do produto.

| Campo | Unidade | Tipo |
|---|---|---|
| Jornada | h/semana | entrada |
| Fator de ausência | % | entrada |
| Tempo institucional | h/semana | entrada |
| Tempo produtivo alvo | % | alvo |
| Tolerância | p.p. | alvo |
| Máximo de reuniões por dia | contagem | rígida |
| Máximo de horas de reunião por dia | h | rígida |
| Máximo de horas de reunião por semana | h | rígida |
| Máximo de horas de reunião por mês | h | rígida, acumulada |
| Duração máxima de uma reunião | h | rígida |
| Bloco mínimo de foco | h | flexível |
| Janela protegida | h | rígida |

Cinco colunas calculadas acompanham cada linha: capacidade líquida, teto do alvo, limite aceitável, carga média realizada e situação.

**Matriz padrão sugerida**

| Cargo | Jorn. | Ausên. | Inst. | Alvo | Tol. | Reun./dia | h/dia | h/sem | h/mês | Dur. máx. | Bloco foco | Janela prot. | Cap. líq. | Teto | Limite |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Analista | 40h | 10% | 3h | 82% | 4 | 4 | 3,0h | 8h | 30h | 2,0h | 2,0h | 2,0h | 33,0h | 5,9h | 7,3h |
| Analista Sênior | 40h | 10% | 4h | 78% | 5 | 5 | 3,5h | 9h | 34h | 2,0h | 2,0h | 2,0h | 32,0h | 7,0h | 8,6h |
| Especialista | 40h | 12% | 4h | 75% | 6 | 5 | 4,0h | 10h | 38h | 2,0h | 2,0h | 2,0h | 31,2h | 7,8h | 9,7h |
| Arquiteto de Dados | 40h | 10% | 3h | 85% | 3 | 3 | 2,5h | 6h | 22h | 1,0h | 3,0h | 3,0h | 33,0h | 5,0h | 6,0h |
| Líder Técnico | 40h | 12% | 6h | 65% | 8 | 6 | 5,0h | 13h | 48h | 2,0h | 2,0h | 1,0h | 29,2h | 10,2h | 12,6h |
| Gerente de Projeto | 40h | 12% | 6h | 58% | 10 | 8 | 6,0h | 16h | 60h | 1,5h | 1,0h | 0h | 29,2h | 12,3h | 15,2h |

A lógica dos números: quanto mais o cargo produz artefato, maior o piso de tempo produtivo e maior a janela protegida. Quanto mais o cargo coordena, menor o piso e maior a tolerância a fragmentação, porque a agenda picotada é a própria natureza do trabalho dele.

### 2.4 Alvo, tolerância e os quatro tetos

A distinção mais importante do modelo: **premissa não é corte, é alvo.**

- O **alvo** é o que a gestão quer para aquele cargo.
- A **tolerância** declara, em pontos percentuais, quanto o cargo aceita ceder quando a alternativa é deixar uma cerimônia obrigatória sem acontecer.
- O **limite aceitável** é a soma dos dois. Abaixo dele o sistema nunca vai, prefere reportar demanda não atendida.

Um sistema que trata a premissa apenas como teto rígido devolve "não coube" e para. Um que ignora a premissa devolve uma agenda que ninguém cumpre. O modelo com tolerância declarada faz a terceira coisa: otimiza até o máximo possível dentro do que foi autorizado, e mostra exatamente o que precisou ceder e para quem.

O tempo máximo de reunião é declarado em quatro escalas, todas valendo ao mesmo tempo:

| Escala | Campo | Natureza |
|---|---|---|
| Uma reunião | duração máxima | limita a cerimônia individual |
| Um dia | máximo de h/dia | impede o dia inteiro consumido por cerimônia |
| Uma semana | máximo de h/semana | teto absoluto em horas |
| Um mês | máximo de h/mês | orçamento acumulado |

O teto semanal efetivo é o menor entre o que o alvo percentual permite e o máximo absoluto de horas. A tolerância negocia o percentual, nunca o número absoluto declarado. O teto mensal é o único cumulativo: aplicado pró-rata ao longo do horizonte, de modo que uma semana pesada reduz o que sobra para as seguintes. É o campo que impede o padrão de duas semanas tranquilas seguidas de duas impossíveis.

### 2.5 Urgência por etapa e por cliente

Nem toda cerimônia tem o mesmo direito à agenda.

| Etapa | Urgência | Prazo em dias úteis | Efeito |
|---|---|---|---|
| Kickoff | 5 | 7 | prazo crítico, primeiro na fila, início da semana |
| Go-live | 5 | 5 | prazo crítico |
| Discovery | 4 | 10 | entra antes na fila |
| Homologação | 4 | 10 | entra antes na fila |
| Construção | 2 | 15 | cede lugar quando falta capacidade |
| Sustentação | 1 | 30 | última da fila |

Peso da prioridade do cliente: alta 3, média 2, baixa 1.

**Score = urgência da etapa × peso do cliente.** É esse número que reordena a fila. Um kickoff de cliente prioritário tem score 15, um check-in de sustentação de cliente de baixa prioridade tem score 1.

Prazo de até 7 dias úteis marca a cerimônia como crítica de SLA, com três consequências: entra na frente da fila mesmo à frente de cerimônias de prioridade formal maior; o custo de alocá-la em dias posteriores é multiplicado, empurrando para segunda ou terça; e se for adiada, vira violação de SLA, indicador de primeira linha.

O peso da urgência na fila depende do perfil de otimização: o perfil Prioridade ao cliente dá a ela mais de duas vezes o peso que o perfil Foco máximo dá.

## 3. Playbook de cerimônias

### 3.1 Catálogo por fase

| Fase | Cerimônia | Duração | Cadência | Cargos obrigatórios | Tipo |
|---|---|---|---|---|---|
| Kickoff | Kickoff Executivo | 60 min | quinzenal | Gerente de Projeto, Analista Sênior, Líder Técnico | obrigatória |
| Kickoff | Levantamento de Requisitos | 90 min | semanal | Especialista, Analista Sênior | obrigatória |
| Discovery | Reunião de Trabalho | 90 min | semanal | Analista, Especialista | obrigatória |
| Discovery | Status Report | 45 min | a cada 3 semanas | Gerente de Projeto, Analista Sênior | obrigatória |
| Discovery | Validação de Dados | 60 min | a cada 4 semanas | Arquiteto de Dados, Analista Sênior | opcional |
| Construção | Reunião de Trabalho | 60 min | a cada 4 semanas | Analista, Especialista | obrigatória |
| Construção | Status Report | 30 min | a cada 6 semanas | Líder Técnico | obrigatória |
| Construção | Validação de Produto | 60 min | a cada 8 semanas | Analista Sênior, Especialista | opcional |
| Homologação | Sessão de Homologação | 90 min | semanal | Especialista, Analista Sênior | obrigatória |
| Homologação | Status Report | 45 min | quinzenal | Gerente de Projeto, Líder Técnico | obrigatória |
| Go-live | Acompanhamento Pós Go-live | 30 min | quinzenal | Analista | obrigatória |
| Go-live | Treinamento de Usuários | 120 min | a cada 8 semanas | Especialista, Analista | opcional |
| Sustentação | Check-in de Sustentação | 30 min | a cada 8 semanas | Analista | obrigatória |

### 3.2 Quórum e atribuição de cadeiras

Duas regras decorrem do catálogo:

1. **Uma cerimônia só existe se o squad cobre todos os cargos obrigatórios.** Se um projeto em Homologação não tem Especialista alocado, a Sessão de Homologação não entra na demanda e o projeto aparece marcado como squad incompleto. O sistema não gera reunião fantasma nem substitui silenciosamente por outro cargo.
2. **A cadeira é do cargo, não da pessoa.** É isso que permite o rebalanceamento automático e a reatribuição em caso de saída do time. A contrapartida é a premissa de intercambiabilidade dentro do cargo. Quando ela não valer, será preciso uma matriz de skill por tipo de produto, o que muda o modelo de dados.

### 3.3 Modificadores automáticos

- **Volume de produtos:** mais uma sessão de validação a cada 3 produtos acima da mediana.
- **Health do projeto:** amarelo acrescenta um status report por semana; vermelho acrescenta uma sala de guerra semanal e escala para o Líder Técnico.
- **Criticidade do cliente:** clientes de prioridade alta têm checkpoint executivo mensal obrigatório em todas as fases.
- **Atraso de cronograma:** desvio acima de 10 dias dobra a cadência de status report até a recuperação.

## 4. Motor de otimização

### 4.1 Formulação

Problema de agendamento com restrições de recursos e janelas de tempo, resolvido como programação por restrições.

```
Conjuntos
  P pessoas · C cerimônias do horizonte · T slots de 30 min · Part(c) ⊆ P

Variável
  x[c,t] ∈ {0,1}   cerimônia c inicia no slot t

Restrições rígidas
  (R1) Σ_t x[c,t] ≤ 1                                   unicidade
  (R2) Σ_t x[c,t] = 1        ∀c obrigatória             alocação garantida
  (R3) sem sobreposição por pessoa                       agenda física
  (R4) janela de trabalho e almoço                       premissa geral
  (R5) intervalo obrigatório antes e depois              premissa geral
  (R6) janela protegida do cargo                         premissa de cargo
  (R7) duração da cerimônia ≤ duração máxima do cargo    premissa de cargo
  (R8) reuniões no dia ≤ máximo do cargo                 premissa de cargo
  (R9) horas no dia ≤ máximo do cargo                    premissa de cargo
  (R10) horas na semana ≤ teto efetivo                   alvo ou limite absoluto
  (R11) horas acumuladas ≤ orçamento mensal pró-rata     premissa de cargo
  (R12) quórum de 100% dos cargos obrigatórios           playbook
  (R13) dia protegido                                    premissa geral

Objetivo
  min  w1·fragmentação + w2·desvio do alvo + w3·não alocadas
     + w4·trocas de contexto + w5·desbalanceamento entre pares
     + w6·instabilidade contra o plano vigente
     + w7·slots fora da faixa preferencial
     + w8·atraso de cerimônia com prazo crítico
```

Escala: cerca de 60 cerimônias por semana, 20 pessoas, 4 semanas de horizonte. O protótipo resolve em dezenas de milissegundos com heurística gulosa; em produção, CP-SAT com limite de tempo de 60 a 120 segundos entrega solução ótima ou muito próxima.

### 4.2 Avaliação por participante

Toda restrição de cargo é avaliada participante a participante dentro da mesma cerimônia, e a mais restritiva vence. Uma reunião entre Arquiteto de Dados e Gerente de Projeto só pode cair num horário que respeite as duas políticas ao mesmo tempo. É por isso que o Arquiteto, com janela protegida de 3h, empurra as reuniões dele para depois das 11:00 mesmo quando o Gerente estaria livre às 8:30.

### 4.3 As três camadas

O solver nunca cede uma premissa antes de esgotar o que não custa nada. A ordem é fixa e cada camada é reportada separadamente.

| Camada | O que faz | O que pode ceder |
|---|---|---|
| 1. Dentro do alvo | aloca respeitando integralmente as premissas alvo | nada |
| 2. Rebalanceamento de cadeira | troca o participante por outro do mesmo cargo com folga | nada, só muda quem participa |
| 3. Relaxamento controlado | só para cerimônia obrigatória, usa a tolerância na medida autorizada pelo perfil | teto, limites diários, duração e janela protegida, sempre dentro do limite aceitável e com registro |
| Residual | o que não cabe vira déficit estrutural em FTE por cargo | nada, é decisão de contratação ou de cadência |

Cerimônia opcional nunca aciona a camada 3. Se não coube no alvo, espera o próximo ciclo.

Cada concessão gera um registro auditável: pessoa, cargo, premissa cedida, valor alvo, valor aplicado e a cerimônia que motivou.

### 4.4 Perfis de otimização

O perfil traduz a prioridade da gestão em comportamento do solver.

| Perfil | Tolerância usada | Reun./dia extra | h/dia extra | Cede janela | Fila |
|---|---|---|---|---|---|
| Foco máximo | 40% | 0 | 0 | não | prioridade da cerimônia |
| Equilíbrio | 100% | +1 | +0,5h | não | prioridade da cerimônia |
| Prioridade ao cliente | 100% | +2 | +1,0h | sim | criticidade do cliente |
| Estabilidade | 70% | +1 | +0,5h | não | prioridade, ancorada por dia da semana |

Com os alvos apertados em 7 p.p. sobre o padrão, o trade-off aparece:

| Perfil | Aderência ao alvo | Cobertura obrigatória | Déficit |
|---|---|---|---|
| Foco máximo | 85% | 76,9% | 6,1 FTE |
| Equilíbrio | 60% | 84,6% | 4,3 FTE |
| Prioridade ao cliente | 60% | 82,7%, zero adiada em projeto vermelho | 4,5 FTE |

**Perfis só divergem sob escassez.** Quando a demanda cabe no alvo, os quatro convergem para o mesmo plano. Isso é o comportamento correto, não um defeito.

### 4.5 Camada de IA

O solver resolve o problema combinatório. A IA faz o que o solver não faz: interpretar contexto, gerar a demanda e explicar o resultado.

| Agente | Responsabilidade | Entrada | Saída |
|---|---|---|---|
| Classificador | determinar fase e health real | histórico de entregas, atas, tarefas em aberto | fase, health e justificativa |
| Planejador de Cadência | converter fase e escopo em demanda | projeto, playbook, modificadores | séries e ocorrências necessárias |
| Compositor de Squad | sugerir quem participa | cargos obrigatórios, alocação, senioridade | lista de participantes com quórum |
| Orquestrador | traduzir intenção em configuração | comando em linguagem natural | pesos e restrições |
| Narrador | explicar o plano e os trade-offs | solução e indicadores | resumo executivo e alertas |
| Sentinela | monitorar desvio e propor replanejamento | agenda realizada contra planejada | proposta de reotimização com diff |

**Ponto de arquitetura:** a IA nunca decide horário. Ela decide o que precisa acontecer e explica o que aconteceu. A alocação temporal é determinística e auditável, requisito para que o time confie no sistema.

## 5. Modelo de cálculo

```
Capacidade líquida (Cl)   = jornada × (1 − fator_ausência) − tempo_institucional
Teto do alvo              = Cl × (1 − produtivo_mínimo)
Teto efetivo (T)          = min( teto do alvo , máximo absoluto de h/semana )
Limite aceitável          = min( Cl × (1 − alvo + tolerância) , máximo absoluto )
Orçamento mensal (M_w)    = máximo de h/mês × w / 4,33        [w = semana do horizonte]

Horas de reunião (R)      = Σ duração das cerimônias da pessoa
Taxa de reunião (τ)       = R / Cl
Tempo produtivo (π)       = 1 − τ           restrição: π ≥ alvo do cargo
Ocupação do teto (ω)      = R / T           indicador operacional principal

Horas livres (L)          = Cl − R
Horas em foco (F)         = Σ blocos livres contíguos ≥ bloco mínimo do cargo
Fragmentação (φ)          = 1 − F / L
```

Fragmentação de 0,45 significa que quase metade do tempo livre está picotada em janelas curtas demais para modelagem. É o indicador que explica por que alguém com 82% de tempo livre ainda não entrega.

## 6. Indicadores

| Indicador | Fórmula | Alvo | Granularidade |
|---|---|---|---|
| Tempo produtivo | 1 − R/Cl | alvo do cargo | pessoa, cargo, time |
| Aderência ao alvo | pessoas dentro do teto / total | 95% ou mais | cargo, time |
| Ocupação do teto | R/T | até 100% | pessoa, cargo |
| Cobertura do playbook | alocadas / demanda | 95% no total, 100% nas obrigatórias | cenário, projeto |
| SLA de etapa | críticas alocadas / total de críticas | 100% | etapa, cenário |
| Alocadas com concessão | contagem | monitorado | cargo, pessoa |
| Déficit estrutural | horas obrigatórias não atendidas / teto do cargo | zero FTE | cargo |
| Reuniões por mês | contagem | conforme o cargo | pessoa, projeto, etapa |
| Horas de reunião por mês | Σ duração | conforme o cargo | pessoa, projeto, etapa |
| Horas por projeto | Σ duração × participantes | referência interna | projeto |
| Horas por etapa | idem, agregado por fase | referência interna | etapa |
| Blocos de foco | contagem semanal | 3 ou mais | pessoa |
| Fragmentação | 1 − F/L | até 0,35 | pessoa |
| Estabilidade do plano | 1 − movidas / total | 80% ou mais | cenário |
| Custo de cerimônia | Σ horas × custo-hora do cargo | monitorado | projeto, cliente |

## 7. Telas

### 7.1 Cockpit
Seis indicadores no topo, escolhidos pelo que muda decisão: tempo produtivo, aderência ao alvo, cobertura do playbook, reunião por pessoa no mês, déficit de capacidade em FTE e cerimônias adiadas. Cada um traz a variação contra a agenda atual ou uma linha de contexto.

Blocos de foco e SLA de etapa saíram desta faixa. Não porque deixaram de importar, mas porque são leituras de diagnóstico e não de decisão: blocos de foco continua por pessoa na tela de Time e na comparação do otimizador, e SLA de etapa continua na faixa do otimizador e na lista de demanda não atendida. Abaixo, o mapa de calor de carga por pessoa e dia, com intensidade relativa ao máximo diário do cargo, e a ocupação do teto por cargo com o marcador do limite. Fecha com portfólio por fase e pessoa-hora por tipo de cerimônia.

### 7.2 Agenda
A grade é o elemento principal da tela e ocupa cerca de três quartos da largura. Os controles vivem numa barra compacta acima dela: um seletor de escala entre Semana e Mês, e duas pílulas de filtro, Pessoas e Clientes, ambas de seleção múltipla.

Cada pílula abre um painel com busca, lista de caixas de seleção, Selecionar todos e Limpar seleção. A convenção é que **nada marcado significa tudo**: sem pessoa marcada a agenda mostra o time inteiro, sem cliente marcado mostra todos os projetos. As duas seleções se combinam por interseção, então é possível ver as cerimônias de três clientes específicos apenas para dois especialistas, ou o time inteiro de um único cliente.

O painel lateral se adapta à seleção. Uma pessoa e nenhum cliente mostra a agenda individual, com a janela protegida do cargo desenhada na grade. Um cliente mostra os dados do projeto, com a pessoa destacada quando há também uma pessoa selecionada. Qualquer outra combinação mostra o painel agregado: cerimônias, horas de agenda, pessoa-hora, pessoas e projetos envolvidos, quantas com concessão, quantas acima do teto, a carga de cada pessoa contra o próprio teto e a distribuição por tipo.

Com várias pessoas selecionadas, cerimônias simultâneas deixam de se sobrepor: a grade distribui os blocos concorrentes em faixas lado a lado dentro do mesmo dia, dividindo a largura igualmente.

O cabeçalho de cada dia traz o total de horas de cerimônia daquele dia, ou a palavra livre, o que dá a leitura da distribuição sem precisar contar blocos. A visão semanal usa linhas de 31px, com janela de trabalho, almoço, janela protegida, horários fora da faixa preferencial sombreados e cerimônias com concessão em borda tracejada. A legenda abaixo é discreta, em 10px, listando apenas os tipos presentes na semana visível. A visão mensal cobre o horizonte inteiro em semanas por dias, que é onde a cadência quinzenal e mensal aparece.

### 7.3 Otimizador
Organizado em três blocos. No topo, seis indicadores do cenário. No meio, duas colunas: à esquerda o painel de configuração, com horizonte, perfil, rebalanceamento e o resumo do que aquele perfil autoriza ceder; à direita a execução camada a camada e a leitura do agente. Embaixo, um bloco com abas, para que as quatro tabelas de detalhe não empilhem numa rolagem única:

- **Resultado**: o quadro Desejado contra possível, por cargo, mais a comparação com a agenda atual.
- **Concessões**: cada premissa cedida, com pessoa, cargo, valor alvo, valor aplicado e a cerimônia que motivou.
- **Trocas de cadeira**: quem saiu e quem entrou, resolvido na camada 2 sem ceder premissa.
- **Não atendida**: o que não coube nem com tolerância, com tipo e motivo.

Cada aba tem estado vazio próprio, porque zero concessões e zero pendências são resultados bons e precisam ser lidos como tal.

### 7.4 Projetos
Consolidado por etapa no topo, com urgência, prazo, cerimônias e horas por semana e por mês, mais a participação percentual nas horas. Abaixo, a lista com busca por cliente e filtro por fase, mostrando fase, mês, prioridade, produtos, squad, cerimônias e horas. Criação e edição acontecem em editor expandido na própria linha.

### 7.5 Time
Três abas. **Pessoas** traz o cadastro do time com capacidade líquida, alvo, teto, projetos, cerimônias, horas, ocupação do teto, taxa, folga, blocos de foco, fragmentação, reuniões e horas no mês contra o orçamento mensal. Duas operações de manutenção importam: saída de pessoa, que reatribui as cadeiras pela menor carga e avisa quando não há substituto no cargo; e redistribuir alocação, que refaz todas as cadeiras e existe como ação explícita, porque remexer em 112 projetos é decisão de gestão e não efeito colateral de cadastro.

**Times** é o cadastro dos squads: nome, membros marcados por cargo, quantos projetos carregam, cerimônias por semana, horas por mês, ocupação contra o teto somado dos membros e a cobertura de cargos das etapas que os projetos dele atravessam. O editor avisa, no momento da edição, se tirar alguém deixa o time sem um cargo exigido. Excluir um time obriga a escolher para onde vão os projetos, e os squads são remontados com os membros do time de destino.

**Cargos** é o cadastro do cargo em si: criar, renomear e excluir, com quantas pessoas o ocupam, quem são, alvo, teto, máximo mensal, quantas cerimônias do playbook o exigem e a carga média realizada. Renomear propaga para as pessoas, para os squads de todos os projetos e para o playbook, numa operação só. Excluir é bloqueado enquanto houver gente no cargo e avisa quantas cerimônias ficarão sem quórum. Os valores das premissas continuam em Premissas, aba Por cargo: aqui fica o cadastro, lá ficam as regras.

### 7.6 Premissas
Quatro abas. **Gerais** traz jornada, almoço, intervalo, dia protegido, força da preferência e a faixa clicável de horários. **Por cargo** traz a matriz de doze campos com cinco colunas calculadas em tempo real. **Urgência** traz o cadastro das etapas do ciclo, com urgência, prazo, contagem de projetos e de cerimônias, mais o peso por prioridade de cliente. As etapas são editáveis: criar uma nova, renomear e remover. A etapa nova nasce sem cerimônias e recebe o playbook dela na aba Playbook. Ao remover uma etapa que ainda tem projetos, o modal exige escolher para qual etapa eles vão, e o playbook da etapa removida é descartado junto. **Playbook** traz o catálogo que gera toda a demanda, agora editável. Duração, recorrência, prioridade na fila e obrigatoriedade são editadas na própria linha. A recorrência é o campo de maior alcance: mudar a reunião de trabalho de Construção de quatro para duas semanas leva a demanda de 58 para 64 cerimônias na semana, e o cenário é replanejado a cada alteração. Também é possível criar uma cerimônia nova, escolhendo etapa, duração, recorrência, prioridade, obrigatoriedade e os cargos exigidos, e excluir uma existente. Criar ou excluir dispara a remontagem dos squads, porque uma cerimônia nova pode exigir um cargo que ainda não tinha cadeira naquela fase. Cada linha mostra o consumo real: cerimônias por mês, pessoa-hora por mês e participação percentual na agenda do time.

### 7.7 Indicadores
Seis métricas mensais, séries por semana de cerimônias e pessoa-hora, taxa de reunião por cargo contra o teto e o consolidado mensal por cargo.

O bloco central é o **quadro de pessoal**, que responde se falta ou sobra gente e em qual cargo. Para cada cargo: quantas pessoas, teto por pessoa, capacidade total, demanda, horas perdidas por falta de quórum, ocupação, saldo em FTE, situação e recomendação.

A demanda usada aqui **não é a agenda alocada, é a demanda teórica do playbook**, contando inclusive as cerimônias que hoje não acontecem porque o time não tem o cargo. Essa diferença é o ponto: olhar só o que foi alocado esconde exatamente a falta que se quer medir. A coluna "sem quórum" isola essas horas.

A situação é classificada em cinco faixas: sem ninguém, falta gente quando o saldo é pior que menos um quarto de FTE, no limite acima de 88% de ocupação, folga abaixo de 45%, e equilibrado no meio. A recomendação é escrita em número de pessoas, não em percentual.

Abaixo dele, a **capacidade por time**: pessoas, projetos, capacidade, carga, ocupação e cargos ausentes, que é a leitura de quem pode receber mais um cliente e quem não pode.

## 8. Arquitetura e integrações

```
Interface Cadência (Next.js)
        │
API de Cadência  ──  Solver CP-SAT (worker)
        │            Levi, agentes via Claude API
        │            Sincronização Google Calendar / Microsoft Graph
        │
Núcleo de Dados: projetos, pessoas, alocação, ocorrências, premissas, cenários, histórico
```

| Sistema | Direção | Uso |
|---|---|---|
| Google Calendar, Microsoft Graph | bidirecional | leitura de bloqueios e ausências, escrita das ocorrências |
| Módulo de Tarefas | leitura | carga de trabalho em aberto, para calibrar necessidade de foco |
| Módulo de Projetos | leitura | fase, produtos, cronograma, health |
| RH | leitura | ausências programadas |
| Levi | bidirecional | classificação, planejamento e narrativa |

Ocorrências geradas recebem identificador próprio para permitir reconciliação. Eventos criados fora do Cadência são lidos como bloqueios opacos: reduzem disponibilidade mas não entram nos indicadores de cerimônia de projeto. Conflito detectado gera proposta de realocação, nunca sobrescrita silenciosa.

## 9. Modelo de dados

```sql
pessoas(id, nome, papel, senioridade, ativo)
premissas_cargo(papel, jornada, fator_ausencia, tempo_institucional, produtivo_min,
                tolerancia, max_reunioes_dia, max_horas_dia, max_horas_semana,
                max_horas_mes, duracao_max, bloco_foco_min, janela_protegida,
                vigencia_inicio, vigencia_fim, autor)
premissas_gerais(chave, valor, vigencia_inicio, vigencia_fim, autor)
premissas_override(id, escopo, escopo_id, campo, valor, vigencia_inicio, vigencia_fim, autor)
etapas(fase, urgencia, prazo_dias)
prioridades_cliente(nivel, peso)

clientes(id, nome, prioridade, sla)
projetos(id, cliente_id, nome, fase, mes, inicio, golive_alvo, health)
produtos(id, projeto_id, tipo, complexidade, status)
alocacoes(id, projeto_id, pessoa_id, papel, inicio, fim)

tipos_cerimonia(id, nome, duracao, papeis_obrigatorios, obrigatoria, prioridade)
playbooks(id, fase, tipo_cerimonia_id, cadencia)
series(id, projeto_id, tipo_cerimonia_id, cadencia, inicio, fim, ancorada)
ocorrencias(id, serie_id, cenario_id, inicio, fim, status, relaxada, calendar_event_id)
participantes(ocorrencia_id, pessoa_id, obrigatorio, confirmado)
concessoes(id, cenario_id, ocorrencia_id, pessoa_id, premissa, valor_alvo, valor_aplicado)

cenarios(id, nome, horizonte_inicio, horizonte_fim, perfil, status, criado_em)
kpis_snapshot(id, cenario_id, pessoa_id, periodo, taxa, horas, fragmentacao, blocos_foco)
```

## 10. Fluxos

**Planejamento semanal, toda sexta.** Sentinela coleta o realizado e os desvios. Classificador reavalia fase e health. Planejador gera a demanda das próximas semanas. Solver otimiza mantendo âncoras confirmadas. Narrador produz o resumo. Gestor revisa o diff, ajusta o que for necessário e publica. Sincronização escreve nos calendários com 48h de antecedência.

**Entrada de novo projeto.** Projeto criado com cliente, fase, produtos e squad. Playbook instanciado automaticamente. Otimização incremental encaixa as novas cerimônias sem desmontar o plano vigente. Sem capacidade viável, o sistema devolve o déficit em horas e em FTE por cargo, insumo direto para decisão de contratação.

**Simulação de cenário.** Gestor duplica o cenário vigente, altera premissas, executa e compara indicadores lado a lado. Decide entre aplicar, descartar ou manter como plano alternativo.

## 11. Roadmap

| Fase | Duração | Entrega |
|---|---|---|
| 1. Fundação | 4 semanas | cadastros, playbook, cálculo de capacidade e indicadores sobre a agenda importada. Pela primeira vez existe o número real de horas de reunião do time |
| 2. Otimizador | 6 semanas | premissas editáveis, solver, cenários, escrita nos calendários, cockpit e agenda |
| 3. Camada de IA | 4 semanas | agentes, replanejamento automático, comandos em linguagem natural |
| 4. Inteligência operacional | 6 semanas | déficit e simulação de contratação, integração com tarefas, custo por cliente, benchmark por tipo de produto |

## 12. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Rejeição do time | alto | janela protegida definida pela própria pessoa, justificativa visível em cada ocorrência, período de sombra antes de escrever no calendário |
| Cliente impõe horário fixo | médio | cerimônia ancorada, tratada como restrição rígida |
| Instabilidade a cada replanejamento | alto | peso de estabilidade e limite de 20% movidas |
| Alocação desatualizada | alto | dados puxados do módulo de projetos e validação semanal do líder |
| Solver sem solução viável | médio | degradação controlada por camadas, com relato explícito do que foi relaxado |
| Explosão combinatória | médio | decomposição por squads fracamente acoplados e horizonte deslizante |
| Intercambiabilidade dentro do cargo não se sustentar | alto | matriz de skill por tipo de produto na fase 4, com impacto no modelo de dados |

## 13. Critérios de aceite do MVP

1. Importar a agenda atual e produzir o painel de indicadores por pessoa e por cargo.
2. Cadastrar 100 ou mais projetos com fase, produtos e squad, e gerar automaticamente a demanda do trimestre.
3. Executar o otimizador para 4 semanas em menos de 3 minutos, sem violar nenhuma premissa rígida.
4. Zerar as violações de teto por cargo e garantir 3 ou mais blocos de foco por pessoa por semana, na duração definida para o cargo.
5. Atender 100% do SLA de etapa para cerimônias com prazo de até 7 dias úteis.
6. Escrever o plano aprovado nos calendários e reconciliar alterações externas.
7. Produzir o relatório mensal de reuniões por pessoa, cargo, projeto e etapa.

---

# Parte III · Especificação de interface

## 14. Princípios aplicados

A interface foi refeita sobre as skills de design instaladas no ambiente. As decisões abaixo são normativas para a implementação em produção.

### 14.1 Cena e tema

Antes de escolher o tema, a cena: gerente de operação abrindo o plano da semana às 8h30 de uma segunda, monitor grande, sala com luz de janela, antes do primeiro status. A cena força o tema claro como padrão. O escuro existe como preferência do usuário, para a revisão do fim do dia, e não como default estético.

### 14.2 Sistema de design: shadcn/ui

A camada de apresentação usa o sistema de tokens do **shadcn/ui**, na versão em OKLCH, configurada pelo preset `b1YofKqES`.

O preset foi decodificado sem depender do servidor. O código não é um identificador que aponta para um registro remoto: ele **carrega a configuração dentro de si**, empacotada em base 62 com um campo por faixa de bits. Extraindo o decodificador do próprio pacote `shadcn` no npm, o código `b1YofKqES` se abre em:

| Campo | Valor |
|---|---|
| style | nova |
| baseColor | mist |
| theme | sky |
| chartColor | blue |
| radius | default (0.625rem) |
| font | inter |
| fontHeading | inherit |
| iconLibrary | lucide |
| menuColor | default |
| menuAccent | subtle |

A partir daí, os tokens foram montados com as escalas oficiais do Tailwind para mist, sky e blue: fundo branco sobre neutros mist, `--primary` em sky-600 no claro e sky-500 no escuro, bordas em mist-200, texto secundário em mist-500, sidebar em mist-50, e os cinco `--chart-*` ancorados no azul. A tipografia passou para Inter, com Geist Mono mantido apenas nos números, já que fonte mono não faz parte do preset.

Uma ressalva importante sobre o que "instalar shadcn" significa aqui. O shadcn não é uma biblioteca que se importa: é um conjunto de componentes React sobre Radix e Tailwind, copiados para dentro do projeto pelo CLI. O protótipo é um HTML único sem build, sem React e sem Tailwind, então a instalação literal não se aplica a ele. O que foi feito é o que de fato importa para a continuidade: **adotar os mesmos nomes de token e a mesma anatomia de componente**, de modo que a migração para React seja troca de marcação, não redesenho.

Os tokens são os oficiais, com os mesmos nomes: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, a escala `--radius` derivada, os cinco `--chart-*` e o conjunto `--sidebar-*`. Dois tokens foram acrescentados seguindo a convenção da documentação: `--success` e `--warning`, com seus pares `-foreground`.

A regra de ouro do sistema é respeitada em todo lugar: nenhuma cor é usada sem o par `-foreground` dela. Texto sobre `--primary` é sempre `--primary-foreground`.

A anatomia dos componentes segue a do shadcn, componente a componente:

| Componente | Como foi implementado |
|---|---|
| Sidebar | 16rem expandida e 3rem recolhida, as constantes oficiais. `SidebarHeader` como menu button grande de 48px com quadrado 32px em `sidebar-primary`. `SidebarGroupLabel` de 32px em `sidebar-foreground/70`. `SidebarMenuButton` de 32px, raio médio, ícone de 16px, ativo em `sidebar-accent`. No modo recolhido, cada item vira quadrado de 32px e o rótulo aparece em tooltip. `SidebarFooter` como bloco em `sidebar-accent`. |
| SidebarTrigger | Botão fantasma de 28px com o ícone PanelLeft, seguido de `Separator` vertical, no padrão do header dos blocos oficiais |
| Site header | 64px de altura, borda inferior, posição fixa |
| Chart | Anatomia do Recharts usado pelo shadcn: `CartesianGrid` só horizontal com `strokeDasharray="3 3"`, eixos sem linha nem tick, rótulos de 11px em `muted-foreground`, barras em `--chart-1` com canto superior arredondado de 6px, rótulo de valor em `foreground`, linha de referência tracejada e tooltip ao passar o mouse |
| Button | 32px, raio médio, peso 500, `shadow-xs`, variantes default, outline, ghost e destructive |
| Input e Select | 32px, `border-input`, `shadow-xs`, foco com anel de 3px em `ring/50`, chevron do select em `muted-foreground` |
| Tabs | Lista com fundo `muted`, raio grande, padding de 3px; item ativo em `background` com `shadow-xs` |
| Table | Cabeçalho de 38px em `muted-foreground`, linha com `hover:bg-muted/50`, borda inferior em cada linha |
| Badge | Raio pequeno, borda, 500 de peso, variantes por semântica |
| Dialog | Escurecimento preto a 50%, raio extra, `shadow-lg`, botão X no canto superior direito, fecha por Esc e por clique fora |
| Alert | Grade de ícone mais conteúdo, título em 500 e descrição em `muted-foreground` |
| Empty | Ícone em círculo `muted` de 40px, título e descrição centralizados, borda tracejada |
| Progress | Trilha em `primary/20` com indicador em `primary` |
| Switch | 32 por 18,4px com polegar de 16px e `shadow-xs` |
| Checkbox | 16px, raio 4px, marcado em `primary` com o check em `primary-foreground` |
| Tooltip | Fundo `primary`, texto `primary-foreground`, 12px, raio médio |
| Skeleton | `bg-muted` com animação de pulso |

O arquivo `leverpro-shadcn-theme.css` acompanha esta entrega, pronto para colar no `globals.css` de um projeto shadcn real, junto com a sequência de comandos do CLI para instalar os componentes usados.

### 14.2.1 Cor### 14.3 Densidade e ausência de cards

Este é um cockpit de operação, não uma landing page. Densidade alta significa que caixas genéricas são proibidas: o agrupamento é feito por régua, divisor e espaço negativo. Os indicadores do topo são uma lista de definição dividida por linhas verticais, não seis cartões iguais.

### 14.4 Tipografia

Geist para interface e Geist Mono para todo número, com `tabular-nums`. Hierarquia por escala e peso, com contraste forte entre o rótulo do indicador, em 10px maiúsculo espaçado, e o valor, em 27px mono. Texto corrido limitado a 74 caracteres por linha.

### 14.5 Edição em modal

A primeira versão usava editores expandidos na própria linha da tabela. Na prática, abrir o editor de um projeto empurrava as 112 linhas abaixo dele e desmontava a leitura da lista, e o mesmo acontecia com a confirmação de exclusão. A decisão foi revista: criar e editar projeto, pessoa, cargo, cerimônia e etapa abre um modal sobre a tela, sem alterar uma linha sequer da tabela por trás.

O modal tem escurecimento de fundo, fecha por Esc, por clique fora e pelo botão Cancelar, trava a rolagem do documento enquanto está aberto e leva o foco para o primeiro campo. A confirmação de exclusão usa o mesmo componente, em caixa menor, e sempre diz a consequência antes: quantos projetos serão reatribuídos ao remover uma pessoa, quantas cerimônias ficarão sem quórum ao remover um cargo, para qual etapa os projetos vão ao remover uma etapa.

### 14.6 Movimento

Só `transform` e `opacity`, nunca propriedades de layout. Curva ease-out quint, 170ms. Entrada de conteúdo em cascata curta. `prefers-reduced-motion` desliga tudo.

### 14.7 Acessibilidade

Contraste mínimo de 4,5:1 em ambos os temas, incluindo o texto secundário, o que obrigou a escurecer o cinza de apoio. Foco visível em todo controle. `aria-label` em botão de ícone, `aria-pressed` em alternadores, `aria-current` na navegação, `aria-selected` nas abas, `role="tablist"` no conjunto. Rótulo acima do campo, erro abaixo. Alvos de toque com altura mínima de 30px nos controles densos e 44px nos primários.

### 14.8 Estados

Carregando: esqueletos com a forma do conteúdo, nunca spinner genérico. Vazio: composição explicando por que está vazio e o que fazer, como no caso da semana sem cerimônia de um projeto quinzenal, que oferece a visão mensal. Erro: mensagem inline no rodapé do editor, junto do botão que falhou.

## 15. Reescrita do artefato

O artefato anterior foi construído em quinze rodadas de correção sobre a mesma base, e acumulou dívida: seletores duplicados, cores fixas espalhadas entre CSS e JavaScript, um sistema de modais que contrariava as diretrizes de design, bordas laterais coloridas como acento e travessões na copy.

A camada de interface foi reescrita do zero. O motor de domínio foi preservado, porque estava validado numericamente, e passou apenas por limpeza de código morto e organização em seções. A paridade foi verificada: os mesmos números antes e depois da reescrita.

| Item | Antes | Depois |
|---|---|---|
| Cores fixas no JavaScript | cerca de 60 | zero, tudo em tokens |
| Sistema de cor | hexadecimal, duas paletas manuais | OKLCH, uma paleta derivada por hue |
| Modais em overlay | 5 fluxos herdados | 5 fluxos reconstruídos com Esc, clique fora e foco |
| Bordas laterais como acento | 4 componentes | zero |
| Travessões na copy | frequentes | zero |
| `aria-label`, `aria-pressed`, `aria-current` | parcial | completo |
| Estados de vazio | 2 | 4 |
| Linhas de CSS duplicadas | várias | sistema único de tokens e primitivas |

---

# Parte IV · Decisões em aberto

Pontos que a simulação expôs e que pedem decisão de negócio antes da construção:

1. **Kickoff em 7 dias úteis não se resolve só com urgência.** No plano atual o dia médio do kickoff é terça, não segunda, por colisão de participantes: existe um Líder Técnico e dois Gerentes de Projeto para as quatro cadeiras de kickoff da semana. Se o prazo for contratual, ou o kickoff deixa de exigir o Líder Técnico, ou o time precisa de um segundo.

2. **Intercambiabilidade dentro do cargo.** O rebalanceamento de cadeira e a reatribuição por saída dependem dela. Se na prática um analista não substitui outro em qualquer projeto, é preciso uma matriz de competência por tipo de produto, e o modelo de dados muda.

3. **Playbook editável.** Hoje é somente leitura no protótipo. Mudar uma premissa reorganiza a agenda; mudar o playbook muda o que a operação entrega ao cliente. A edição precisa de outro nível de governança.

4. **Uma linha do playbook domina a agenda.** A reunião de trabalho semanal de Discovery, com dez projetos, responde por 26,8% de toda a pessoa-hora de cerimônia do time. Se falta capacidade, o primeiro lugar para mexer é ali, não na distribuição de horários.

5. **Tema não persistido.** O protótipo mantém a preferência em memória, para continuar sendo um arquivo autônomo. Em produção vira preferência de usuário no perfil.

---

*LeverPro, setembro de 2026.*
