-- ═══════════════════════════════════════════════════════════════════
-- Cadência · esquema base (§9 da especificação, ampliado com times,
-- cargos como entidade e playbook por etapa).
-- Durações em minutos; horas em horas; percentuais em pontos.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────── enums ───────────────────────────
create type health_projeto as enum ('verde', 'amarelo', 'vermelho');
create type prioridade_cliente as enum ('alta', 'media', 'baixa');
create type status_cenario as enum ('rascunho', 'simulado', 'publicado', 'arquivado');
create type status_ocorrencia as enum ('planejada', 'confirmada', 'realizada', 'cancelada', 'adiada');
create type perfil_otimizacao as enum ('foco', 'equilibrio', 'cliente', 'estabilidade');
create type papel_app as enum ('admin', 'gestor', 'leitor');
create type escopo_override as enum ('pessoa', 'projeto');
create type provedor_calendario as enum ('google', 'microsoft');
create type tipo_produto as enum ('relatorio', 'dashboard', 'integracao');
create type origem_alocacao as enum ('auto', 'manual');

create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- ─────────────────────── cargos e premissas ───────────────────────
create table cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Doze campos editáveis por cargo (§2.3), versionados por vigência.
create table premissas_cargo (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references cargos (id) on delete cascade,
  jornada numeric(5, 2) not null check (jornada between 20 and 44),
  fator_ausencia numeric(5, 2) not null check (fator_ausencia between 0 and 35),
  tempo_institucional numeric(5, 2) not null check (tempo_institucional between 0 and 12),
  produtivo_min numeric(5, 2) not null check (produtivo_min between 40 and 95),
  tolerancia numeric(5, 2) not null check (tolerancia between 0 and 20),
  max_reunioes_dia int not null check (max_reunioes_dia between 1 and 10),
  max_horas_dia numeric(5, 2) not null check (max_horas_dia between 0.5 and 8),
  max_horas_semana numeric(5, 2) not null check (max_horas_semana between 1 and 30),
  max_horas_mes numeric(6, 2) not null check (max_horas_mes between 4 and 120),
  duracao_max_min int not null check (duracao_max_min between 30 and 240),
  bloco_foco_min_min int not null check (bloco_foco_min_min between 30 and 240),
  janela_protegida_min int not null check (janela_protegida_min between 0 and 240),
  custo_hora numeric(10, 2) not null default 118,
  vigencia_inicio date not null default current_date,
  vigencia_fim date,
  autor uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create unique index premissas_cargo_vigente_idx on premissas_cargo (cargo_id) where vigencia_fim is null;

-- Premissas gerais (§2.2): jornada, almoço, intervalo, faixa preferencial,
-- dia protegido, quórum, antecedência de convocação e estabilidade do plano.
create table premissas_gerais (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  valor jsonb not null,
  vigencia_inicio date not null default current_date,
  vigencia_fim date,
  autor uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create unique index premissas_gerais_vigente_idx on premissas_gerais (chave) where vigencia_fim is null;

-- Exceções por pessoa e por projeto (§2.1). O nível mais específico vence.
create table premissas_override (
  id uuid primary key default gen_random_uuid(),
  escopo escopo_override not null,
  escopo_id uuid not null,
  campo text not null,
  valor jsonb not null,
  vigencia_inicio date not null default current_date,
  vigencia_fim date,
  autor uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index premissas_override_escopo_idx on premissas_override (escopo, escopo_id);

-- ─────────────────────── etapas e prioridades ───────────────────────
create table etapas (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  rotulo text not null,
  ordem int not null default 0,
  urgencia int not null check (urgencia between 1 and 5),
  prazo_dias int not null check (prazo_dias between 1 and 60),
  hue int not null default 220 check (hue between 0 and 359),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table prioridades_cliente (
  nivel prioridade_cliente primary key,
  peso numeric(4, 2) not null check (peso between 1 and 5)
);

-- ─────────────────────── pessoas e times ───────────────────────
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  iniciais text not null,
  cargo_id uuid not null references cargos (id) on delete restrict,
  senioridade text,
  email text unique,
  user_id uuid unique references auth.users (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pessoas_cargo_idx on pessoas (cargo_id);

create table times (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Uma pessoa pode estar em mais de um time, que é o caso dos cargos escassos (§2.0).
create table time_membros (
  time_id uuid not null references times (id) on delete cascade,
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  primary key (time_id, pessoa_id)
);

-- ─────────────────────── clientes e projetos ───────────────────────
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  prioridade prioridade_cliente not null default 'media',
  sla_dias int,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete restrict,
  nome text not null,
  etapa_id uuid not null references etapas (id) on delete restrict,
  time_id uuid not null references times (id) on delete restrict,
  mes int not null default 1 check (mes between 1 and 48),
  inicio date,
  golive_alvo date,
  health health_projeto not null default 'verde',
  -- A prioridade é do cliente (§9). Aqui fica a exceção por projeto: nula significa herdar do cliente.
  prioridade prioridade_cliente,
  atraso_dias int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index projetos_etapa_idx on projetos (etapa_id);
create index projetos_time_idx on projetos (time_id);
create index projetos_cliente_idx on projetos (cliente_id);

create table produtos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id) on delete cascade,
  tipo tipo_produto not null,
  complexidade int not null default 3 check (complexidade between 1 and 5),
  status text not null default 'previsto',
  criado_em timestamptz not null default now()
);
create index produtos_projeto_idx on produtos (projeto_id);

-- Squad: a cadeira é do cargo, não da pessoa (§3.2).
create table alocacoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id) on delete cascade,
  pessoa_id uuid not null references pessoas (id) on delete restrict,
  cargo_id uuid not null references cargos (id) on delete restrict,
  inicio date not null default current_date,
  fim date,
  origem origem_alocacao not null default 'auto',
  criado_em timestamptz not null default now()
);
create unique index alocacoes_cadeira_idx on alocacoes (projeto_id, cargo_id) where fim is null;
create index alocacoes_pessoa_idx on alocacoes (pessoa_id);

-- ─────────────────────── playbook ───────────────────────
create table tipos_cerimonia (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  hue int not null default 220 check (hue between 0 and 359),
  criado_em timestamptz not null default now()
);

create table playbook_itens (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references etapas (id) on delete cascade,
  tipo_cerimonia_id uuid not null references tipos_cerimonia (id) on delete restrict,
  duracao_min int not null check (duracao_min between 15 and 240 and duracao_min % 15 = 0),
  cadencia_semanas int not null check (cadencia_semanas between 1 and 12),
  prioridade int not null check (prioridade between 1 and 5),
  obrigatoria boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (etapa_id, tipo_cerimonia_id)
);

create table playbook_item_cargos (
  playbook_item_id uuid not null references playbook_itens (id) on delete cascade,
  cargo_id uuid not null references cargos (id) on delete restrict,
  primary key (playbook_item_id, cargo_id)
);

create table series (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id) on delete cascade,
  playbook_item_id uuid not null references playbook_itens (id) on delete cascade,
  cadencia_semanas int not null check (cadencia_semanas between 1 and 12),
  inicio date not null default current_date,
  fim date,
  ancorada boolean not null default false,
  dia_ancora int check (dia_ancora between 0 and 4),
  slot_ancora int check (slot_ancora between 0 and 19),
  criado_em timestamptz not null default now()
);
create index series_projeto_idx on series (projeto_id);

-- ─────────────────────── cenários e plano ───────────────────────
create table cenarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  horizonte_inicio date not null default current_date,
  horizonte_semanas int not null default 4 check (horizonte_semanas between 1 and 13),
  perfil perfil_otimizacao not null default 'equilibrio',
  rebalancear boolean not null default true,
  status status_cenario not null default 'rascunho',
  base_cenario_id uuid references cenarios (id) on delete set null,
  snapshot_premissas jsonb,
  solver text not null default 'guloso',
  duracao_ms int,
  criado_por uuid references auth.users (id) on delete set null,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index cenarios_publicado_idx on cenarios (status) where status = 'publicado';

create table ocorrencias (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  serie_id uuid references series (id) on delete set null,
  projeto_id uuid not null references projetos (id) on delete cascade,
  playbook_item_id uuid not null references playbook_itens (id) on delete cascade,
  semana int not null check (semana between 1 and 13),
  inicio timestamptz not null,
  fim timestamptz not null,
  status status_ocorrencia not null default 'planejada',
  relaxada boolean not null default false,
  camada int not null default 1 check (camada between 1 and 3),
  sla boolean not null default false,
  calendar_event_ids jsonb not null default '{}'::jsonb,
  justificativa text,
  criado_em timestamptz not null default now(),
  check (fim > inicio)
);
create index ocorrencias_cenario_idx on ocorrencias (cenario_id, semana);
create index ocorrencias_projeto_idx on ocorrencias (projeto_id);

create table participantes (
  ocorrencia_id uuid not null references ocorrencias (id) on delete cascade,
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  cargo_id uuid not null references cargos (id) on delete restrict,
  obrigatorio boolean not null default true,
  confirmado boolean not null default false,
  substituiu_pessoa_id uuid references pessoas (id) on delete set null,
  primary key (ocorrencia_id, pessoa_id)
);
create index participantes_pessoa_idx on participantes (pessoa_id);

-- Cada concessão do §4.3 é registrada com valor alvo e valor aplicado.
create table concessoes (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  ocorrencia_id uuid references ocorrencias (id) on delete cascade,
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  cargo_id uuid not null references cargos (id) on delete restrict,
  premissa text not null,
  valor_alvo numeric(10, 2) not null,
  valor_aplicado numeric(10, 2) not null,
  unidade text not null default '',
  criado_em timestamptz not null default now()
);
create index concessoes_cenario_idx on concessoes (cenario_id);

create table trocas_cadeira (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  ocorrencia_id uuid references ocorrencias (id) on delete cascade,
  cargo_id uuid not null references cargos (id) on delete restrict,
  de_pessoa_id uuid not null references pessoas (id) on delete cascade,
  para_pessoa_id uuid not null references pessoas (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table demanda_nao_atendida (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  playbook_item_id uuid not null references playbook_itens (id) on delete cascade,
  semana int not null,
  motivo text not null,
  obrigatoria boolean not null default true,
  sla boolean not null default false,
  criado_em timestamptz not null default now()
);
create index demanda_nao_atendida_cenario_idx on demanda_nao_atendida (cenario_id);

create table kpis_snapshot (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  semana int not null,
  taxa numeric(6, 2) not null,
  horas numeric(6, 2) not null,
  reunioes int not null,
  fragmentacao numeric(5, 2) not null,
  blocos_foco int not null,
  produtivo numeric(6, 2) not null,
  criado_em timestamptz not null default now(),
  unique (cenario_id, pessoa_id, semana)
);

-- ─────────────────────── integrações e operação ───────────────────────
create table integracoes_calendario (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  provedor provedor_calendario not null,
  segredo_id text,
  escopos text[] not null default '{}',
  status text not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (pessoa_id, provedor)
);

-- Evento criado fora do Cadência é bloqueio opaco: reduz disponibilidade
-- e não entra nos indicadores de cerimônia de projeto (§8).
create table eventos_externos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  provedor provedor_calendario not null,
  external_id text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  opaco boolean not null default true,
  titulo_hash text,
  criado_em timestamptz not null default now(),
  unique (provedor, external_id)
);
create index eventos_externos_pessoa_idx on eventos_externos (pessoa_id, inicio);

create table solver_jobs (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references cenarios (id) on delete cascade,
  status text not null default 'na_fila',
  entrada jsonb not null,
  saida jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table agente_execucoes (
  id uuid primary key default gen_random_uuid(),
  agente text not null,
  entrada jsonb,
  saida jsonb,
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  custo numeric(10, 4),
  duracao_ms int,
  cenario_id uuid references cenarios (id) on delete set null,
  versao_prompt text,
  status text not null default 'ok',
  criado_em timestamptz not null default now()
);

create table perfis_usuario (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  papel_app papel_app not null default 'leitor',
  pessoa_id uuid references pessoas (id) on delete set null,
  tema text not null default 'claro',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table auditoria (
  id bigserial primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  autor uuid,
  em timestamptz not null default now()
);
create index auditoria_tabela_idx on auditoria (tabela, em desc);

-- ─────────────────────── atualizado_em ───────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'cargos', 'etapas', 'pessoas', 'times', 'clientes', 'projetos', 'playbook_itens',
    'cenarios', 'integracoes_calendario', 'solver_jobs', 'perfis_usuario'
  ] loop
    execute format(
      'create trigger %I_atualizado_em before update on %I for each row execute function public.tocar_atualizado_em()',
      t, t
    );
  end loop;
end $$;
