import type { RouteConfig } from "@react-router/dev/routes";
import { index, layout, route } from "@react-router/dev/routes";

export default [
  index("./page.tsx"),
  route("login", "./login/page.tsx"),
  route("sign-up", "./sign-up/page.tsx"),
  layout("./protected/layout.tsx", [
    route("onboarding", "./protected/onboarding/page.tsx"),
    route("dashboard", "./protected/dashboard/page.tsx"),
    route("sites", "./protected/sites/page.tsx"),
    route("sites/:siteId", "./protected/sites/[siteId]/page.tsx"),
    route("projects/:projectId", "./protected/projects/[projectId]/page.tsx"),
    route("turbines/:turbineId/blades/:bladeId", "./protected/turbines/[turbineId]/blades/[bladeId]/page.tsx"),
    route("work-orders/:workOrderId", "./protected/work-orders/[workOrderId]/page.tsx"),
    route("inventory", "./protected/inventory/page.tsx"),
    route("warehouse", "./protected/warehouse/page.tsx"),
    route("vehicles", "./protected/vehicles/page.tsx"),
    route("delays", "./protected/delays/page.tsx"),
    route("engineer-review", "./protected/engineer-review/page.tsx"),
    route("reports", "./protected/reports/page.tsx"),
    route("admin/users-roles", "./protected/admin/users-roles/page.tsx"),
  ]),
  route("*", "./not-found.tsx"),
] satisfies RouteConfig;
