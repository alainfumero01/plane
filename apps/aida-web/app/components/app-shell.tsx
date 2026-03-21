import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { canAccessPath, roleLabels, type RoleCode } from "@/app/lib/roles";
import { useAuth } from "@/app/lib/auth-context";
import { supabase } from "@/app/lib/supabase";

type NavItem = {
  label: string;
  path: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Sites", path: "/sites" },
  { label: "Inventory", path: "/inventory" },
  { label: "Warehouse", path: "/warehouse" },
  { label: "Vehicles", path: "/vehicles" },
  { label: "Delay Log", path: "/delays" },
  { label: "Engineer Review", path: "/engineer-review" },
  { label: "Reports", path: "/reports" },
  { label: "User & Roles", path: "/admin/users-roles" },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { user, roles, rolePreview, setRolePreview, signOut, activeCompanyId } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);

  const visibleNavItems = navItems.filter((item) => canAccessPath(item.path, roles));

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setCompanyName(null);
        return;
      }

      const { data, error } = await supabase
        .from("companies")
        .select("name")
        .eq("id", activeCompanyId)
        .maybeSingle<{ name: string }>();

      if (error || !data) {
        setCompanyName(null);
        return;
      }

      setCompanyName(data.name);
    };

    void run();
  }, [activeCompanyId]);

  return (
    <div className="aida-shell">
      <aside className="aida-sidebar">
        <div className="aida-brand">
          <p className="aida-brand__eyebrow">AIDA Platform</p>
          <h1>AIDA</h1>
          <p>AI Wind Blade Management Platform</p>
        </div>

        <nav className="aida-nav">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={pathname.startsWith(item.path) ? "aida-nav__item is-active" : "aida-nav__item"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="aida-company">
          <p>Company</p>
          <strong>{companyName ?? activeCompanyId ?? "No active company"}</strong>
        </div>
      </aside>

      <main className="aida-main">
        <header className="aida-topbar">
          <div>
            <p className="aida-topbar__kicker">Signed in as</p>
            <strong>{user?.email ?? "Guest"}</strong>
          </div>

          <div className="aida-topbar__controls">
            <label>
              Role Preview
              <select
                value={rolePreview ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) setRolePreview(null);
                  else if (value in roleLabels) setRolePreview(value as RoleCode);
                }}
              >
                <option value="">Live Role</option>
                {Object.entries(roleLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={() => void signOut()}>
              Sign Out
            </button>
          </div>
        </header>

        <section className="aida-content">{children}</section>
      </main>
    </div>
  );
};
