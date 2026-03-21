# AIDA API Contract (Browser + Future Mobile)

## Auth
- Supabase Auth JWT session.
- Browser uses anon key and row-level policies.
- Edge functions validate Authorization bearer token.

## Core entity endpoints (PostgREST)
- `/rest/v1/companies`
- `/rest/v1/user_company_memberships`
- `/rest/v1/projects`
- `/rest/v1/sites`
- `/rest/v1/turbines`
- `/rest/v1/blades`
- `/rest/v1/work_orders`
- `/rest/v1/tasks`
- `/rest/v1/delays`
- `/rest/v1/evidence_items`
- `/rest/v1/engineer_reviews`
- `/rest/v1/reports`

All list/read calls must include company scoping in filters; RLS enforces final guardrails.

## RPC
- `rpc/create_company_with_owner`
- `rpc/join_company`
- `rpc/set_default_company`

## Edge functions
- `functions/v1/ai-risk-assistant`
  - POST body: `companyId`, optional `projectId`, `siteId`
- `functions/v1/report-draft`
  - POST body: `companyId`, `reportId`, optional `persist`
- `functions/v1/ingest-external-message`
  - POST body: external thread/message payload for future WhatsApp mapping

## Mobile readiness defaults
- UUID keys for all major entities.
- Deterministic timestamps (`created_at`, `updated_at`) for sync cursors.
- Idempotent upsert pattern for external messages.
- Company and site scoping constraints already codified in policy functions.
