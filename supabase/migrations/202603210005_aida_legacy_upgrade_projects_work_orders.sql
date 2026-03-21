begin;

-- Create a fallback company to safely backfill legacy rows.
insert into public.companies (id, name, slug, status, billing_tier, timezone)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'WindTrack Legacy',
  'windtrack-legacy',
  'active',
  'starter',
  'UTC'
)
on conflict (id) do nothing;

-- Upgrade legacy projects table to AIDA shape.
alter table public.projects
  add column if not exists company_id uuid,
  add column if not exists code text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists updated_at timestamptz not null default now();

update public.projects
set company_id = '00000000-0000-0000-0000-000000000001'::uuid
where company_id is null;

update public.projects
set code = coalesce(nullif(code, ''), 'PRJ-' || substr(id::text, 1, 8))
where code is null or code = '';

alter table public.projects
  alter column company_id set not null,
  alter column code set not null,
  alter column status set default 'planning';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_company_id_fkey_aida'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_company_id_fkey_aida
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists projects_company_code_uidx
  on public.projects(company_id, code);

-- Upgrade legacy work_orders table to AIDA shape.
alter table public.work_orders
  add column if not exists company_id uuid,
  add column if not exists site_id uuid,
  add column if not exists turbine_id uuid,
  add column if not exists blade_id uuid,
  add column if not exists methodology_id uuid,
  add column if not exists wo_number text,
  add column if not exists priority text not null default 'medium',
  add column if not exists damage_summary text not null default '',
  add column if not exists target_completion timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.work_orders w
set company_id = p.company_id
from public.projects p
where w.project_id = p.id
  and w.company_id is null;

update public.work_orders
set company_id = '00000000-0000-0000-0000-000000000001'::uuid
where company_id is null;

update public.work_orders
set wo_number = coalesce(nullif(wo_number, ''), 'WO-' || substr(id::text, 1, 8))
where wo_number is null or wo_number = '';

-- Ensure each project has at least one site for site-scoped work orders.
insert into public.sites (
  id,
  company_id,
  project_id,
  name,
  site_code,
  status,
  planned_start,
  planned_end,
  location
)
select
  gen_random_uuid(),
  p.company_id,
  p.id,
  p.name || ' Default Site',
  'LEG-' || substr(p.id::text, 1, 8),
  'planned',
  null,
  null,
  '{}'::jsonb
from public.projects p
where not exists (
  select 1
  from public.sites s
  where s.project_id = p.id
    and s.company_id = p.company_id
);

with first_project_sites as (
  select distinct on (s.project_id, s.company_id)
    s.project_id,
    s.company_id,
    s.id
  from public.sites s
  order by s.project_id, s.company_id, s.created_at asc
)
update public.work_orders w
set site_id = fps.id
from first_project_sites fps
where w.site_id is null
  and w.project_id = fps.project_id
  and w.company_id = fps.company_id;

alter table public.work_orders
  alter column company_id set not null,
  alter column site_id set not null,
  alter column wo_number set not null,
  alter column status set default 'open';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_orders_company_id_fkey_aida'
      and conrelid = 'public.work_orders'::regclass
  ) then
    alter table public.work_orders
      add constraint work_orders_company_id_fkey_aida
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_orders_site_id_fkey_aida'
      and conrelid = 'public.work_orders'::regclass
  ) then
    alter table public.work_orders
      add constraint work_orders_site_id_fkey_aida
      foreign key (site_id) references public.sites(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_orders_turbine_id_fkey_aida'
      and conrelid = 'public.work_orders'::regclass
  ) then
    alter table public.work_orders
      add constraint work_orders_turbine_id_fkey_aida
      foreign key (turbine_id) references public.turbines(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_orders_blade_id_fkey_aida'
      and conrelid = 'public.work_orders'::regclass
  ) then
    alter table public.work_orders
      add constraint work_orders_blade_id_fkey_aida
      foreign key (blade_id) references public.blades(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_orders_methodology_id_fkey_aida'
      and conrelid = 'public.work_orders'::regclass
  ) then
    alter table public.work_orders
      add constraint work_orders_methodology_id_fkey_aida
      foreign key (methodology_id) references public.repair_methodologies(id) on delete set null;
  end if;
end;
$$;

create unique index if not exists work_orders_company_wo_uidx
  on public.work_orders(company_id, wo_number);

-- Ensure policies exist now that company_id/site_id are present.
drop policy if exists projects_company_read on public.projects;
create policy projects_company_read
on public.projects
for select
to authenticated
using (public.is_active_company_member(company_id));

drop policy if exists projects_pm_write on public.projects;
create policy projects_pm_write
on public.projects
for all
to authenticated
using (public.can_write_company_data(company_id))
with check (public.can_write_company_data(company_id));

drop policy if exists work_orders_company_read on public.work_orders;
create policy work_orders_company_read
on public.work_orders
for select
to authenticated
using (public.can_read_site_data(company_id, site_id));

drop policy if exists work_orders_pm_write on public.work_orders;
create policy work_orders_pm_write
on public.work_orders
for all
to authenticated
using (public.can_write_site_data(company_id, site_id))
with check (public.can_write_site_data(company_id, site_id));

commit;
