export type RoleCode =
  | "business_owner_admin"
  | "warehouse"
  | "project_manager"
  | "site_operator"
  | "offshore_engineer";

export const roleLabels: Record<RoleCode, string> = {
  business_owner_admin: "Business Owner / Admin",
  warehouse: "Warehouse",
  project_manager: "Project Manager",
  site_operator: "Site Operator",
  offshore_engineer: "Off-Shore Engineer",
};

type AccessRule = {
  routePrefix: string;
  allowedRoles: RoleCode[];
};

const accessRules: AccessRule[] = [
  { routePrefix: "/warehouse", allowedRoles: ["business_owner_admin", "warehouse"] },
  { routePrefix: "/inventory", allowedRoles: ["business_owner_admin", "warehouse", "project_manager"] },
  { routePrefix: "/vehicles", allowedRoles: ["business_owner_admin", "warehouse", "project_manager"] },
  {
    routePrefix: "/engineer-review",
    allowedRoles: ["business_owner_admin", "project_manager", "offshore_engineer"],
  },
  { routePrefix: "/reports", allowedRoles: ["business_owner_admin", "project_manager", "offshore_engineer"] },
  { routePrefix: "/admin/users-roles", allowedRoles: ["business_owner_admin"] },
];

export const canAccessPath = (path: string, roles: RoleCode[]) => {
  const matchedRule = accessRules.find((rule) => path.startsWith(rule.routePrefix));

  if (!matchedRule) return true;
  return roles.some((role) => matchedRule.allowedRoles.includes(role));
};

export const dedupeRoles = (roles: string[]): RoleCode[] => {
  const known = new Set<RoleCode>();

  for (const role of roles) {
    if (
      role === "business_owner_admin" ||
      role === "warehouse" ||
      role === "project_manager" ||
      role === "site_operator" ||
      role === "offshore_engineer"
    ) {
      known.add(role);
    }
  }

  return [...known];
};
