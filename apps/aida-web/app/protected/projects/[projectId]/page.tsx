import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatDate, formatNumber } from "@/app/lib/format";
import { supabase } from "@/app/lib/supabase";

type ProjectRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type SiteRecord = {
  id: string;
  name: string;
  site_code: string;
  status: string;
  planned_end: string | null;
};

type DelayRecord = {
  id: string;
  severity: string;
  impact_hours: number;
  impact_cost: number;
  reason: string;
  resolved_at: string | null;
};

type ProfitProjection = {
  projected_revenue: number;
  projected_cost: number;
  projected_profit: number;
  as_of_date: string;
};

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [profit, setProfit] = useState<ProfitProjection | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId || !projectId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [projectRes, sitesRes, delaysRes, profitRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id,name,code,status,start_date,end_date")
          .eq("company_id", activeCompanyId)
          .eq("id", projectId)
          .maybeSingle<ProjectRecord>(),
        supabase
          .from("sites")
          .select("id,name,site_code,status,planned_end")
          .eq("company_id", activeCompanyId)
          .eq("project_id", projectId)
          .order("planned_end", { ascending: true }),
        supabase
          .from("delays")
          .select("id,severity,impact_hours,impact_cost,reason,resolved_at")
          .eq("company_id", activeCompanyId)
          .eq("project_id", projectId)
          .order("start_at", { ascending: false }),
        supabase
          .from("project_profit_projections")
          .select("projected_revenue,projected_cost,projected_profit,as_of_date")
          .eq("company_id", activeCompanyId)
          .eq("project_id", projectId)
          .order("as_of_date", { ascending: false })
          .limit(1)
          .maybeSingle<ProfitProjection>(),
      ]);

      const firstError = [projectRes.error, sitesRes.error, delaysRes.error, profitRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setProject(projectRes.data ?? null);
      setSites((sitesRes.data ?? []) as SiteRecord[]);
      setDelays((delaysRes.data ?? []) as DelayRecord[]);
      setProfit(profitRes.data ?? null);
      setLoading(false);
    };

    void run();
  }, [activeCompanyId, projectId]);

  const activeDelayCount = delays.filter((delay) => !delay.resolved_at).length;

  const highlights = useMemo(
    () => [
      { label: "Planned Start", value: formatDate(project?.start_date) },
      { label: "Planned End", value: formatDate(project?.end_date) },
      { label: "Projected Revenue", value: formatCurrency(profit?.projected_revenue) },
      { label: "Projected Profit", value: formatCurrency(profit?.projected_profit) },
    ],
    [profit?.projected_profit, profit?.projected_revenue, project?.end_date, project?.start_date]
  );

  return (
    <div className="screen-stack">
      <ScreenFrame
        title={`Project Detail: ${project?.name ?? projectId ?? "unknown-project"}`}
        description="Live planning, delay, and financial visibility for the selected repair project."
        highlights={highlights}
        panels={[
          {
            title: "Execution Snapshot",
            items: [
              `Project status: ${project?.status.replace("_", " ") ?? "-"}`,
              `${formatNumber(sites.length)} linked site(s) in this project`,
              `${formatNumber(activeDelayCount)} unresolved delay event(s)`,
            ],
          },
          {
            title: "Cost and Risk",
            items: [
              `Projected cost baseline: ${formatCurrency(profit?.projected_cost)}`,
              `Total delay cost impact: ${formatCurrency(delays.reduce((sum, delay) => sum + Number(delay.impact_cost ?? 0), 0))}`,
              `Total delay hours impact: ${formatNumber(delays.reduce((sum, delay) => sum + Number(delay.impact_hours ?? 0), 0))}`,
            ],
          },
        ]}
        actions={["Open linked site", "Open active work order", "Review delay drivers"]}
      />

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Project Sites</h3>
          <p>{loading ? "Refreshing..." : `${sites.length} linked site(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
                <th>Planned End</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <strong>{site.name}</strong>
                    <div className="muted">{site.site_code}</div>
                  </td>
                  <td>
                    <span className="chip">{site.status.replace("_", " ")}</span>
                  </td>
                  <td>{formatDate(site.planned_end)}</td>
                  <td className="row-actions">
                    <Link to={`/sites/${site.id}`}>Open site</Link>
                  </td>
                </tr>
              ))}
              {!loading && sites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No sites found for this project.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Delay Log</h3>
          <p>{`${delays.length} recorded`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Reason</th>
                <th>Impact Hours</th>
                <th>Impact Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {delays.map((delay) => (
                <tr key={delay.id}>
                  <td>{delay.severity}</td>
                  <td>{delay.reason || "-"}</td>
                  <td>{formatNumber(delay.impact_hours)}</td>
                  <td>{formatCurrency(delay.impact_cost)}</td>
                  <td>{delay.resolved_at ? "Resolved" : "Open"}</td>
                </tr>
              ))}
              {!loading && delays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No delays logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="message message--error">{error}</p> : null}
      {!project && !loading ? <p className="message">Project not found or not accessible.</p> : null}
    </div>
  );
}
