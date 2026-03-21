import { useEffect, useMemo, useState } from "react";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatDate, formatNumber } from "@/app/lib/format";
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

type SiteRecord = { id: string; site_code: string; name: string };
type ProjectRecord = { id: string; code: string; name: string };
type WorkOrderRecord = { id: string; wo_number: string };

export default function DelaysPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [sitesById, setSitesById] = useState<Record<string, SiteRecord>>({});
  const [projectsById, setProjectsById] = useState<Record<string, ProjectRecord>>({});
  const [workOrdersById, setWorkOrdersById] = useState<Record<string, WorkOrderRecord>>({});

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const delaysRes = await supabase
        .from("delays")
        .select(
          "id,project_id,site_id,work_order_id,category,severity,reason,start_at,resolved_at,impact_hours,impact_cost"
        )
        .eq("company_id", activeCompanyId)
        .order("start_at", { ascending: false })
        .limit(200);

      if (delaysRes.error) {
        setError(delaysRes.error.message);
        setLoading(false);
        return;
      }

      const nextDelays = (delaysRes.data ?? []) as DelayRecord[];
      setDelays(nextDelays);

      const siteIds = Array.from(new Set(nextDelays.map((row) => row.site_id)));
      const projectIds = Array.from(
        new Set(nextDelays.map((row) => row.project_id).filter((value): value is string => Boolean(value)))
      );
      const workOrderIds = Array.from(
        new Set(nextDelays.map((row) => row.work_order_id).filter((value): value is string => Boolean(value)))
      );

      const [sitesRes, projectsRes, workOrdersRes] = await Promise.all([
        siteIds.length > 0
          ? supabase.from("sites").select("id,site_code,name").eq("company_id", activeCompanyId).in("id", siteIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length > 0
          ? supabase.from("projects").select("id,code,name").eq("company_id", activeCompanyId).in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        workOrderIds.length > 0
          ? supabase.from("work_orders").select("id,wo_number").eq("company_id", activeCompanyId).in("id", workOrderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mapError = [sitesRes.error, projectsRes.error, workOrdersRes.error].find(Boolean);
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

      const workOrderMap: Record<string, WorkOrderRecord> = {};
      for (const row of (workOrdersRes.data ?? []) as WorkOrderRecord[]) workOrderMap[row.id] = row;
      setWorkOrdersById(workOrderMap);

      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

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
                </tr>
              ))}
              {!loading && delays.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty">
                    No delays logged yet.
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
