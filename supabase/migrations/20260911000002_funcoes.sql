-- ═══════════════════════════════════════════════════════════════════
-- Cadência · vigência das premissas, auditoria e operações transacionais
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────── auditoria ───────────────────────
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  registro uuid;
begin
  begin
    registro := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
  exception when others then
    registro := null;
  end;
  insert into auditoria (tabela, registro_id, acao, antes, depois, autor)
  values (
    tg_table_name,
    registro,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'cargos', 'premissas_cargo', 'premissas_gerais', 'premissas_override', 'etapas',
    'pessoas', 'times', 'time_membros', 'clientes', 'projetos', 'alocacoes',
    'playbook_itens', 'playbook_item_cargos'
  ] loop
    execute format(
      'create trigger %I_auditoria after insert or update or delete on %I for each row execute function public.registrar_auditoria()',
      t, t
    );
  end loop;
end $$;

-- ─────────────────────── vigência ───────────────────────
create view premissas_cargo_vigentes as
select p.*, c.nome as cargo
from premissas_cargo p
join cargos c on c.id = p.cargo_id
where p.vigencia_fim is null;

create view premissas_gerais_vigentes as
select chave, valor from premissas_gerais where vigencia_fim is null;

-- Editar premissa fecha a versão anterior e abre uma nova, com autor (§2.1).
create or replace function public.definir_premissa_cargo(p_cargo_id uuid, p_valores jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  novo uuid;
  atual premissas_cargo%rowtype;
begin
  select * into atual from premissas_cargo
  where cargo_id = p_cargo_id and vigencia_fim is null;

  update premissas_cargo set vigencia_fim = current_date
  where cargo_id = p_cargo_id and vigencia_fim is null;

  insert into premissas_cargo (
    cargo_id, jornada, fator_ausencia, tempo_institucional, produtivo_min, tolerancia,
    max_reunioes_dia, max_horas_dia, max_horas_semana, max_horas_mes,
    duracao_max_min, bloco_foco_min_min, janela_protegida_min, custo_hora, autor
  ) values (
    p_cargo_id,
    coalesce((p_valores ->> 'jornada')::numeric, atual.jornada),
    coalesce((p_valores ->> 'fator_ausencia')::numeric, atual.fator_ausencia),
    coalesce((p_valores ->> 'tempo_institucional')::numeric, atual.tempo_institucional),
    coalesce((p_valores ->> 'produtivo_min')::numeric, atual.produtivo_min),
    coalesce((p_valores ->> 'tolerancia')::numeric, atual.tolerancia),
    coalesce((p_valores ->> 'max_reunioes_dia')::int, atual.max_reunioes_dia),
    coalesce((p_valores ->> 'max_horas_dia')::numeric, atual.max_horas_dia),
    coalesce((p_valores ->> 'max_horas_semana')::numeric, atual.max_horas_semana),
    coalesce((p_valores ->> 'max_horas_mes')::numeric, atual.max_horas_mes),
    coalesce((p_valores ->> 'duracao_max_min')::int, atual.duracao_max_min),
    coalesce((p_valores ->> 'bloco_foco_min_min')::int, atual.bloco_foco_min_min),
    coalesce((p_valores ->> 'janela_protegida_min')::int, atual.janela_protegida_min),
    coalesce((p_valores ->> 'custo_hora')::numeric, atual.custo_hora),
    auth.uid()
  ) returning id into novo;

  return novo;
end $$;

-- ─────────────────────── carregar o mundo ───────────────────────
-- Uma chamada devolve tudo que o motor precisa. O mapeador em TypeScript converte
-- uuid em índice e minutos em slots de 30 minutos.
create or replace function public.carregar_mundo() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'cargos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'ordem', c.ordem) order by c.ordem, c.nome), '[]'::jsonb)
      from cargos c where c.ativo
    ),
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'iniciais', p.iniciais, 'cargo_id', p.cargo_id, 'email', p.email
      ) order by p.criado_em, p.nome), '[]'::jsonb)
      from pessoas p where p.ativo
    ),
    'times', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'nome', t.nome,
        'membros', (select coalesce(jsonb_agg(m.pessoa_id), '[]'::jsonb) from time_membros m where m.time_id = t.id)
      ) order by t.nome), '[]'::jsonb)
      from times t where t.ativo
    ),
    'etapas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'chave', e.chave, 'rotulo', e.rotulo, 'urgencia', e.urgencia,
        'prazo_dias', e.prazo_dias, 'hue', e.hue, 'ordem', e.ordem
      ) order by e.ordem), '[]'::jsonb)
      from etapas e where e.ativo
    ),
    'playbook', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'etapa_id', i.etapa_id, 'tipo', tc.nome, 'hue', tc.hue,
        'duracao_min', i.duracao_min, 'cadencia_semanas', i.cadencia_semanas,
        'prioridade', i.prioridade, 'obrigatoria', i.obrigatoria,
        'cargos', (select coalesce(jsonb_agg(pic.cargo_id), '[]'::jsonb) from playbook_item_cargos pic where pic.playbook_item_id = i.id)
      ) order by i.ordem), '[]'::jsonb)
      from playbook_itens i
      join tipos_cerimonia tc on tc.id = i.tipo_cerimonia_id
    ),
    'projetos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'nome', pr.nome, 'cliente_id', pr.cliente_id, 'cliente', cl.nome,
        'prioridade', coalesce(pr.prioridade, cl.prioridade), 'etapa_id', pr.etapa_id,
        'time_id', pr.time_id, 'mes', pr.mes, 'health', pr.health, 'atraso_dias', pr.atraso_dias,
        'produtos', (
          select jsonb_build_object(
            'relatorios', count(*) filter (where pd.tipo = 'relatorio'),
            'dashboards', count(*) filter (where pd.tipo = 'dashboard'),
            'integracoes', count(*) filter (where pd.tipo = 'integracao')
          ) from produtos pd where pd.projeto_id = pr.id
        ),
        'squad', (
          select coalesce(jsonb_object_agg(a.cargo_id::text, a.pessoa_id), '{}'::jsonb)
          from alocacoes a where a.projeto_id = pr.id and a.fim is null
        )
      ) order by pr.criado_em, pr.nome), '[]'::jsonb)
      from projetos pr
      join clientes cl on cl.id = pr.cliente_id
      where pr.ativo
    ),
    'premissas_cargo', (
      select coalesce(jsonb_object_agg(v.cargo_id::text, to_jsonb(v) - 'id' - 'autor' - 'criado_em'), '{}'::jsonb)
      from premissas_cargo_vigentes v
    ),
    'premissas_gerais', (
      select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from premissas_gerais_vigentes
    ),
    'prioridades', (
      select coalesce(jsonb_object_agg(nivel::text, peso), '{}'::jsonb) from prioridades_cliente
    )
  )
$$;

-- ─────────────────────── operações transacionais ───────────────────────
-- Remover etapa exige destino para os projetos; o playbook da etapa vai junto (R52).
create or replace function public.remover_etapa(p_etapa uuid, p_destino uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_etapa = p_destino then
    raise exception 'a etapa de destino precisa ser diferente da removida';
  end if;
  update projetos set etapa_id = p_destino where etapa_id = p_etapa;
  delete from etapas where id = p_etapa;
end $$;

-- Excluir time obriga a escolher para onde vão os projetos (§7.5).
create or replace function public.excluir_time(p_time uuid, p_destino uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_time = p_destino then
    raise exception 'o time de destino precisa ser diferente do excluído';
  end if;
  update projetos set time_id = p_destino where time_id = p_time;
  delete from times where id = p_time;
end $$;

-- Grava o squad inteiro numa transação: [{projeto_id, cargo_id, pessoa_id}]
create or replace function public.salvar_squads(p_cadeiras jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  cadeira jsonb;
begin
  for cadeira in select * from jsonb_array_elements(p_cadeiras) loop
    update alocacoes set fim = current_date
    where projeto_id = (cadeira ->> 'projeto_id')::uuid
      and cargo_id = (cadeira ->> 'cargo_id')::uuid
      and fim is null
      and pessoa_id is distinct from (cadeira ->> 'pessoa_id')::uuid;

    if cadeira ->> 'pessoa_id' is not null then
      insert into alocacoes (projeto_id, cargo_id, pessoa_id, origem)
      values (
        (cadeira ->> 'projeto_id')::uuid,
        (cadeira ->> 'cargo_id')::uuid,
        (cadeira ->> 'pessoa_id')::uuid,
        coalesce((cadeira ->> 'origem')::origem_alocacao, 'auto')
      )
      on conflict do nothing;
    end if;
  end loop;
end $$;
