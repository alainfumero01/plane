# AIDA Supabase Setup

This folder contains the AIDA Supabase baseline for the browser MVP.

## Migrations
1. `20260321000100_aida_schema.sql` creates core tenant + operations schema.
2. `20260321000200_aida_security_and_rls.sql` applies helper functions, auth trigger, and RLS policies.
3. `20260321000300_aida_seed_roles_permissions.sql` seeds system roles/permissions and onboarding RPCs.

## Local workflow
1. Install Supabase CLI.
2. Run `supabase start`.
3. Run `supabase db reset` (or `supabase migration up`).
4. Run `supabase functions serve` for local edge function testing.

## Required environment variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (edge functions only)

## Security notes
- Never commit service-role keys.
- Rotate any service-role key that was shared in chat or issue history.
- Keep `company_id` in every tenant-owned write payload and validate server-side.

## Edge function stubs
- `ai-risk-assistant`
- `report-draft`
- `ingest-external-message`

These are scaffolds intended for Phase 1/2 integration and should be expanded with production-grade validation, rate limiting, and observability.
