begin;

create unique index if not exists roles_system_code_uidx
  on public.roles(code)
  where company_id is null;

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.is_active_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_company_memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.user_has_role(target_company_id uuid, allowed_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_company_memberships m
    join public.roles r on r.id = m.role_id
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.code = any(allowed_codes)
  );
$$;

create or replace function public.is_user_assigned_to_site(target_company_id uuid, target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_assignments sa
    where sa.company_id = target_company_id
      and sa.site_id = target_site_id
      and sa.user_id = auth.uid()
      and sa.is_active = true
  );
$$;

create or replace function public.can_read_site_data(target_company_id uuid, target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_company_member(target_company_id)
    and (
      not public.user_has_role(target_company_id, array['site_operator'])
      or public.user_has_role(target_company_id, array['business_owner_admin', 'project_manager', 'warehouse', 'offshore_engineer'])
      or public.is_user_assigned_to_site(target_company_id, target_site_id)
    );
$$;

create or replace function public.can_write_company_data(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_role(target_company_id, array['business_owner_admin', 'project_manager']);
$$;

create or replace function public.can_write_site_data(target_company_id uuid, target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_role(target_company_id, array['business_owner_admin', 'project_manager']);
$$;

create or replace function public.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_role(target_company_id, array['business_owner_admin']);
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, phone, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'phone',
    'active'
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

-- Keep updated_at current without manually touching every mutation path.
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables bt
      on bt.table_schema = c.table_schema
     and bt.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and bt.table_type = 'BASE TABLE'
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', t, t);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- Enable RLS on all domain tables.
do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name in (
        'companies', 'users', 'roles', 'permissions', 'role_permissions', 'user_company_memberships',
        'projects', 'sites', 'turbines', 'blades', 'site_assignments', 'crew_members',
        'repair_methodologies', 'work_orders', 'tasks', 'delays', 'time_budgets', 'site_daily_costs',
        'project_profit_projections', 'repair_scope_items',
        'materials', 'warehouses', 'warehouse_stock', 'site_stock', 'inventory_transfers', 'material_usage',
        'vehicles', 'vehicle_assignments',
        'inspections', 'evidence_items', 'inspection_images', 'engineer_reviews', 'approvals',
        'communication_threads', 'operator_questions', 'engineer_responses', 'external_message_links',
        'report_templates', 'reports', 'report_sections', 'report_items', 'audit_logs'
      )
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Identity policies

drop policy if exists companies_read on public.companies;
create policy companies_read
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.user_company_memberships m
    where m.company_id = companies.id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists companies_create on public.companies;
create policy companies_create
on public.companies
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using (public.can_manage_company(id))
with check (public.can_manage_company(id));

drop policy if exists companies_delete_admin on public.companies;
create policy companies_delete_admin
on public.companies
for delete
to authenticated
using (public.can_manage_company(id));

drop policy if exists users_read on public.users;
create policy users_read
on public.users
for select
to authenticated
using (
  users.id = auth.uid()
  or exists (
    select 1
    from public.user_company_memberships me
    join public.user_company_memberships peer
      on peer.company_id = me.company_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and peer.user_id = users.id
      and peer.status = 'active'
  )
);

drop policy if exists users_insert_self on public.users;
create policy users_insert_self
on public.users
for insert
to authenticated
with check (users.id = auth.uid());

drop policy if exists users_update_self on public.users;
create policy users_update_self
on public.users
for update
to authenticated
using (users.id = auth.uid())
with check (users.id = auth.uid());

drop policy if exists roles_read on public.roles;
create policy roles_read
on public.roles
for select
to authenticated
using (
  roles.company_id is null
  or public.is_active_company_member(roles.company_id)
);

drop policy if exists roles_mutate_admin on public.roles;
create policy roles_mutate_admin
on public.roles
for all
to authenticated
using (
  roles.company_id is not null
  and public.can_manage_company(roles.company_id)
)
with check (
  roles.company_id is not null
  and public.can_manage_company(roles.company_id)
);

drop policy if exists permissions_read on public.permissions;
create policy permissions_read
on public.permissions
for select
to authenticated
using (true);

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (r.company_id is null or public.is_active_company_member(r.company_id))
  )
);

drop policy if exists role_permissions_mutate_admin on public.role_permissions;
create policy role_permissions_mutate_admin
on public.role_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (
        r.company_id is not null
        and public.can_manage_company(r.company_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (
        r.company_id is not null
        and public.can_manage_company(r.company_id)
      )
  )
);

drop policy if exists memberships_read on public.user_company_memberships;
create policy memberships_read
on public.user_company_memberships
for select
to authenticated
using (
  user_company_memberships.user_id = auth.uid()
  or public.can_manage_company(user_company_memberships.company_id)
);

drop policy if exists memberships_mutate_admin on public.user_company_memberships;
create policy memberships_mutate_admin
on public.user_company_memberships
for all
to authenticated
using (public.can_manage_company(user_company_memberships.company_id))
with check (public.can_manage_company(user_company_memberships.company_id));

-- Domain policies for company-scoped operational tables.
do $$
declare
  t text;
  has_site_id boolean;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
      and table_name not in (
        'roles', 'permissions', 'role_permissions', 'user_company_memberships', 'audit_logs'
      )
  loop
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'site_id'
    ) into has_site_id;

    execute format('drop policy if exists %I_company_read on public.%I', t, t);
    if has_site_id then
      execute format(
        'create policy %I_company_read on public.%I for select to authenticated using (public.can_read_site_data(company_id, site_id))',
        t,
        t
      );
    else
      execute format(
        'create policy %I_company_read on public.%I for select to authenticated using (public.is_active_company_member(company_id))',
        t,
        t
      );
    end if;

    if t <> 'audit_logs' then
      execute format('drop policy if exists %I_pm_write on public.%I', t, t);
      if has_site_id then
        execute format(
          'create policy %I_pm_write on public.%I for all to authenticated using (public.can_write_site_data(company_id, site_id)) with check (public.can_write_site_data(company_id, site_id))',
          t,
          t
        );
      else
        execute format(
          'create policy %I_pm_write on public.%I for all to authenticated using (public.can_write_company_data(company_id)) with check (public.can_write_company_data(company_id))',
          t,
          t
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Warehouse write extensions.
do $$
declare
  t text;
begin
  foreach t in array array[
    'materials', 'warehouses', 'warehouse_stock', 'site_stock', 'inventory_transfers',
    'material_usage', 'vehicles', 'vehicle_assignments'
  ]
  loop
    execute format('drop policy if exists %I_warehouse_write on public.%I', t, t);
    execute format(
      'create policy %I_warehouse_write on public.%I for all to authenticated using (public.user_has_role(company_id, array[''business_owner_admin'', ''warehouse''])) with check (public.user_has_role(company_id, array[''business_owner_admin'', ''warehouse'']))',
      t,
      t
    );
  end loop;
end;
$$;

-- Engineer write extensions.
do $$
declare
  t text;
begin
  foreach t in array array[
    'engineer_reviews', 'approvals', 'engineer_responses', 'reports', 'report_sections', 'report_items', 'report_templates'
  ]
  loop
    execute format('drop policy if exists %I_engineer_write on public.%I', t, t);
    execute format(
      'create policy %I_engineer_write on public.%I for all to authenticated using (public.user_has_role(company_id, array[''business_owner_admin'', ''project_manager'', ''offshore_engineer''])) with check (public.user_has_role(company_id, array[''business_owner_admin'', ''project_manager'', ''offshore_engineer'']))',
      t,
      t
    );
  end loop;
end;
$$;

-- Site operator write extensions for assigned sites.
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'delays', 'evidence_items', 'operator_questions', 'communication_threads']
  loop
    execute format('drop policy if exists %I_site_operator_write on public.%I', t, t);
    execute format(
      'create policy %I_site_operator_write on public.%I for all to authenticated using (site_id is not null and public.user_has_role(company_id, array[''site_operator'']) and public.is_user_assigned_to_site(company_id, site_id)) with check (site_id is not null and public.user_has_role(company_id, array[''site_operator'']) and public.is_user_assigned_to_site(company_id, site_id))',
      t,
      t
    );
  end loop;
end;
$$;

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read
on public.audit_logs
for select
to authenticated
using (
  public.user_has_role(company_id, array['business_owner_admin', 'project_manager', 'offshore_engineer'])
);

commit;
