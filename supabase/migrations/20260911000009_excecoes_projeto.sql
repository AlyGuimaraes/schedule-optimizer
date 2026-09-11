-- ═══════════════════════════════════════════════════════════════════
-- Cadência · exceções por projeto no plano carregado (E14, §2.1)
-- premissas_override com escopo 'projeto': janela combinada com o cliente
-- (inicioMin, fimMax) e duração máxima das cerimônias, em slots de 30 min.
-- ═══════════════════════════════════════════════════════════════════

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
    )
  )
$$;
