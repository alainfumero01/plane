begin;

insert into public.roles (company_id, code, name, is_system)
values
  (null, 'business_owner_admin', 'Business Owner / Admin', true),
  (null, 'warehouse', 'Warehouse', true),
  (null, 'project_manager', 'Project Manager', true),
  (null, 'site_operator', 'Site Operator', true),
  (null, 'offshore_engineer', 'Off-Shore Engineer', true)
on conflict do nothing;

insert into public.permissions (resource, action, scope)
values
  ('company', 'read', 'company'),
  ('company', 'manage', 'company'),
  ('users', 'manage', 'company'),
  ('roles', 'manage', 'company'),
  ('projects', 'read', 'company'),
  ('projects', 'write', 'company'),
  ('sites', 'read', 'site'),
  ('sites', 'write', 'site'),
  ('work_orders', 'read', 'site'),
  ('work_orders', 'write', 'site'),
  ('tasks', 'read', 'site'),
  ('tasks', 'write', 'site'),
  ('inventory', 'read', 'company'),
  ('inventory', 'write', 'company'),
  ('vehicles', 'read', 'company'),
  ('vehicles', 'write', 'company'),
  ('delays', 'read', 'site'),
  ('delays', 'write', 'site'),
  ('evidence', 'read', 'site'),
  ('evidence', 'write', 'site'),
  ('communications', 'read', 'site'),
  ('communications', 'write', 'site'),
  ('engineer_reviews', 'read', 'site'),
  ('engineer_reviews', 'write', 'site'),
  ('reports', 'read', 'company'),
  ('reports', 'write', 'company'),
  ('audit_logs', 'read', 'company')
on conflict (resource, action, scope) do nothing;

with role_permission_seed(role_code, resource, action, scope) as (
  values
    -- Admin gets everything
    ('business_owner_admin', 'company', 'read', 'company'),
    ('business_owner_admin', 'company', 'manage', 'company'),
    ('business_owner_admin', 'users', 'manage', 'company'),
    ('business_owner_admin', 'roles', 'manage', 'company'),
    ('business_owner_admin', 'projects', 'read', 'company'),
    ('business_owner_admin', 'projects', 'write', 'company'),
    ('business_owner_admin', 'sites', 'read', 'site'),
    ('business_owner_admin', 'sites', 'write', 'site'),
    ('business_owner_admin', 'work_orders', 'read', 'site'),
    ('business_owner_admin', 'work_orders', 'write', 'site'),
    ('business_owner_admin', 'tasks', 'read', 'site'),
    ('business_owner_admin', 'tasks', 'write', 'site'),
    ('business_owner_admin', 'inventory', 'read', 'company'),
    ('business_owner_admin', 'inventory', 'write', 'company'),
    ('business_owner_admin', 'vehicles', 'read', 'company'),
    ('business_owner_admin', 'vehicles', 'write', 'company'),
    ('business_owner_admin', 'delays', 'read', 'site'),
    ('business_owner_admin', 'delays', 'write', 'site'),
    ('business_owner_admin', 'evidence', 'read', 'site'),
    ('business_owner_admin', 'evidence', 'write', 'site'),
    ('business_owner_admin', 'communications', 'read', 'site'),
    ('business_owner_admin', 'communications', 'write', 'site'),
    ('business_owner_admin', 'engineer_reviews', 'read', 'site'),
    ('business_owner_admin', 'engineer_reviews', 'write', 'site'),
    ('business_owner_admin', 'reports', 'read', 'company'),
    ('business_owner_admin', 'reports', 'write', 'company'),
    ('business_owner_admin', 'audit_logs', 'read', 'company'),

    -- Warehouse
    ('warehouse', 'company', 'read', 'company'),
    ('warehouse', 'projects', 'read', 'company'),
    ('warehouse', 'sites', 'read', 'site'),
    ('warehouse', 'inventory', 'read', 'company'),
    ('warehouse', 'inventory', 'write', 'company'),
    ('warehouse', 'vehicles', 'read', 'company'),
    ('warehouse', 'vehicles', 'write', 'company'),

    -- Project manager
    ('project_manager', 'company', 'read', 'company'),
    ('project_manager', 'projects', 'read', 'company'),
    ('project_manager', 'projects', 'write', 'company'),
    ('project_manager', 'sites', 'read', 'site'),
    ('project_manager', 'sites', 'write', 'site'),
    ('project_manager', 'work_orders', 'read', 'site'),
    ('project_manager', 'work_orders', 'write', 'site'),
    ('project_manager', 'tasks', 'read', 'site'),
    ('project_manager', 'tasks', 'write', 'site'),
    ('project_manager', 'inventory', 'read', 'company'),
    ('project_manager', 'vehicles', 'read', 'company'),
    ('project_manager', 'delays', 'read', 'site'),
    ('project_manager', 'delays', 'write', 'site'),
    ('project_manager', 'evidence', 'read', 'site'),
    ('project_manager', 'communications', 'read', 'site'),
    ('project_manager', 'communications', 'write', 'site'),
    ('project_manager', 'engineer_reviews', 'read', 'site'),
    ('project_manager', 'engineer_reviews', 'write', 'site'),
    ('project_manager', 'reports', 'read', 'company'),
    ('project_manager', 'reports', 'write', 'company'),
    ('project_manager', 'audit_logs', 'read', 'company'),

    -- Site operator
    ('site_operator', 'company', 'read', 'company'),
    ('site_operator', 'sites', 'read', 'site'),
    ('site_operator', 'work_orders', 'read', 'site'),
    ('site_operator', 'tasks', 'read', 'site'),
    ('site_operator', 'tasks', 'write', 'site'),
    ('site_operator', 'delays', 'read', 'site'),
    ('site_operator', 'delays', 'write', 'site'),
    ('site_operator', 'evidence', 'read', 'site'),
    ('site_operator', 'evidence', 'write', 'site'),
    ('site_operator', 'communications', 'read', 'site'),
    ('site_operator', 'communications', 'write', 'site'),

    -- Off-shore engineer
    ('offshore_engineer', 'company', 'read', 'company'),
    ('offshore_engineer', 'projects', 'read', 'company'),
    ('offshore_engineer', 'sites', 'read', 'site'),
    ('offshore_engineer', 'work_orders', 'read', 'site'),
    ('offshore_engineer', 'tasks', 'read', 'site'),
    ('offshore_engineer', 'evidence', 'read', 'site'),
    ('offshore_engineer', 'communications', 'read', 'site'),
    ('offshore_engineer', 'communications', 'write', 'site'),
    ('offshore_engineer', 'engineer_reviews', 'read', 'site'),
    ('offshore_engineer', 'engineer_reviews', 'write', 'site'),
    ('offshore_engineer', 'reports', 'read', 'company'),
    ('offshore_engineer', 'reports', 'write', 'company'),
    ('offshore_engineer', 'audit_logs', 'read', 'company')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from role_permission_seed s
join public.roles r
  on r.code = s.role_code
 and r.company_id is null
join public.permissions p
  on p.resource = s.resource
 and p.action = s.action
 and p.scope = s.scope
on conflict (role_id, permission_id) do nothing;

create or replace function public.create_company_with_owner(
  p_company_name text,
  p_company_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_slug text;
  v_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  v_slug := coalesce(nullif(trim(p_company_slug), ''), nullif(trim(lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''));
  v_slug := trim(both '-' from coalesce(v_slug, 'company'));

  if v_slug = '' then
    v_slug := 'company';
  end if;

  loop
    begin
      insert into public.companies (name, slug)
      values (p_company_name, v_slug)
      returning id into v_company_id;
      exit;
    exception
      when unique_violation then
        v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
    end;
  end loop;

  insert into public.users (id, full_name, email)
  values (
    auth.uid(),
    coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()), ''),
    coalesce((select email from auth.users where id = auth.uid()), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = case when excluded.full_name = '' then users.full_name else excluded.full_name end,
      updated_at = now();

  select id
  into v_role_id
  from public.roles
  where code = 'business_owner_admin'
    and company_id is null
  limit 1;

  if v_role_id is null then
    raise exception 'system role business_owner_admin is missing';
  end if;

  update public.user_company_memberships
  set is_default_company = false,
      updated_at = now()
  where user_id = auth.uid();

  insert into public.user_company_memberships (user_id, company_id, role_id, status, is_default_company)
  values (auth.uid(), v_company_id, v_role_id, 'active', true)
  on conflict (user_id, company_id) do update
  set role_id = excluded.role_id,
      status = 'active',
      is_default_company = true,
      updated_at = now();

  return v_company_id;
end;
$$;

create or replace function public.join_company(
  p_company_slug text,
  p_role_code text default 'site_operator'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  select id into v_company_id
  from public.companies
  where slug = p_company_slug
    and status = 'active'
  limit 1;

  if v_company_id is null then
    raise exception 'company not found or inactive';
  end if;

  select id into v_role_id
  from public.roles
  where code = p_role_code
    and company_id is null
  limit 1;

  if v_role_id is null then
    raise exception 'role % not found', p_role_code;
  end if;

  insert into public.users (id, full_name, email)
  values (
    auth.uid(),
    coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()), ''),
    coalesce((select email from auth.users where id = auth.uid()), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = case when excluded.full_name = '' then users.full_name else excluded.full_name end,
      updated_at = now();

  insert into public.user_company_memberships (user_id, company_id, role_id, status, is_default_company)
  values (auth.uid(), v_company_id, v_role_id, 'active', false)
  on conflict (user_id, company_id) do update
  set role_id = excluded.role_id,
      status = 'active',
      updated_at = now();

  return v_company_id;
end;
$$;

create or replace function public.set_default_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  if not exists (
    select 1
    from public.user_company_memberships
    where user_id = auth.uid()
      and company_id = p_company_id
      and status = 'active'
  ) then
    raise exception 'membership for company % not found', p_company_id;
  end if;

  update public.user_company_memberships
  set is_default_company = false,
      updated_at = now()
  where user_id = auth.uid();

  update public.user_company_memberships
  set is_default_company = true,
      updated_at = now()
  where user_id = auth.uid()
    and company_id = p_company_id;
end;
$$;

grant execute on function public.create_company_with_owner(text, text) to authenticated;
grant execute on function public.join_company(text, text) to authenticated;
grant execute on function public.set_default_company(uuid) to authenticated;

commit;
