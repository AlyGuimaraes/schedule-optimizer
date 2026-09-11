-- ═══════════════════════════════════════════════════════════════════
-- Cadência · cenários publicados, âncoras e posição das ocorrências (E13)
-- ═══════════════════════════════════════════════════════════════════

-- resumo dos indicadores do cenário, para listar e comparar sem reprocessar
alter table cenarios add column resumo jsonb;

-- posição na grade do motor (dia 0 a 4, slot de 30 min a partir das 08:00),
-- usada como plano vigente pelo termo de estabilidade
alter table ocorrencias add column dia int check (dia between 0 and 4);
alter table ocorrencias add column slot int check (slot between 0 and 19);

-- horário imposto pelo cliente para uma série: restrição rígida (§12)
create table ancoras (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id) on delete cascade,
  playbook_item_id uuid not null references playbook_itens (id) on delete cascade,
  dia int not null check (dia between 0 and 4),
  slot int not null check (slot between 0 and 19),
  motivo text,
  autor uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (projeto_id, playbook_item_id)
);

alter table ancoras enable row level security;
create policy ancoras_leitura on ancoras for select to authenticated using (public.tem_papel('leitor'));
create policy ancoras_escrita on ancoras for all to authenticated
  using (public.tem_papel('gestor')) with check (public.tem_papel('gestor'));
create trigger ancoras_auditoria after insert or update or delete on ancoras
  for each row execute function public.registrar_auditoria();

-- plano vigente e âncoras, para o motor replanejar com estabilidade
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
    )
  )
$$;
