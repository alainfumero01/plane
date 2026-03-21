# AIDA Web MVP

Browser-first MVP shell for AIDA (AI Wind Blade Management Platform).

## Local run
1. Copy `.env.example` to `.env`.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `pnpm --filter aida-web dev`.

## Current scope
- Landing, Login, Sign Up
- Protected app shell with role-aware navigation
- MVP operational screens (dashboard/sites/work-orders/inventory/warehouse/vehicles/delays/engineer/reports/admin)
- Supabase auth context + membership/role loading

## Notes
- Role preview control is included for rapid UX validation.
- Data grids/charts are placeholders pending API wiring by module.
