import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type MembershipRecord = {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  is_default_company: boolean;
  joined_at: string;
};

type UserRecord = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type RoleRecord = {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
};

type SiteAssignmentRecord = {
  user_id: string;
  site_id: string;
  is_active: boolean;
};

export default function UsersRolesPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [usersById, setUsersById] = useState<Record<string, UserRecord>>({});
  const [rolesById, setRolesById] = useState<Record<string, RoleRecord>>({});
  const [siteAssignments, setSiteAssignments] = useState<SiteAssignmentRecord[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [membershipRes, assignmentRes] = await Promise.all([
        supabase
          .from("user_company_memberships")
          .select("id,user_id,role_id,status,is_default_company,joined_at")
          .eq("company_id", activeCompanyId)
          .order("joined_at", { ascending: false }),
        supabase.from("site_assignments").select("user_id,site_id,is_active").eq("company_id", activeCompanyId),
      ]);

      const firstError = [membershipRes.error, assignmentRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextMemberships = (membershipRes.data ?? []) as MembershipRecord[];
      setMemberships(nextMemberships);
      setSiteAssignments((assignmentRes.data ?? []) as SiteAssignmentRecord[]);

      const userIds = Array.from(new Set(nextMemberships.map((row) => row.user_id)));
      const roleIds = Array.from(new Set(nextMemberships.map((row) => row.role_id)));

      const [usersRes, rolesRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("users").select("id,full_name,email,status").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        roleIds.length > 0
          ? supabase
              .from("roles")
              .select("id,code,name,is_system")
              .or(`company_id.eq.${activeCompanyId},is_system.eq.true`)
              .in("id", roleIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [usersRes.error, rolesRes.error].find(Boolean);
      if (mapError) {
        setError(mapError.message);
        setLoading(false);
        return;
      }

      const userMap: Record<string, UserRecord> = {};
      for (const row of (usersRes.data ?? []) as UserRecord[]) userMap[row.id] = row;
      setUsersById(userMap);

      const roleMap: Record<string, RoleRecord> = {};
      for (const row of (rolesRes.data ?? []) as RoleRecord[]) roleMap[row.id] = row;
      setRolesById(roleMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const activeMembers = memberships.filter((row) => row.status === "active").length;
  const pendingMembers = memberships.filter((row) => row.status !== "active").length;
  const customRoles = Object.values(rolesById).filter((row) => !row.is_system).length;

  const assignmentCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of siteAssignments) {
      if (!row.is_active) continue;
      map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1);
    }
    return map;
  }, [siteAssignments]);

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="User and Role Management"
        description="Company governance for memberships, role assignment, and site-level access boundaries."
        highlights={[
          { label: "Active Members", value: formatNumber(activeMembers) },
          { label: "Pending/Inactive", value: formatNumber(pendingMembers) },
          { label: "Custom Roles", value: formatNumber(customRoles) },
          { label: "Site Assignments", value: formatNumber(siteAssignments.filter((row) => row.is_active).length) },
        ]}
        panels={[
          {
            title: "Role Matrix",
            items: [
              `${formatNumber(Object.keys(rolesById).length)} role definitions in use`,
              "Memberships bind users to company-specific permissions",
              "Site assignments overlay operational scope",
            ],
          },
          {
            title: "Access Boundaries",
            items: [
              "Company-level isolation is enforced through tenant membership",
              "Operators can be restricted to assigned sites",
              "Membership and assignment changes remain auditable",
            ],
          },
        ]}
        actions={["Invite or deactivate member", "Change membership role", "Manage site assignments"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Memberships</h3>
          <p>{loading ? "Refreshing..." : `${memberships.length} membership(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Default Company</th>
                <th>Active Site Assignments</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((row) => (
                <tr key={row.id}>
                  <td>
                    {usersById[row.user_id]?.full_name || usersById[row.user_id]?.email || row.user_id}
                    <div className="muted">{usersById[row.user_id]?.email ?? ""}</div>
                  </td>
                  <td>{rolesById[row.role_id]?.name ?? rolesById[row.role_id]?.code ?? row.role_id}</td>
                  <td>
                    <span className="chip">{row.status}</span>
                  </td>
                  <td>{row.is_default_company ? "Yes" : "No"}</td>
                  <td>{formatNumber(assignmentCountByUser.get(row.user_id) ?? 0)}</td>
                  <td>{formatDate(row.joined_at)}</td>
                </tr>
              ))}
              {!loading && memberships.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No memberships found for this company.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="message message--error">{error}</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
