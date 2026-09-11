-- ═══════════════════════════════════════════════════════════════════
-- Cadência · ordem estável para o motor
-- projetos.sequencia: a posição do projeto faseia a cadência até a E14 trocar por datas
-- playbook_item_cargos.ordem: a ordem dos cargos define a ordem dos participantes
-- Gerado por scripts/gerar-seed.ts.
-- ═══════════════════════════════════════════════════════════════════

alter table projetos add column sequencia int;
alter table playbook_item_cargos add column ordem int not null default 0;

update projetos p set sequencia = v.seq
from (values
    ('Grupo Vértice A', 0),
    ('Agro Everest B', 1),
    ('Indústrias Ferrolar C', 2),
    ('Indústrias Urano D', 3),
    ('Indústrias Cristalina E', 4),
    ('Log Horizonte F', 5),
    ('Holding Serra Azul G', 6),
    ('Grupo Rubi H', 7),
    ('Agro Bandeirante I', 8),
    ('Grupo Marfim J', 9),
    ('Log Jacarandá K', 10),
    ('Grupo Diamantina L', 11),
    ('Holding Estrela M', 12),
    ('Indústrias Ourivés N', 13),
    ('Agro Estrela O', 14),
    ('Log Zênite P', 15),
    ('Rede Lumina Q', 16),
    ('Med Vértice R', 17),
    ('Log Solaris S', 18),
    ('Log Montana T', 19),
    ('Med Everest U', 20),
    ('Rede Guaraí V', 21),
    ('Rede Jacarandá W', 22),
    ('Rede Pampulha X', 23),
    ('Holding Everest Y', 24),
    ('Cia Estrela Z', 25),
    ('Agro Pampulha A', 26),
    ('Rede Nortis B', 27),
    ('Indústrias Itaúna C', 28),
    ('Agro Verdaz D', 29),
    ('Log Ipê E', 30),
    ('Agro Vértice F', 31),
    ('Agro Everest G', 32),
    ('Log Ferrolar H', 33),
    ('Holding Xisto I', 34),
    ('Holding Marfim J', 35),
    ('Cia Delta Sul K', 36),
    ('Rede Ourivés L', 37),
    ('Log Montana M', 38),
    ('Holding Horizonte N', 39),
    ('Agro Solaris O', 40),
    ('Indústrias Rubi P', 41),
    ('Rede Xisto Q', 42),
    ('Rede Diamantina R', 43),
    ('Log Kaporã S', 44),
    ('Med Andorra T', 45),
    ('Grupo Lumina U', 46),
    ('Agro Ferrolar V', 47),
    ('Log Tramontana W', 48),
    ('Indústrias Rubi X', 49),
    ('Holding Estrela Y', 50),
    ('Holding Andorra Z', 51),
    ('Med Ipê A', 52),
    ('Med Marfim B', 53),
    ('Log Nortis C', 54),
    ('Log Andorra D', 55),
    ('Agro Zênite E', 56),
    ('Rede Horizonte F', 57),
    ('Rede Urano G', 58),
    ('Log Verdaz H', 59),
    ('Log Vértice I', 60),
    ('Holding Aurora J', 61),
    ('Agro Tramontana K', 62),
    ('Med Cristalina L', 63),
    ('Rede Diamantina M', 64),
    ('Log Montana N', 65),
    ('Rede Diamantina O', 66),
    ('Rede Rubi P', 67),
    ('Log Guaraí Q', 68),
    ('Indústrias Ipê R', 69),
    ('Agro Vértice S', 70),
    ('Grupo Lumina T', 71),
    ('Grupo Guaraí U', 72),
    ('Rede Solaris V', 73),
    ('Rede Vértice W', 74),
    ('Rede Marfim X', 75),
    ('Holding Lumina Y', 76),
    ('Log Diamantina Z', 77),
    ('Grupo Guaraí A', 78),
    ('Med Xisto B', 79),
    ('Holding Serra Azul C', 80),
    ('Rede Delta Sul D', 81),
    ('Indústrias Diamantina E', 82),
    ('Cia Marfim F', 83),
    ('Med Kaporã G', 84),
    ('Log Lumina H', 85),
    ('Cia Serra Azul I', 86),
    ('Log Bandeirante J', 87),
    ('Grupo Xisto K', 88),
    ('Indústrias Horizonte L', 89),
    ('Holding Rubi M', 90),
    ('Holding Urano N', 91),
    ('Indústrias Rubi O', 92),
    ('Log Everest P', 93),
    ('Med Nortis Q', 94),
    ('Indústrias Tramontana R', 95),
    ('Indústrias Tramontana S', 96),
    ('Grupo Câmbio T', 97),
    ('Cia Ourivés U', 98),
    ('Rede Ourivés V', 99),
    ('Cia Horizonte W', 100),
    ('Indústrias Estrela X', 101),
    ('Cia Estrela Y', 102),
    ('Indústrias Tramontana Z', 103),
    ('Agro Cristalina A', 104),
    ('Indústrias Cristalina B', 105),
    ('Med Urano C', 106),
    ('Holding Bandeirante D', 107),
    ('Indústrias Aurora E', 108),
    ('Indústrias Nortis F', 109),
    ('Agro Ipê G', 110),
    ('Cia Nortis H', 111)
) as v(nome, seq)
where p.nome = v.nome;

-- projetos novos entram no fim da fila
create sequence projetos_sequencia_seq owned by projetos.sequencia;
select setval('projetos_sequencia_seq', (select coalesce(max(sequencia), -1) + 1 from projetos), false);
alter table projetos alter column sequencia set default nextval('projetos_sequencia_seq');
alter table projetos alter column sequencia set not null;
create unique index projetos_sequencia_idx on projetos (sequencia);

update playbook_item_cargos pic set ordem = x.ordem
from (
  select i.id as item, c.id as cargo, v.ordem
  from (values
    ('kickoff', 'Kickoff Executivo', 'Gerente de Projeto', 0),
    ('kickoff', 'Kickoff Executivo', 'Analista Sênior', 1),
    ('kickoff', 'Kickoff Executivo', 'Líder Técnico', 2),
    ('kickoff', 'Levantamento de Requisitos', 'Especialista', 0),
    ('kickoff', 'Levantamento de Requisitos', 'Analista Sênior', 1),
    ('discovery', 'Reunião de Trabalho', 'Analista', 0),
    ('discovery', 'Reunião de Trabalho', 'Especialista', 1),
    ('discovery', 'Status Report', 'Gerente de Projeto', 0),
    ('discovery', 'Status Report', 'Analista Sênior', 1),
    ('discovery', 'Validação de Dados', 'Arquiteto de Dados', 0),
    ('discovery', 'Validação de Dados', 'Analista Sênior', 1),
    ('construcao', 'Reunião de Trabalho', 'Analista', 0),
    ('construcao', 'Reunião de Trabalho', 'Especialista', 1),
    ('construcao', 'Status Report', 'Líder Técnico', 0),
    ('construcao', 'Validação de Produto', 'Analista Sênior', 0),
    ('construcao', 'Validação de Produto', 'Especialista', 1),
    ('homologacao', 'Sessão de Homologação', 'Especialista', 0),
    ('homologacao', 'Sessão de Homologação', 'Analista Sênior', 1),
    ('homologacao', 'Status Report', 'Gerente de Projeto', 0),
    ('homologacao', 'Status Report', 'Líder Técnico', 1),
    ('golive', 'Acompanhamento Pós Go-live', 'Analista', 0),
    ('golive', 'Treinamento de Usuários', 'Especialista', 0),
    ('golive', 'Treinamento de Usuários', 'Analista', 1),
    ('sustentacao', 'Check-in de Sustentação', 'Analista', 0)
  ) as v(etapa, tipo, cargo, ordem)
  join etapas e on e.chave = v.etapa
  join tipos_cerimonia tc on tc.nome = v.tipo
  join playbook_itens i on i.etapa_id = e.id and i.tipo_cerimonia_id = tc.id
  join cargos c on c.nome = v.cargo
) x
where pic.playbook_item_id = x.item and pic.cargo_id = x.cargo;

-- carregar_mundo passa a respeitar as duas ordens
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
        'cargos', (
          select coalesce(jsonb_agg(pic.cargo_id order by pic.ordem), '[]'::jsonb)
          from playbook_item_cargos pic where pic.playbook_item_id = i.id
        )
      ) order by i.ordem), '[]'::jsonb)
      from playbook_itens i
      join tipos_cerimonia tc on tc.id = i.tipo_cerimonia_id
    ),
    'projetos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'nome', pr.nome, 'cliente_id', pr.cliente_id, 'cliente', cl.nome,
        'prioridade', coalesce(pr.prioridade, cl.prioridade), 'etapa_id', pr.etapa_id,
        'time_id', pr.time_id, 'mes', pr.mes, 'health', pr.health, 'atraso_dias', pr.atraso_dias,
        'sequencia', pr.sequencia,
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
      ) order by pr.sequencia), '[]'::jsonb)
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
