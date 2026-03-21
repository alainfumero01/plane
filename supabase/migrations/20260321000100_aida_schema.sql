begin;

create extension if not exists pgcrypto;

-- Identity / tenancy
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  billing_tier text not null default 'starter',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  scope text not null default 'company',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(resource, action, scope)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role_id, permission_id)
);

create table if not exists public.user_company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active',
  is_default_company boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, company_id)
);

-- Operations
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  status text not null default 'planning',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  site_code text not null,
  status text not null default 'planned',
  planned_start date,
  planned_end date,
  location jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, site_code)
);

create table if not exists public.turbines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  turbine_code text not null,
  model text,
  manufacturer text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, site_id, turbine_code)
);

create table if not exists public.blades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  turbine_id uuid not null references public.turbines(id) on delete cascade,
  blade_position text not null,
  serial_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_role text not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, site_id, user_id, assignment_role)
);

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  employee_code text,
  certifications jsonb not null default '[]'::jsonb,
  skill_level text,
  employment_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, user_id)
);

-- Execution
create table if not exists public.repair_methodologies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  title text not null,
  version text not null default '1.0',
  procedure_markdown text not null default '',
  safety_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code, version)
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  turbine_id uuid references public.turbines(id) on delete set null,
  blade_id uuid references public.blades(id) on delete set null,
  methodology_id uuid references public.repair_methodologies(id) on delete set null,
  wo_number text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  damage_summary text not null default '',
  target_completion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, wo_number)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  assignee_user_id uuid references public.users(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  sequence_no integer not null default 1,
  planned_hours numeric(8,2) not null default 0,
  actual_hours numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  category text not null,
  severity text not null default 'medium',
  reason text not null default '',
  start_at timestamptz not null default now(),
  resolved_at timestamptz,
  impact_hours numeric(10,2) not null default 0,
  impact_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  budgeted_hours numeric(10,2) not null default 0,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, project_id, user_id, period_start, period_end)
);

create table if not exists public.site_daily_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  cost_date date not null,
  labor_cost numeric(14,2) not null default 0,
  material_cost numeric(14,2) not null default 0,
  vehicle_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, site_id, cost_date)
);

create table if not exists public.project_profit_projections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  as_of_date date not null,
  projected_revenue numeric(14,2) not null default 0,
  projected_cost numeric(14,2) not null default 0,
  projected_profit numeric(14,2) generated always as (projected_revenue - projected_cost) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, project_id, as_of_date)
);

create table if not exists public.repair_scope_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  turbine_id uuid references public.turbines(id) on delete set null,
  blade_id uuid references public.blades(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  scope_type text not null,
  severity text not null default 'medium',
  status text not null default 'planned',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory / logistics
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sku text not null,
  name text not null,
  uom text not null,
  unit_cost numeric(12,2) not null default 0,
  is_hazardous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, sku)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  location jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  qty_on_hand numeric(14,3) not null default 0,
  qty_reserved numeric(14,3) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, warehouse_id, material_id)
);

create table if not exists public.site_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  qty_on_hand numeric(14,3) not null default 0,
  qty_allocated numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, site_id, material_id)
);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_site_id uuid references public.sites(id) on delete set null,
  quantity numeric(14,3) not null,
  status text not null default 'requested',
  requested_by uuid references public.users(id) on delete set null,
  dispatched_at timestamptz,
  received_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  quantity_used numeric(14,3) not null,
  used_at timestamptz not null default now(),
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plate_no text not null,
  type text not null,
  capacity text,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, plate_no)
);

create table if not exists public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  driver_user_id uuid references public.users(id) on delete set null,
  dispatch_at timestamptz not null default now(),
  return_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documentation / QA
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  turbine_id uuid references public.turbines(id) on delete set null,
  blade_id uuid references public.blades(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  inspection_type text not null,
  status text not null default 'pending',
  inspector_user_id uuid references public.users(id) on delete set null,
  inspected_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  turbine_id uuid references public.turbines(id) on delete set null,
  blade_id uuid references public.blades(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  uploaded_by uuid references public.users(id) on delete set null,
  storage_bucket text not null default 'aida-evidence',
  storage_path text not null,
  mime_type text not null,
  captured_at timestamptz not null default now(),
  ai_tags text[] not null default '{}',
  ai_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);

create table if not exists public.inspection_images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  sequence_no integer not null default 1,
  caption text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inspection_id, evidence_item_id)
);

create table if not exists public.engineer_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  engineer_user_id uuid references public.users(id) on delete set null,
  review_status text not null default 'pending',
  review_notes text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  review_id uuid references public.engineer_reviews(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approval_type text not null,
  status text not null default 'pending',
  comments text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Communications
create table if not exists public.communication_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  thread_type text not null default 'operator_engineer',
  status text not null default 'open',
  opened_by uuid references public.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  thread_id uuid not null references public.communication_threads(id) on delete cascade,
  asked_by uuid references public.users(id) on delete set null,
  related_evidence_id uuid references public.evidence_items(id) on delete set null,
  question_text text not null,
  priority text not null default 'medium',
  asked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engineer_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  question_id uuid not null references public.operator_questions(id) on delete cascade,
  responded_by uuid references public.users(id) on delete set null,
  response_text text not null,
  recommendation_code text,
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_message_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  thread_id uuid not null references public.communication_threads(id) on delete cascade,
  provider text not null,
  external_chat_id text not null,
  external_message_id text not null,
  direction text not null,
  payload_json jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_chat_id, external_message_id)
);

-- Reporting
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  version text not null default '1.0',
  schema_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name, version)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  template_id uuid references public.report_templates(id) on delete set null,
  generated_by uuid references public.users(id) on delete set null,
  report_type text not null default 'project_completion',
  status text not null default 'draft',
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  export_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  section_key text not null,
  title text not null,
  prefill_json jsonb not null default '{}'::jsonb,
  final_text text not null default '',
  order_no integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id, section_key)
);

create table if not exists public.report_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  report_section_id uuid references public.report_sections(id) on delete set null,
  item_type text not null,
  source_entity text,
  source_id uuid,
  display_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

commit;
