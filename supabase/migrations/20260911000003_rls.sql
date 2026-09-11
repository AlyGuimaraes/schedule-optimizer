-- ═══════════════════════════════════════════════════════════════════
-- Cadência · segurança por papel
-- leitor lê tudo · gestor escreve cadastros, premissas e cenários · admin manda no playbook
-- solver_jobs e agente_execucoes são só para a service role.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.tem_papel(minimo papel_app)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis_usuario u
    where u.user_id = auth.uid()
      and case minimo
        when 'leitor' then true
        when 'gestor' then u.papel_app in ('gestor', 'admin')
        when 'admin' then u.papel_app = 'admin'
      end
  )
$$;

-- Todo usuário autenticado ganha um perfil de leitor no primeiro acesso.
create or replace function public.criar_perfil_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis_usuario (user_id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger criar_perfil_usuario_trg
after insert on auth.users
for each row execute function public.criar_perfil_usuario();

-- ─────────────────────── políticas padrão ───────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'cargos', 'premissas_cargo', 'premissas_gerais', 'premissas_override', 'etapas',
    'prioridades_cliente', 'pessoas', 'times', 'time_membros', 'clientes', 'projetos',
    'produtos', 'alocacoes', 'tipos_cerimonia', 'playbook_itens', 'playbook_item_cargos',
    'series', 'cenarios', 'ocorrencias', 'participantes', 'concessoes', 'trocas_cadeira',
    'demanda_nao_atendida', 'kpis_snapshot', 'integracoes_calendario', 'eventos_externos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select to authenticated using (public.tem_papel(''leitor''))',
      t || '_leitura', t
    );
    execute format(
      'create policy %I on %I for all to authenticated using (public.tem_papel(''gestor'')) with check (public.tem_papel(''gestor''))',
      t || '_escrita', t
    );
  end loop;
end $$;

-- Playbook e cargos mudam o que a operação entrega ao cliente: só admin (decisão D-03).
drop policy playbook_itens_escrita on playbook_itens;
create policy playbook_itens_escrita on playbook_itens for all to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

drop policy playbook_item_cargos_escrita on playbook_item_cargos;
create policy playbook_item_cargos_escrita on playbook_item_cargos for all to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

-- ─────────────────────── tabelas com regra própria ───────────────────────
alter table perfis_usuario enable row level security;
create policy perfis_usuario_proprio on perfis_usuario for select to authenticated
  using (user_id = auth.uid() or public.tem_papel('admin'));
create policy perfis_usuario_edita_proprio on perfis_usuario for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy perfis_usuario_admin on perfis_usuario for all to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

alter table auditoria enable row level security;
create policy auditoria_leitura on auditoria for select to authenticated
  using (public.tem_papel('admin'));

-- Sem política: ninguém acessa com a chave pública, só a service role.
alter table solver_jobs enable row level security;
alter table agente_execucoes enable row level security;
