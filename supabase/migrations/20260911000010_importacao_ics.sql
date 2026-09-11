-- ═══════════════════════════════════════════════════════════════════
-- Cadência · importação da agenda atual por arquivo .ics (E09)
-- 1. Provedor 'ics': upload de .ics por pessoa, a alternativa sem integração com o Outlook.
-- 2. eventos_externos ganha classificação, número de participantes, projeto reconhecido e a
--    importação de origem. Privacidade: só início, fim, participantes, id externo e hash do
--    título. O título em si nunca chega ao banco: o arquivo é lido no navegador.
-- 3. importacoes_agenda registra cada importação (janela e momento), para o resumo da tela.
-- 4. carregar_plano() passa a levar ao motor os bloqueios: eventos que não são cerimônia.
-- ═══════════════════════════════════════════════════════════════════

-- O valor novo do enum só pode ser usado depois do commit desta migração, então nada abaixo o cita.
alter type provedor_calendario add value if not exists 'ics';

-- ─────────────────────── importações ───────────────────────
create table importacoes_agenda (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  provedor provedor_calendario not null,
  janela_inicio timestamptz not null,
  janela_fim timestamptz not null,
  eventos int not null default 0 check (eventos >= 0),
  criado_em timestamptz not null default now(),
  check (janela_fim > janela_inicio)
);
create index importacoes_agenda_pessoa_idx on importacoes_agenda (pessoa_id, provedor, criado_em desc);

alter table importacoes_agenda enable row level security;
create policy importacoes_agenda_leitura on importacoes_agenda for select to authenticated
  using (public.tem_papel('leitor'));
create policy importacoes_agenda_escrita on importacoes_agenda for all to authenticated
  using (public.tem_papel('gestor')) with check (public.tem_papel('gestor'));

-- ─────────────────────── eventos externos ───────────────────────
-- cerimonia: título com cliente ou projeto e um tipo do playbook (o otimizador planeja, não bloqueia)
-- institucional: ritual interno (1:1, all hands, treinamento); bloqueia
-- opaco: qualquer outro compromisso; bloqueia e fica fora dos indicadores de cerimônia (§8)
alter table eventos_externos
  add column classificacao text not null default 'opaco'
    check (classificacao in ('cerimonia', 'institucional', 'opaco')),
  add column participantes int not null default 0 check (participantes >= 0),
  add column projeto_id uuid references projetos (id) on delete set null,
  add column cerimonia_tipo text,
  add column importacao_id uuid references importacoes_agenda (id) on delete set null,
  add constraint eventos_externos_periodo_check check (fim > inicio);

-- `opaco` continua existindo e passa a espelhar a classificação
update eventos_externos set classificacao = case when opaco then 'opaco' else 'cerimonia' end;

-- O mesmo evento (mesmo UID) aparece na agenda de cada participante: a chave passa a incluir a pessoa.
alter table eventos_externos drop constraint if exists eventos_externos_provedor_external_id_key;
alter table eventos_externos
  add constraint eventos_externos_pessoa_provedor_external_id_key unique (pessoa_id, provedor, external_id);
create index eventos_externos_fim_idx on eventos_externos (fim);
create index eventos_externos_importacao_idx on eventos_externos (importacao_id);

-- ─────────────────────── resumo por pessoa ───────────────────────
-- Contagem por classificação e a última importação, por pessoa e provedor, para a aba Agendas.
create or replace function public.resumo_importacoes() returns jsonb
language sql stable security invoker set search_path = public as $$
  with ev as (
    select pessoa_id, provedor,
      count(*) filter (where classificacao = 'cerimonia')::int as cerimonia,
      count(*) filter (where classificacao = 'institucional')::int as institucional,
      count(*) filter (where classificacao = 'opaco')::int as opaco
    from eventos_externos
    group by pessoa_id, provedor
  ),
  ult as (
    select distinct on (pessoa_id, provedor) pessoa_id, provedor, janela_inicio, janela_fim, criado_em
    from importacoes_agenda
    order by pessoa_id, provedor, criado_em desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'pessoa_id', coalesce(ev.pessoa_id, ult.pessoa_id),
    'provedor', coalesce(ev.provedor, ult.provedor),
    'cerimonia', coalesce(ev.cerimonia, 0),
    'institucional', coalesce(ev.institucional, 0),
    'opaco', coalesce(ev.opaco, 0),
    'janela_inicio', ult.janela_inicio,
    'janela_fim', ult.janela_fim,
    'importado_em', ult.criado_em
  )), '[]'::jsonb)
  from ev
  full join ult on ult.pessoa_id = ev.pessoa_id and ult.provedor = ev.provedor
$$;

-- ─────────────────────── plano carregado ───────────────────────
-- Mesmas chaves da migração 0009, mais `bloqueios`: eventos que não são cerimônia reconhecida,
-- do fim da semana passada até o trimestre do horizonte (13 semanas a partir da próxima segunda).
create or replace function public.carregar_plano() returns jsonb
language sql stable security invoker set search_path = public as $$
  with pub as (
    select id, nome, publicado_em, horizonte_inicio, horizonte_semanas
    from cenarios where status = 'publicado' limit 1
  )
  select jsonb_build_object(
    'publicado', (select to_jsonb(pub) from pub),
    'ancoras', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'projeto_id', a.projeto_id, 'playbook_item_id', a.playbook_item_id, 'dia', a.dia, 'slot', a.slot
      )), '[]'::jsonb)
      from ancoras a
    ),
    'ocorrencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'projeto_id', o.projeto_id, 'playbook_item_id', o.playbook_item_id,
        'semana', o.semana, 'dia', o.dia, 'slot', o.slot
      )), '[]'::jsonb)
      from ocorrencias o join pub on pub.id = o.cenario_id
      where o.dia is not null
    ),
    'excecoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pessoa_id', x.escopo_id, 'campo', x.campo, 'valor', x.valor
      )), '[]'::jsonb)
      from premissas_override x
      where x.escopo = 'pessoa' and x.vigencia_fim is null
    ),
    'excecoes_projeto', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'projeto_id', x.escopo_id, 'campo', x.campo, 'valor', x.valor
      )), '[]'::jsonb)
      from premissas_override x
      where x.escopo = 'projeto' and x.vigencia_fim is null
    ),
    'ausencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'pessoa_id', a.pessoa_id, 'inicio', a.inicio, 'fim', a.fim,
        'tipo', a.tipo, 'descricao', a.descricao
      ) order by a.inicio), '[]'::jsonb)
      from ausencias a
      where a.fim >= current_date - 30
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'projeto_id', s.projeto_id, 'playbook_item_id', s.playbook_item_id, 'inicio', s.inicio
      )), '[]'::jsonb)
      from series s
      where s.fim is null
    ),
    'bloqueios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pessoa_id', e.pessoa_id, 'inicio', e.inicio, 'fim', e.fim, 'classificacao', e.classificacao
      ) order by e.inicio), '[]'::jsonb)
      from eventos_externos e
      where e.classificacao <> 'cerimonia'
        and e.fim >= current_date - 7
        and e.inicio < current_date + 7 * 15
    )
  )
$$;
