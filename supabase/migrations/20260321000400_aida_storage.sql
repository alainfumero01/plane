begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aida-evidence',
  'aida-evidence',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_company_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);

  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;

  return null;
end;
$$;

-- Path convention: {company_id}/{site_id}/{work_order_id}/{filename}

drop policy if exists aida_evidence_select on storage.objects;
create policy aida_evidence_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'aida-evidence'
  and public.storage_company_id(name) is not null
  and public.is_active_company_member(public.storage_company_id(name))
);

drop policy if exists aida_evidence_insert on storage.objects;
create policy aida_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'aida-evidence'
  and public.storage_company_id(name) is not null
  and public.user_has_role(
    public.storage_company_id(name),
    array['business_owner_admin', 'project_manager', 'site_operator', 'offshore_engineer']
  )
);

drop policy if exists aida_evidence_update on storage.objects;
create policy aida_evidence_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'aida-evidence'
  and public.storage_company_id(name) is not null
  and public.user_has_role(
    public.storage_company_id(name),
    array['business_owner_admin', 'project_manager', 'offshore_engineer']
  )
)
with check (
  bucket_id = 'aida-evidence'
  and public.storage_company_id(name) is not null
  and public.user_has_role(
    public.storage_company_id(name),
    array['business_owner_admin', 'project_manager', 'offshore_engineer']
  )
);

drop policy if exists aida_evidence_delete on storage.objects;
create policy aida_evidence_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'aida-evidence'
  and public.storage_company_id(name) is not null
  and public.user_has_role(
    public.storage_company_id(name),
    array['business_owner_admin', 'project_manager']
  )
);

commit;
