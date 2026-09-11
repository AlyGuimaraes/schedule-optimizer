-- ═══════════════════════════════════════════════════════════════════
-- Cadência · calendário real (E14)
-- 1. Ausências e feriados reduzindo a capacidade por dia (cadastro manual até a E23).
-- 2. Séries com início real (defeito 8): a cadência deixa de depender da posição do projeto.
-- 3. carregar_plano() passa a levar ausências e séries ao motor.
-- ═══════════════════════════════════════════════════════════════════

create type tipo_ausencia as enum ('ferias', 'ausencia', 'feriado_nacional', 'feriado_municipal');

-- pessoa_id nula: vale para todo mundo (feriado)
create table ausencias (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid references pessoas (id) on delete cascade,
  inicio date not null,
  fim date not null,
  tipo tipo_ausencia not null,
  descricao text not null default '',
  criado_em timestamptz not null default now(),
  check (fim >= inicio),
  check (fim - inicio <= 120),
  check (pessoa_id is not null or tipo in ('feriado_nacional', 'feriado_municipal'))
);
create index ausencias_periodo_idx on ausencias (inicio, fim);
create index ausencias_pessoa_idx on ausencias (pessoa_id);

alter table ausencias enable row level security;
create policy ausencias_leitura on ausencias for select to authenticated using (public.tem_papel('leitor'));
create policy ausencias_escrita on ausencias for all to authenticated
  using (public.tem_papel('gestor')) with check (public.tem_papel('gestor'));

-- Feriados nacionais de 2026 e 2027 (Lei 662/1949, Lei 14.759/2023 para o 20 de novembro).
-- Carnaval é ponto facultativo; entra como feriado porque a operação não agenda cliente nesses dias.
insert into ausencias (inicio, fim, tipo, descricao) values
  ('2026-01-01', '2026-01-01', 'feriado_nacional', 'Confraternização Universal'),
  ('2026-02-16', '2026-02-17', 'feriado_nacional', 'Carnaval'),
  ('2026-04-03', '2026-04-03', 'feriado_nacional', 'Sexta-feira Santa'),
  ('2026-04-21', '2026-04-21', 'feriado_nacional', 'Tiradentes'),
  ('2026-05-01', '2026-05-01', 'feriado_nacional', 'Dia do Trabalho'),
  ('2026-06-04', '2026-06-04', 'feriado_nacional', 'Corpus Christi'),
  ('2026-09-07', '2026-09-07', 'feriado_nacional', 'Independência do Brasil'),
  ('2026-10-12', '2026-10-12', 'feriado_nacional', 'Nossa Senhora Aparecida'),
  ('2026-11-02', '2026-11-02', 'feriado_nacional', 'Finados'),
  ('2026-11-15', '2026-11-15', 'feriado_nacional', 'Proclamação da República'),
  ('2026-11-20', '2026-11-20', 'feriado_nacional', 'Dia Nacional de Zumbi e da Consciência Negra'),
  ('2026-12-25', '2026-12-25', 'feriado_nacional', 'Natal'),
  ('2027-01-01', '2027-01-01', 'feriado_nacional', 'Confraternização Universal'),
  ('2027-02-08', '2027-02-09', 'feriado_nacional', 'Carnaval'),
  ('2027-03-26', '2027-03-26', 'feriado_nacional', 'Sexta-feira Santa'),
  ('2027-04-21', '2027-04-21', 'feriado_nacional', 'Tiradentes'),
  ('2027-05-01', '2027-05-01', 'feriado_nacional', 'Dia do Trabalho'),
  ('2027-05-27', '2027-05-27', 'feriado_nacional', 'Corpus Christi'),
  ('2027-09-07', '2027-09-07', 'feriado_nacional', 'Independência do Brasil'),
  ('2027-10-12', '2027-10-12', 'feriado_nacional', 'Nossa Senhora Aparecida'),
  ('2027-11-02', '2027-11-02', 'feriado_nacional', 'Finados'),
  ('2027-11-15', '2027-11-15', 'feriado_nacional', 'Proclamação da República'),
  ('2027-11-20', '2027-11-20', 'feriado_nacional', 'Dia Nacional de Zumbi e da Consciência Negra'),
  ('2027-12-25', '2027-12-25', 'feriado_nacional', 'Natal');

-- ─────────────────────── séries com início real ───────────────────────
-- Uma série por projeto ativo e item da fase atual com cadência maior que uma semana.
-- O início reproduz o faseamento de hoje, (posição + semana) % cada, para o horizonte que começa
-- em 2026-09-14: a primeira semana planejada é idêntica, e dali em diante a cadência segue o
-- calendário, sem recomeçar a cada horizonte nem depender da ordem dos projetos.
create unique index series_projeto_item_idx on series (projeto_id, playbook_item_id);

insert into series (projeto_id, playbook_item_id, cadencia_semanas, inicio)
select pr.id, i.id, i.cadencia_semanas, date '2026-09-14' - 7 * ((pr.ord + 1) % i.cadencia_semanas)::int
from (
  select id, etapa_id, row_number() over (order by sequencia) - 1 as ord
  from projetos where ativo
) pr
join playbook_itens i on i.etapa_id = pr.etapa_id
where i.cadencia_semanas > 1
on conflict (projeto_id, playbook_item_id) do nothing;

-- Projeto novo, mudança de fase ou item novo no playbook: a série nasce na próxima segunda.
create or replace function public.garantir_series(p_inicio date) returns int
language sql security invoker set search_path = public as $$
  with novas as (
    insert into series (projeto_id, playbook_item_id, cadencia_semanas, inicio)
    select pr.id, i.id, i.cadencia_semanas, p_inicio
    from projetos pr
    join playbook_itens i on i.etapa_id = pr.etapa_id
    where pr.ativo and i.cadencia_semanas > 1
    on conflict (projeto_id, playbook_item_id) do nothing
    returning 1
  )
  select count(*)::int from novas
$$;

-- ─────────────────────── plano carregado ───────────────────────
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
    )
  )
$$;
