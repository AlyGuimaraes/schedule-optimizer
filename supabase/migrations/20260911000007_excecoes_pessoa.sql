-- ═══════════════════════════════════════════════════════════════════
-- Cadência · exceções por pessoa no plano carregado (E14, §2.1)
-- premissas_override com escopo 'pessoa' guarda o campo do motor e o valor
-- na unidade do motor (slots de 30 min para janela e bloco de foco).
-- ═══════════════════════════════════════════════════════════════════

create index if not exists premissas_override_vigente_idx
  on premissas_override (escopo, escopo_id, campo) where vigencia_fim is null;

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
    )
  )
$$;
