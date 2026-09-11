/**
 * Gera a migração de dados de demonstração a partir da semente do domínio.
 *
 *   pnpm seed:gerar
 *
 * Diferença importante para o protótipo: aqui os squads passam por `montarSquad`,
 * então cada cadeira sai do time do projeto, como manda o §2.0 (defeito 15 do plano).
 */
import fs from "node:fs"
import path from "node:path"

import {
  CLIENTES_PADRAO,
  ETAPAS_PADRAO,
  FASES_PADRAO,
  GERAL_PADRAO,
  PLAYBOOK_PADRAO,
  PREM_PADRAO,
  construirMundo,
  montarSquad,
} from "../lib/dominio"

const DESTINO = path.join(
  process.cwd(),
  "supabase/migrations/20260911000004_dados_demonstracao.sql"
)

// hues por tipo de cerimônia, iguais aos do protótipo
const HUE_CERIMONIA: Record<string, number> = {
  "Kickoff Executivo": 300,
  "Levantamento de Requisitos": 250,
  "Reunião de Trabalho": 145,
  "Status Report": 85,
  "Validação de Dados": 225,
  "Validação de Produto": 210,
  "Sessão de Homologação": 35,
  "Acompanhamento Pós Go-live": 170,
  "Treinamento de Usuários": 60,
  "Check-in de Sustentação": 110,
}

const t = (v: string) => `'${v.replace(/'/g, "''")}'`
const n = (v: number) => String(v)
const b = (v: boolean) => (v ? "true" : "false")
const linhas = (vs: string[]) => vs.join(",\n    ")

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function email(nome: string) {
  const partes = semAcento(nome).toLowerCase().split(/\s+/)
  return `${partes[0]}.${partes[partes.length - 1]}@leverpro.com.br`
}

const mundo = construirMundo()
// corrige o defeito 15: sem isso, 55% das cadeiras ficam com gente de fora do time
mundo.projetos.forEach((pr) => montarSquad(mundo, pr))

// nomes de projeto precisam ser únicos, porque o seed resolve as chaves por nome
const vistos = new Set<string>()
mundo.projetos.forEach((pr) => {
  if (vistos.has(pr.nome)) pr.nome = `${pr.nome}${pr.id}`
  vistos.add(pr.nome)
})

const cargos = Object.keys(PREM_PADRAO)
const clientes = new Map<string, string>() // nome do cliente -> prioridade
mundo.projetos.forEach((pr) => {
  const cliente = pr.nome.split(" ").slice(0, -1).join(" ") || pr.nome
  if (!clientes.has(cliente)) clientes.set(cliente, pr.prioridade)
})

const tiposCerimonia = [
  ...new Set(Object.values(PLAYBOOK_PADRAO).flatMap((cs) => cs.map((c) => c.tipo))),
]

const sql = `-- ═══════════════════════════════════════════════════════════════════
-- Cadência · dados de demonstração (semente 7 do motor de domínio)
-- 112 projetos, 20 pessoas, 4 times, 6 etapas e 13 itens de playbook.
-- Gerado por scripts/gerar-seed.ts. Para uma base limpa em produção,
-- basta não aplicar esta migração ou remover os dados depois.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────── cargos e premissas ───────────────────────
insert into cargos (nome, ordem) values
    ${linhas(cargos.map((c, i) => `(${t(c)}, ${n(i)})`))};

insert into premissas_cargo (
  cargo_id, jornada, fator_ausencia, tempo_institucional, produtivo_min, tolerancia,
  max_reunioes_dia, max_horas_dia, max_horas_semana, max_horas_mes,
  duracao_max_min, bloco_foco_min_min, janela_protegida_min
)
select c.id, v.jornada, v.ausencia, v.institucional, v.produtivo, v.tolerancia,
       v.reunioes_dia, v.horas_dia, v.horas_semana, v.horas_mes,
       v.duracao_max, v.bloco_foco, v.janela
from (values
    ${linhas(
      cargos.map((c) => {
        const p = PREM_PADRAO[c]
        return `(${t(c)}, ${n(p.jornada)}, ${n(p.fatorAusencia)}, ${n(p.tempoInstitucional)}, ${n(p.produtivoMin)}, ${n(p.tolerancia)}, ${n(p.maxReunioesDia)}, ${n(p.maxHorasDia)}, ${n(p.maxHorasSemana)}, ${n(p.maxHorasMes)}, ${n(p.duracaoMax * 30)}, ${n(p.blocoFocoMin * 30)}, ${n(p.focoProt * 30)})`
      })
    )}
) as v(cargo, jornada, ausencia, institucional, produtivo, tolerancia, reunioes_dia,
       horas_dia, horas_semana, horas_mes, duracao_max, bloco_foco, janela)
join cargos c on c.nome = v.cargo;

-- ─────────────────────── premissas gerais (§2.2) ───────────────────────
-- Horários em slots de 30 minutos a partir das 08:00, como no motor.
insert into premissas_gerais (chave, valor) values
    ('inicio_jornada', '${GERAL_PADRAO.inicio}'::jsonb),
    ('fim_jornada', '${GERAL_PADRAO.fim}'::jsonb),
    ('almoco_inicio', '${GERAL_PADRAO.almocoInicio}'::jsonb),
    ('almoco_duracao', '${GERAL_PADRAO.almocoDur}'::jsonb),
    ('intervalo_entre_reunioes', '${GERAL_PADRAO.buffer}'::jsonb),
    ('horarios_preferidos', '${JSON.stringify(GERAL_PADRAO.preferidos)}'::jsonb),
    ('peso_preferencia', '${GERAL_PADRAO.pesoPreferencia}'::jsonb),
    ('dia_protegido', '"${GERAL_PADRAO.diaProtegido}"'::jsonb),
    ('quorum_minimo_pct', '100'::jsonb),
    ('antecedencia_horas', '48'::jsonb),
    ('estabilidade_max_pct', '20'::jsonb);

-- ─────────────────────── etapas e prioridades ───────────────────────
insert into etapas (chave, rotulo, ordem, urgencia, prazo_dias, hue) values
    ${linhas(
      Object.entries(FASES_PADRAO).map(([chave, f], i) => {
        const e = ETAPAS_PADRAO[chave]
        return `(${t(chave)}, ${t(f.rotulo)}, ${n(i)}, ${n(e.urgencia)}, ${n(e.prazoDias)}, ${n(f.hue)})`
      })
    )};

insert into prioridades_cliente (nivel, peso) values
    ${linhas(Object.entries(CLIENTES_PADRAO).map(([k, v]) => `(${t(k)}, ${n(v)})`))};

-- ─────────────────────── playbook (§3.1) ───────────────────────
insert into tipos_cerimonia (nome, hue) values
    ${linhas(tiposCerimonia.map((tc) => `(${t(tc)}, ${n(HUE_CERIMONIA[tc] ?? 220)})`))};

insert into playbook_itens (etapa_id, tipo_cerimonia_id, duracao_min, cadencia_semanas, prioridade, obrigatoria, ordem)
select e.id, tc.id, v.duracao, v.cadencia, v.prioridade, v.obrigatoria, v.ordem
from (values
    ${linhas(
      Object.entries(PLAYBOOK_PADRAO).flatMap(([fase, itens]) =>
        itens.map(
          (c, i) =>
            `(${t(fase)}, ${t(c.tipo)}, ${n(c.dur)}, ${n(c.cada)}, ${n(c.prio)}, ${b(c.obrig)}, ${n(i)})`
        )
      )
    )}
) as v(etapa, tipo, duracao, cadencia, prioridade, obrigatoria, ordem)
join etapas e on e.chave = v.etapa
join tipos_cerimonia tc on tc.nome = v.tipo;

insert into playbook_item_cargos (playbook_item_id, cargo_id)
select i.id, c.id
from (values
    ${linhas(
      Object.entries(PLAYBOOK_PADRAO).flatMap(([fase, itens]) =>
        itens.flatMap((item) => item.papeis.map((papel) => `(${t(fase)}, ${t(item.tipo)}, ${t(papel)})`))
      )
    )}
) as v(etapa, tipo, cargo)
join etapas e on e.chave = v.etapa
join tipos_cerimonia tc on tc.nome = v.tipo
join playbook_itens i on i.etapa_id = e.id and i.tipo_cerimonia_id = tc.id
join cargos c on c.nome = v.cargo;

-- ─────────────────────── pessoas e times ───────────────────────
insert into pessoas (nome, iniciais, cargo_id, email)
select v.nome, v.iniciais, c.id, v.email
from (values
    ${linhas(
      mundo.pessoas.map(
        (p) => `(${t(p.nome)}, ${t(p.iniciais)}, ${t(p.papel)}, ${t(email(p.nome))})`
      )
    )}
) as v(nome, iniciais, cargo, email)
join cargos c on c.nome = v.cargo;

insert into times (nome) values
    ${linhas(mundo.times.map((tm) => `(${t(tm.nome)})`))};

insert into time_membros (time_id, pessoa_id)
select tm.id, p.id
from (values
    ${linhas(
      mundo.times.flatMap((tm) =>
        tm.membros.map((id) => `(${t(tm.nome)}, ${t(mundo.pessoas[id].nome)})`)
      )
    )}
) as v(time, pessoa)
join times tm on tm.nome = v.time
join pessoas p on p.nome = v.pessoa;

-- ─────────────────────── clientes e projetos ───────────────────────
insert into clientes (nome, prioridade) values
    ${linhas([...clientes.entries()].map(([nome, pri]) => `(${t(nome)}, ${t(pri)})`))};

insert into projetos (cliente_id, nome, etapa_id, time_id, mes, health, prioridade)
select cl.id, v.nome, e.id, tm.id, v.mes, v.health::health_projeto, v.prioridade::prioridade_cliente
from (values
    ${linhas(
      mundo.projetos.map((pr) => {
        const cliente = pr.nome.split(" ").slice(0, -1).join(" ") || pr.nome
        const time = mundo.times.find((x) => x.id === pr.timeId)!
        return `(${t(cliente)}, ${t(pr.nome)}, ${t(pr.fase)}, ${t(time.nome)}, ${n(pr.mes)}, ${t(pr.health)}, ${t(pr.prioridade)})`
      })
    )}
) as v(cliente, nome, etapa, time, mes, health, prioridade)
join clientes cl on cl.nome = v.cliente
join etapas e on e.chave = v.etapa
join times tm on tm.nome = v.time;

insert into produtos (projeto_id, tipo)
select p.id, v.tipo::tipo_produto
from (values
    ${linhas(
      mundo.projetos.flatMap((pr) =>
        [
          ["relatorio", pr.produtos.relatorios] as const,
          ["dashboard", pr.produtos.dashboards] as const,
          ["integracao", pr.produtos.integracoes] as const,
        ]
          .filter(([, q]) => q > 0)
          .map(([tipo, q]) => `(${t(pr.nome)}, ${t(tipo)}, ${n(q)})`)
      )
    )}
) as v(projeto, tipo, quantidade)
join projetos p on p.nome = v.projeto
cross join generate_series(1, v.quantidade);

-- ─────────────────────── squads (§2.0, cada cadeira sai do time) ───────────────────────
insert into alocacoes (projeto_id, cargo_id, pessoa_id)
select p.id, c.id, pe.id
from (values
    ${linhas(
      mundo.projetos.flatMap((pr) =>
        Object.entries(pr.squad)
          .filter(([, id]) => id !== undefined)
          .map(([cargo, id]) => `(${t(pr.nome)}, ${t(cargo)}, ${t(mundo.pessoas[id as number].nome)})`)
      )
    )}
) as v(projeto, cargo, pessoa)
join projetos p on p.nome = v.projeto
join cargos c on c.nome = v.cargo
join pessoas pe on pe.nome = v.pessoa;
`

fs.writeFileSync(DESTINO, sql)

// ─────────────────────── ordem estável (migração 0005) ───────────────────────
// A posição do projeto faseia a cadência no motor e a ordem dos cargos define a ordem
// dos participantes. O banco não garante nenhuma das duas sem uma coluna explícita.
const DESTINO_ORDEM = path.join(
  process.cwd(),
  "supabase/migrations/20260911000005_ordem_estavel.sql"
)

const sqlOrdem = `-- ═══════════════════════════════════════════════════════════════════
-- Cadência · ordem estável para o motor
-- projetos.sequencia: a posição do projeto faseia a cadência até a E14 trocar por datas
-- playbook_item_cargos.ordem: a ordem dos cargos define a ordem dos participantes
-- Gerado por scripts/gerar-seed.ts.
-- ═══════════════════════════════════════════════════════════════════

alter table projetos add column sequencia int;
alter table playbook_item_cargos add column ordem int not null default 0;

update projetos p set sequencia = v.seq
from (values
    ${linhas(mundo.projetos.map((pr) => `(${t(pr.nome)}, ${n(pr.id)})`))}
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
    ${linhas(
      Object.entries(PLAYBOOK_PADRAO).flatMap(([fase, itens]) =>
        itens.flatMap((item) =>
          item.papeis.map((papel, i) => `(${t(fase)}, ${t(item.tipo)}, ${t(papel)}, ${n(i)})`)
        )
      )
    )}
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
`

fs.writeFileSync(DESTINO_ORDEM, sqlOrdem)

const cadeiras = mundo.projetos.reduce(
  (s, pr) => s + Object.values(pr.squad).filter((x) => x !== undefined).length,
  0
)
console.log(
  `seed gerado: ${DESTINO}\n` +
    `${(sql.length / 1024).toFixed(0)}KB · ${mundo.projetos.length} projetos · ${clientes.size} clientes · ` +
    `${mundo.pessoas.length} pessoas · ${mundo.times.length} times · ${cadeiras} cadeiras`
)
