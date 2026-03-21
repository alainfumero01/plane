import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type VehicleRecord = {
  id: string;
  plate_no: string;
  type: string;
  capacity: string | null;
  status: string;
};

type AssignmentRecord = {
  id: string;
  vehicle_id: string;
  project_id: string | null;
  site_id: string | null;
  driver_user_id: string | null;
  dispatch_at: string;
  return_at: string | null;
};

type SiteRecord = { id: string; site_code: string; name: string };
type ProjectRecord = { id: string; code: string; name: string };
type UserRecord = { id: string; full_name: string; email: string };

export default function VehiclesPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [projectsById, setProjectsById] = useState<Record<string, ProjectRecord>>({});
  const [usersById, setUsersById] = useState<Record<string, UserRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [vehiclesRes, assignmentsRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id,plate_no,type,capacity,status")
          .eq("company_id", activeCompanyId)
          .order("plate_no", { ascending: true }),
        supabase
          .from("vehicle_assignments")
          .select("id,vehicle_id,project_id,site_id,driver_user_id,dispatch_at,return_at")
          .eq("company_id", activeCompanyId)
          .order("dispatch_at", { ascending: false })
          .limit(150),
      ]);

      const firstError = [vehiclesRes.error, assignmentsRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextVehicles = (vehiclesRes.data ?? []) as VehicleRecord[];
      const nextAssignments = (assignmentsRes.data ?? []) as AssignmentRecord[];
      setVehicles(nextVehicles);
      setAssignments(nextAssignments);

      const siteIds = Array.from(
        new Set(nextAssignments.map((row) => row.site_id).filter((value): value is string => Boolean(value)))
      );
      const projectIds = Array.from(
        new Set(nextAssignments.map((row) => row.project_id).filter((value): value is string => Boolean(value)))
      );
      const userIds = Array.from(
        new Set(nextAssignments.map((row) => row.driver_user_id).filter((value): value is string => Boolean(value)))
      );

      const [sitesRes, projectsRes, usersRes] = await Promise.all([
        siteIds.length > 0
          ? supabase.from("sites").select("id,site_code,name").eq("company_id", activeCompanyId).in("id", siteIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length > 0
          ? supabase.from("projects").select("id,code,name").eq("company_id", activeCompanyId).in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0
          ? supabase.from("users").select("id,full_name,email").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [sitesRes.error, projectsRes.error, usersRes.error].find(Boolean);
      if (mapError) {
        setError(mapError.message);
        setLoading(false);
        return;
      }

      const siteMap: Record<string, SiteRecord> = {};
      for (const row of (sitesRes.data ?? []) as SiteRecord[]) siteMap[row.id] = row;
      setSitesById(siteMap);

      const projectMap: Record<string, ProjectRecord> = {};
      for (const row of (projectsRes.data ?? []) as ProjectRecord[]) projectMap[row.id] = row;
      setProjectsById(projectMap);

      const userMap: Record<string, UserRecord> = {};
      for (const row of (usersRes.data ?? []) as UserRecord[]) userMap[row.id] = row;
      setUsersById(userMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

  const activeAssignments = assignments.filter((row) => !row.return_at);
  const inMaintenance = vehicles.filter((row) => row.status === "maintenance").length;
  const vehiclesById = useMemo(() => {
    const map: Record<string, VehicleRecord> = {};
    for (const row of vehicles) map[row.id] = row;
    return map;
  }, [vehicles]);

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Vehicles"
        description="Fleet tracking for dispatch, return, and assignment history in project/site context."
        highlights={[
          { label: "Vehicles Registered", value: formatNumber(vehicles.length) },
          { label: "Currently Deployed", value: formatNumber(activeAssignments.length) },
          { label: "In Maintenance", value: formatNumber(inMaintenance) },
          {
            label: "Driver Assignments",
            value: formatNumber(assignments.filter((row) => row.driver_user_id !== null).length),
          },
        ]}
        panels={[
          {
            title: "Current Site Deployments",
            items: [
              `${formatNumber(activeAssignments.length)} assignment(s) currently open`,
              `${formatNumber(vehicles.filter((row) => row.status === "available").length)} vehicles marked available`,
              `${formatNumber(vehicles.filter((row) => row.status === "deployed").length)} vehicles marked deployed`,
            ],
          },
          {
            title: "Dispatch Integrity",
            items: [
              "Outbound and return timestamps are tracked per assignment",
              "Driver linkage is preserved where assigned",
              "Every dispatch remains tied to site/project context",
            ],
          },
        ]}
        actions={["Assign vehicle to site", "Record vehicle return", "Review assignment history"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Vehicle Registry</h3>
          <p>{loading ? "Refreshing..." : `${vehicles.length} vehicle(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((row) => (
                <tr key={row.id}>
                  <td>{row.plate_no}</td>
                  <td>{row.type}</td>
                  <td>{row.capacity ?? "-"}</td>
                  <td>
                    <span className="chip">{row.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
              {!loading && vehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No vehicles registered.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Assignment Timeline</h3>
          <p>{`${assignments.length} assignment(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Site</th>
                <th>Project</th>
                <th>Driver</th>
                <th>Dispatch</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr key={row.id}>
                  <td>{vehiclesById[row.vehicle_id]?.plate_no ?? row.vehicle_id}</td>
                  <td>{row.site_id ? (sitesById[row.site_id]?.site_code ?? row.site_id) : "-"}</td>
                  <td>{row.project_id ? (projectsById[row.project_id]?.code ?? row.project_id) : "-"}</td>
                  <td>
                    {row.driver_user_id
                      ? usersById[row.driver_user_id]?.full_name ||
                        usersById[row.driver_user_id]?.email ||
                        row.driver_user_id
                      : "-"}
                  </td>
                  <td>{formatDate(row.dispatch_at)}</td>
                  <td>{row.return_at ? formatDate(row.return_at) : "Open"}</td>
                </tr>
              ))}
              {!loading && assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No vehicle assignments found.
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
