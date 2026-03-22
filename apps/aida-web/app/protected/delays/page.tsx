import { useCallback, useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type DelayRecord = {
  id: string;
  project_id: string | null;
  site_id: string;
  work_order_id: string | null;
  category: string;
  severity: string;
  reason: string;
  start_at: string;
  resolved_at: string | null;
  impact_hours: number;
  impact_cost: number;
};

type SiteRecord = { id: string; site_code: string; name: string; project_id: string };
type ProjectRecord = { id: string; code: string; name: string };
type WorkOrderRecord = { id: string; wo_number: string; project_id: string; site_id: string };

export default function DelaysPage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [projectsById, setProjectsById] = useState<Record<string, ProjectRecord>>({});
  const [workOrdersById, setWorkOrdersById] = useState<Record<string, WorkOrderRecord>>({});

  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);

  const [delaySiteId, setDelaySiteId] = useState("");
  const [delayProjectId, setDelayProjectId] = useState("");
  const [delayWorkOrderId, setDelayWorkOrderId] = useState("");
  const [delayCategory, setDelayCategory] = useState("weather");
  const [delaySeverity, setDelaySeverity] = useState("medium");
  const [delayReason, setDelayReason] = useState("");
  const [delayHours, setDelayHours] = useState("0");
  const [delayCost, setDelayCost] = useState("0");
  const [createBusy, setCreateBusy] = useState(false);
  const [resolveBusyId, setResolveBusyId] = useState<string | null>(null);

  const canManageDelays = useMemo(
    () =>
      roles.some(
        (role: RoleCode) => role === "business_owner_admin" || role === "project_manager" || role === "site_operator"
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

    const [delaysRes, sitesRes, projectsRes, workOrdersRes] = await Promise.all([
      supabase
        .from("delays")
        .select(
          "id,project_id,site_id,work_order_id,category,severity,reason,start_at,resolved_at,impact_hours,impact_cost"
        )
        .eq("company_id", activeCompanyId)
        .order("start_at", { ascending: false })
        .limit(200),
      supabase
        .from("sites")
        .select("id,site_code,name,project_id")
        .eq("company_id", activeCompanyId)
        .order("site_code", { ascending: true }),
      supabase
        .from("projects")
        .select("id,code,name")
        .eq("company_id", activeCompanyId)
        .order("code", { ascending: true }),
      supabase
        .from("work_orders")
        .select("id,wo_number,project_id,site_id")
        .eq("company_id", activeCompanyId)
        .order("wo_number", { ascending: true }),
    ]);

    const firstError = [delaysRes.error, sitesRes.error, projectsRes.error, workOrdersRes.error].find(Boolean);
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextDelays = (delaysRes.data ?? []) as DelayRecord[];
    const nextSites = (sitesRes.data ?? []) as SiteRecord[];
    const nextProjects = (projectsRes.data ?? []) as ProjectRecord[];
    const nextWorkOrders = (workOrdersRes.data ?? []) as WorkOrderRecord[];

    setDelays(nextDelays);
    setSites(nextSites);
    setProjects(nextProjects);
    setWorkOrders(nextWorkOrders);

    const siteMap: Record<string, SiteRecord> = {};
    for (const row of nextSites) siteMap[row.id] = row;
    setSitesById(siteMap);

    const projectMap: Record<string, ProjectRecord> = {};
    for (const row of nextProjects) projectMap[row.id] = row;
    setProjectsById(projectMap);

    const workOrderMap: Record<string, WorkOrderRecord> = {};
    for (const row of nextWorkOrders) workOrderMap[row.id] = row;
    setWorkOrdersById(workOrderMap);

    if (!delaySiteId && nextSites[0]) {
      setDelaySiteId(nextSites[0].id);
      setDelayProjectId(nextSites[0].project_id);
    }

    setLoading(false);
  }, [activeCompanyId, delaySiteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleWorkOrders = useMemo(() => {
    if (!delaySiteId) return workOrders;
    return workOrders.filter((row) => row.site_id === delaySiteId);
  }, [delaySiteId, workOrders]);

  const openDelays = delays.filter((row) => !row.resolved_at);
  const criticalDelays = openDelays.filter((row) => row.severity === "critical").length;
  const impactHours = openDelays.reduce((sum, row) => sum + Number(row.impact_hours ?? 0), 0);
  const impactCost = openDelays.reduce((sum, row) => sum + Number(row.impact_cost ?? 0), 0);
  const delayBySeverity = useMemo(() => {
    const map = new Map<string, number>();
    for (const delay of openDelays) {
      map.set(delay.severity, (map.get(delay.severity) ?? 0) + 1);
    }
    return map;
  }, [openDelays]);

  const handleCreateDelay = async () => {
    if (!supabase || !activeCompanyId || !delayReason.trim()) return;

    const selectedWorkOrder = delayWorkOrderId ? workOrdersById[delayWorkOrderId] : null;
    const selectedSiteId = selectedWorkOrder?.site_id ?? delaySiteId;
    const selectedProjectId = selectedWorkOrder?.project_id ?? (delayProjectId || null);

    if (!selectedSiteId) {
      setError("Select a site before creating a delay.");
      return;
    }

    setCreateBusy(true);
    setSuccess(null);
    setError(null);

    const payload = {
      company_id: activeCompanyId,
      site_id: selectedSiteId,
      project_id: selectedProjectId,
      work_order_id: selectedWorkOrder?.id ?? null,
      category: delayCategory,
      severity: delaySeverity,
      reason: delayReason.trim(),
      impact_hours: Number(delayHours || 0),
      impact_cost: Number(delayCost || 0),
    };

    const { error: insertError } = await supabase.from("delays").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setCreateBusy(false);
      return;
    }

    setDelayWorkOrderId("");
    setDelayReason("");
    setDelayHours("0");
    setDelayCost("0");
    setDelaySeverity("medium");
    setDelayCategory("weather");
    setSuccess("Delay entry created.");
    await loadData();
    setCreateBusy(false);
  };

  const handleResolveDelay = async (delayId: string) => {
    if (!supabase || !activeCompanyId) return;

    setResolveBusyId(delayId);
    setSuccess(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("delays")
      .update({
        resolved_at: new Date().toISOString(),
      })
      .eq("company_id", activeCompanyId)
      .eq("id", delayId)
      .is("resolved_at", null);

    if (updateError) {
      setError(updateError.message);
      setResolveBusyId(null);
      return;
    }

    setSuccess("Delay marked as resolved.");
    await loadData();
    setResolveBusyId(null);
  };

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Delay Log"
        description="Delay capture with hours/cost impact tracking and escalation visibility for PM and leadership teams."
        highlights={[
          { label: "Open Delays", value: formatNumber(openDelays.length) },
          { label: "Critical Delays", value: formatNumber(criticalDelays) },
          { label: "Total Impact Hours", value: formatNumber(impactHours) },
          { label: "Impact Cost", value: formatCurrency(impactCost) },
        ]}
        panels={[
          {
            title: "Active Delay Events",
            items: [
              `${formatNumber(delayBySeverity.get("critical") ?? 0)} critical delay event(s)`,
              `${formatNumber(delayBySeverity.get("high") ?? 0)} high severity event(s)`,
              `${formatNumber(delayBySeverity.get("medium") ?? 0)} medium severity event(s)`,
            ],
          },
          {
            title: "Escalation Readiness",
            items: [
              "Every delay contains category, reason, and impact fields",
              "Open events remain visible until a resolution timestamp is set",
              "Cost impact rolls up into project risk and reporting views",
            ],
          },
        ]}
        actions={["Create new delay entry", "Update resolution timeline", "Escalate to upper management"]}
      />

      {canManageDelays ? (
        <section className="data-panel two-col">
          <article>
            <header className="data-panel__header">
              <h3>Create Delay Entry</h3>
              <p>PM / Operator action</p>
            </header>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateDelay();
              }}
            >
              <label>
                Site
                <select
                  value={delaySiteId}
                  onChange={(event) => {
                    const siteId = event.target.value;
                    setDelaySiteId(siteId);
                    setDelayWorkOrderId("");
                    const linkedProjectId = sitesById[siteId]?.project_id ?? "";
                    setDelayProjectId(linkedProjectId);
                  }}
                  required
                >
                  <option value="" disabled>
                    Select site
                  </option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_code} - {site.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Project
                <select value={delayProjectId} onChange={(event) => setDelayProjectId(event.target.value)}>
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Work Order (optional)
                <select value={delayWorkOrderId} onChange={(event) => setDelayWorkOrderId(event.target.value)}>
                  <option value="">No linked work order</option>
                  {visibleWorkOrders.map((workOrder) => (
                    <option key={workOrder.id} value={workOrder.id}>
                      {workOrder.wo_number}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Category
                <select value={delayCategory} onChange={(event) => setDelayCategory(event.target.value)}>
                  <option value="weather">Weather</option>
                  <option value="material">Material</option>
                  <option value="equipment">Equipment</option>
                  <option value="staffing">Staffing</option>
                  <option value="qa">QA</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Severity
                <select value={delaySeverity} onChange={(event) => setDelaySeverity(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label>
                Reason
                <textarea
                  value={delayReason}
                  onChange={(event) => setDelayReason(event.target.value)}
                  required
                  placeholder="Crew weather stand-down due to unsafe wind conditions"
                />
              </label>

              <label>
                Impact Hours
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={delayHours}
                  onChange={(event) => setDelayHours(event.target.value)}
                />
              </label>

              <label>
                Impact Cost
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={delayCost}
                  onChange={(event) => setDelayCost(event.target.value)}
                />
              </label>

              <button type="submit" disabled={createBusy || !delaySiteId || !delayReason.trim()}>
                {createBusy ? "Creating..." : "Create Delay"}
              </button>
            </form>
          </article>

          <article>
            <header className="data-panel__header">
              <h3>Resolve Open Delays</h3>
              <p>{`${openDelays.length} open`}</p>
            </header>
            <ul className="dense-list">
              {openDelays.map((delay) => (
                <li key={delay.id}>
                  <strong>{delay.severity.toUpperCase()}</strong> {delay.reason || "No reason"} (
                  {sitesById[delay.site_id]?.site_code ?? "Site"})
                  <button
                    type="button"
                    onClick={() => void handleResolveDelay(delay.id)}
                    disabled={resolveBusyId === delay.id}
                  >
                    {resolveBusyId === delay.id ? "Resolving..." : "Mark Resolved"}
                  </button>
                </li>
              ))}
              {!loading && openDelays.length === 0 ? <li>No open delays.</li> : null}
            </ul>
          </article>
        </section>
      ) : null}

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Delay Register</h3>
          <p>{loading ? "Refreshing..." : `${delays.length} delay event(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Site</th>
                <th>Project</th>
                <th>Work Order</th>
                <th>Impact (Hrs)</th>
                <th>Impact (Cost)</th>
                <th>Start</th>
                <th>Reason</th>
                <th>Resolved</th>
                {canManageDelays ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {delays.map((delay) => (
                <tr key={delay.id}>
                  <td>{delay.resolved_at ? "Resolved" : "Open"}</td>
                  <td>
                    <span className="chip">{delay.severity}</span>
                  </td>
                  <td>{delay.category}</td>
                  <td>{sitesById[delay.site_id]?.site_code ?? delay.site_id}</td>
                  <td>{delay.project_id ? (projectsById[delay.project_id]?.code ?? delay.project_id) : "-"}</td>
                  <td>
                    {delay.work_order_id
                      ? (workOrdersById[delay.work_order_id]?.wo_number ?? delay.work_order_id)
                      : "-"}
                  </td>
                  <td>{formatNumber(delay.impact_hours)}</td>
                  <td>{formatCurrency(delay.impact_cost)}</td>
                  <td>{formatDate(delay.start_at)}</td>
                  <td>{delay.reason || "-"}</td>
                  <td>{delay.resolved_at ? formatDate(delay.resolved_at) : "Open"}</td>
                  {canManageDelays ? (
                    <td className="row-actions">
                      {!delay.resolved_at ? (
                        <button
                          type="button"
                          onClick={() => void handleResolveDelay(delay.id)}
                          disabled={resolveBusyId === delay.id}
                        >
                          {resolveBusyId === delay.id ? "Resolving..." : "Resolve"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {!loading && delays.length === 0 ? (
                <tr>
                  <td colSpan={canManageDelays ? 12 : 11} className="table-empty">
                    No delays logged yet.
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
