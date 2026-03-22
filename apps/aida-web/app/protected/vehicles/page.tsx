import { useCallback, useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
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

type SiteAssignmentRecord = { user_id: string | null };

export default function VehiclesPage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [drivers, setDrivers] = useState<UserRecord[]>([]);

  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [projectsById, setProjectsById] = useState<Record<string, ProjectRecord>>({});
  const [usersById, setUsersById] = useState<Record<string, UserRecord>>({});

  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleType, setVehicleType] = useState("truck");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("available");
  const [vehicleBusy, setVehicleBusy] = useState(false);

  const [assignmentVehicleId, setAssignmentVehicleId] = useState("");
  const [assignmentProjectId, setAssignmentProjectId] = useState("");
  const [assignmentSiteId, setAssignmentSiteId] = useState("");
  const [assignmentDriverId, setAssignmentDriverId] = useState("");
  const [assignmentDispatchAt, setAssignmentDispatchAt] = useState("");
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [returnBusyId, setReturnBusyId] = useState<string | null>(null);

  const canManageVehicles = useMemo(
    () =>
      roles.some(
        (role: RoleCode) => role === "business_owner_admin" || role === "warehouse" || role === "project_manager"
      ),
    [roles]
  );

  const loadData = useCallback(async () => {
    if (!supabase || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [vehiclesRes, assignmentsRes, sitesRes, projectsRes, siteAssignmentsRes] = await Promise.all([
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
      supabase
        .from("sites")
        .select("id,site_code,name")
        .eq("company_id", activeCompanyId)
        .order("site_code", { ascending: true }),
      supabase
        .from("projects")
        .select("id,code,name")
        .eq("company_id", activeCompanyId)
        .order("code", { ascending: true }),
      supabase
        .from("site_assignments")
        .select("user_id")
        .eq("company_id", activeCompanyId)
        .eq("is_active", true)
        .limit(300),
    ]);

    const firstError = [
      vehiclesRes.error,
      assignmentsRes.error,
      sitesRes.error,
      projectsRes.error,
      siteAssignmentsRes.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextVehicles = (vehiclesRes.data ?? []) as VehicleRecord[];
    const nextAssignments = (assignmentsRes.data ?? []) as AssignmentRecord[];
    const nextSites = (sitesRes.data ?? []) as SiteRecord[];
    const nextProjects = (projectsRes.data ?? []) as ProjectRecord[];
    const nextSiteAssignments = (siteAssignmentsRes.data ?? []) as SiteAssignmentRecord[];

    setVehicles(nextVehicles);
    setAssignments(nextAssignments);
    setSites(nextSites);
    setProjects(nextProjects);

    const siteMap: Record<string, SiteRecord> = {};
    for (const row of nextSites) siteMap[row.id] = row;
    setSitesById(siteMap);

    const projectMap: Record<string, ProjectRecord> = {};
    for (const row of nextProjects) projectMap[row.id] = row;
    setProjectsById(projectMap);

    const driverIds = new Set<string>();
    for (const row of nextAssignments) {
      if (row.driver_user_id) driverIds.add(row.driver_user_id);
    }
    for (const row of nextSiteAssignments) {
      if (row.user_id) driverIds.add(row.user_id);
    }

    let userMap: Record<string, UserRecord> = {};
    let userRows: UserRecord[] = [];

    if (driverIds.size > 0) {
      const usersRes = await supabase.from("users").select("id,full_name,email").in("id", Array.from(driverIds));

      if (usersRes.error) {
        setError(usersRes.error.message);
        setLoading(false);
        return;
      }

      userRows = (usersRes.data ?? []) as UserRecord[];
      for (const row of userRows) userMap[row.id] = row;
    }

    setDrivers(userRows);
    setUsersById(userMap);

    if (!assignmentVehicleId && nextVehicles[0]) setAssignmentVehicleId(nextVehicles[0].id);
    if (!assignmentSiteId && nextSites[0]) setAssignmentSiteId(nextSites[0].id);

    setLoading(false);
  }, [activeCompanyId, assignmentSiteId, assignmentVehicleId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeAssignments = assignments.filter((row) => !row.return_at);
  const inMaintenance = vehicles.filter((row) => row.status === "maintenance").length;
  const vehiclesById = useMemo(() => {
    const map: Record<string, VehicleRecord> = {};
    for (const row of vehicles) map[row.id] = row;
    return map;
  }, [vehicles]);

  const handleCreateVehicle = async () => {
    if (!supabase || !activeCompanyId) return;

    setVehicleBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      company_id: activeCompanyId,
      plate_no: vehiclePlate.trim().toUpperCase(),
      type: vehicleType,
      capacity: vehicleCapacity.trim() || null,
      status: vehicleStatus,
    };

    const { error: insertError } = await supabase.from("vehicles").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setVehicleBusy(false);
      return;
    }

    setVehiclePlate("");
    setVehicleType("truck");
    setVehicleCapacity("");
    setVehicleStatus("available");
    setSuccess(`Vehicle ${payload.plate_no} created.`);
    await loadData();
    setVehicleBusy(false);
  };

  const handleCreateAssignment = async () => {
    if (!supabase || !activeCompanyId || !assignmentVehicleId) return;

    setAssignmentBusy(true);
    setError(null);
    setSuccess(null);

    const dispatchAt = assignmentDispatchAt ? new Date(assignmentDispatchAt).toISOString() : new Date().toISOString();
    const payload = {
      company_id: activeCompanyId,
      vehicle_id: assignmentVehicleId,
      project_id: assignmentProjectId || null,
      site_id: assignmentSiteId || null,
      driver_user_id: assignmentDriverId || null,
      dispatch_at: dispatchAt,
      notes: "",
    };

    const { error: insertError } = await supabase.from("vehicle_assignments").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setAssignmentBusy(false);
      return;
    }

    const { error: updateVehicleError } = await supabase
      .from("vehicles")
      .update({ status: "deployed" })
      .eq("company_id", activeCompanyId)
      .eq("id", assignmentVehicleId);

    if (updateVehicleError) {
      setError(updateVehicleError.message);
      setAssignmentBusy(false);
      return;
    }

    setAssignmentDispatchAt("");
    setSuccess("Vehicle assignment created.");
    await loadData();
    setAssignmentBusy(false);
  };

  const handleMarkReturned = async (assignment: AssignmentRecord) => {
    if (!supabase || !activeCompanyId) return;

    setReturnBusyId(assignment.id);
    setError(null);
    setSuccess(null);

    const now = new Date().toISOString();
    const { error: assignmentError } = await supabase
      .from("vehicle_assignments")
      .update({ return_at: now })
      .eq("company_id", activeCompanyId)
      .eq("id", assignment.id)
      .is("return_at", null);

    if (assignmentError) {
      setError(assignmentError.message);
      setReturnBusyId(null);
      return;
    }

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update({ status: "available" })
      .eq("company_id", activeCompanyId)
      .eq("id", assignment.vehicle_id);

    if (vehicleError) {
      setError(vehicleError.message);
      setReturnBusyId(null);
      return;
    }

    setSuccess("Vehicle return recorded.");
    await loadData();
    setReturnBusyId(null);
  };

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

      {canManageVehicles ? (
        <section className="data-panel two-col">
          <article>
            <header className="data-panel__header">
              <h3>Register Vehicle</h3>
              <p>Fleet setup action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateVehicle();
              }}
            >
              <label>
                Plate Number
                <input
                  value={vehiclePlate}
                  onChange={(event) => setVehiclePlate(event.target.value)}
                  required
                  placeholder="TX-9814"
                />
              </label>
              <label>
                Vehicle Type
                <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
                  <option value="truck">Truck</option>
                  <option value="van">Van</option>
                  <option value="trailer">Trailer</option>
                  <option value="utility">Utility</option>
                </select>
              </label>
              <label>
                Capacity
                <input
                  value={vehicleCapacity}
                  onChange={(event) => setVehicleCapacity(event.target.value)}
                  placeholder="2 tons"
                />
              </label>
              <label>
                Status
                <select value={vehicleStatus} onChange={(event) => setVehicleStatus(event.target.value)}>
                  <option value="available">Available</option>
                  <option value="deployed">Deployed</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
              <button type="submit" disabled={vehicleBusy || !vehiclePlate.trim()}>
                {vehicleBusy ? "Creating..." : "Create Vehicle"}
              </button>
            </form>
          </article>

          <article>
            <header className="data-panel__header">
              <h3>Create Assignment</h3>
              <p>Dispatch action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateAssignment();
              }}
            >
              <label>
                Vehicle
                <select
                  value={assignmentVehicleId}
                  onChange={(event) => setAssignmentVehicleId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select vehicle
                  </option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no} ({vehicle.status})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Site (optional)
                <select value={assignmentSiteId} onChange={(event) => setAssignmentSiteId(event.target.value)}>
                  <option value="">No site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_code} - {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project (optional)
                <select value={assignmentProjectId} onChange={(event) => setAssignmentProjectId(event.target.value)}>
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Driver (optional)
                <select value={assignmentDriverId} onChange={(event) => setAssignmentDriverId(event.target.value)}>
                  <option value="">No driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name || driver.email || driver.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dispatch At (optional)
                <input
                  type="datetime-local"
                  value={assignmentDispatchAt}
                  onChange={(event) => setAssignmentDispatchAt(event.target.value)}
                />
              </label>
              <button type="submit" disabled={assignmentBusy || !assignmentVehicleId}>
                {assignmentBusy ? "Dispatching..." : "Create Assignment"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

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
                {canManageVehicles ? <th>Action</th> : null}
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
                  {canManageVehicles ? (
                    <td className="row-actions">
                      {!row.return_at ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkReturned(row)}
                          disabled={returnBusyId === row.id}
                        >
                          {returnBusyId === row.id ? "Updating..." : "Mark Returned"}
                        </button>
                      ) : (
                        "Done"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {!loading && assignments.length === 0 ? (
                <tr>
                  <td colSpan={canManageVehicles ? 7 : 6} className="table-empty">
                    No vehicle assignments found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {success ? <p className="message message--success">{success}</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
