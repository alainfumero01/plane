# AIDA Implementation Baseline

## What is implemented
- Supabase schema migration for AIDA core entities.
- Supabase security migration with helper functions, RLS policies, and auth-profile trigger.
- Supabase seed migration for system roles, permissions, and onboarding RPCs.
- Edge function scaffolds for risk analysis, report drafting, and external message ingestion.
- Browser MVP scaffold app (`apps/aida-web`) with role-aware navigation and required initial screen routes.

## Text architecture diagram

```text
[aida-web (React Router)]
  -> [Supabase Auth]
  -> [PostgREST + RPC]
  -> [Postgres (company-scoped schema + RLS)]
  -> [Supabase Storage (evidence)]
  -> [Edge Functions: ai-risk-assistant, report-draft, ingest-external-message]
```

## Multi-tenant strategy implemented
- `company_id` on tenant-owned operational tables.
- `user_company_memberships` as role pivot.
- RLS helper functions for membership, role checks, and site assignment checks.
- Site-operator restrictions over site-linked rows.

## Onboarding RPCs
- `create_company_with_owner(company_name, company_slug)`
- `join_company(company_slug, role_code)`
- `set_default_company(company_id)`

## Security note
- Any service-role key previously shared should be rotated immediately.
