import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type SiteRecord = {
  id: string;
  name: string;
  site_code: string;
  status: string;
};

type WorkOrderRecord = {
  id: string;
  site_id: string;
  status: string;
};

type DelayRecord = {
  id: string;
  site_id: string;
  severity: string;
  reason: string;
  impact_cost: number;
  start_at: string;
};

type ProjectRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
};

type SiteSnapshotStatus = "on_track" | "at_risk" | "blocked";

type SiteSnapshot = {
  site: SiteRecord;
  openWorkOrders: number;
  openDelays: number;
  criticalDelays: number;
  snapshotStatus: SiteSnapshotStatus;
  nextAction: string;
};

const statusLabel = (value: string) => value.replaceAll("_", " ");

const siteSnapshotLabel: Record<SiteSnapshotStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  blocked: "Blocked",
};

const rankBySnapshot: Record<SiteSnapshotStatus, number> = {
  blocked: 3,
  at_risk: 2,
  on_track: 1,
};

const getSiteSnapshotStatus = (
  site: SiteRecord,
  openWorkOrders: number,
  openDelays: number,
  criticalDelays: number
): SiteSnapshotStatus => {
  const operationalStatus = site.status.toLowerCase();

  if (["blocked", "halted", "paused", "on_hold"].includes(operationalStatus) || criticalDelays > 0) {
    return "blocked";
  }

  if (openDelays > 0 || openWorkOrders >= 4 || operationalStatus === "delayed") {
    return "at_risk";
  }

  return "on_track";
};

const getNextAction = (snapshotStatus: SiteSnapshotStatus, openDelays: number) => {
  if (snapshotStatus === "blocked") return "Escalate immediately and clear critical blocker";
  if (snapshotStatus === "at_risk") {
    if (openDelays > 0) return "Resolve open delays and confirm recovery plan";
    return "Review work order load and rebalance crew capacity";
  }
  return "Continue planned execution and monitor daily";
};

export default function DashboardPage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [openWorkOrders, setOpenWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [openDelays, setOpenDelays] = useState<DelayRecord[]>([]);
  const [pendingEngineerReviews, setPendingEngineerReviews] = useState(0);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const canCreateProjects = useMemo(
    () => roles.some((role: RoleCode) => role === "business_owner_admin" || role === "project_manager"),
    [roles]
  );

  const loadDashboardData = useCallback(async () => {
    if (!supabase || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [sitesRes, workOrdersRes, delaysRes, reviewsRes, projectsRes] = await Promise.all([
      supabase
        .from("sites")
        .select("id,name,site_code,status")
        .eq("company_id", activeCompanyId)
        .order("site_code", { ascending: true })
        .limit(200),
      supabase
        .from("work_orders")
        .select("id,site_id,status")
        .eq("company_id", activeCompanyId)
        .in("status", ["open", "in_progress"])
        .limit(800),
      supabase
        .from("delays")
        .select("id,site_id,severity,reason,impact_cost,start_at")
        .eq("company_id", activeCompanyId)
        .is("resolved_at", null)
        .order("impact_cost", { ascending: false })
        .limit(400),
      supabase
        .from("engineer_reviews")
        .select("id", { count: "exact", head: true })
        .eq("company_id", activeCompanyId)
        .in("review_status", ["pending", "needs_more_evidence"]),
      supabase
        .from("projects")
        .select("id,name,code,status")
        .eq("company_id", activeCompanyId)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    const firstError = [sitesRes.error, workOrdersRes.error, delaysRes.error, reviewsRes.error, projectsRes.error].find(
      Boolean
    );

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setSites((sitesRes.data ?? []) as SiteRecord[]);
    setOpenWorkOrders((workOrdersRes.data ?? []) as WorkOrderRecord[]);
    setOpenDelays((delaysRes.data ?? []) as DelayRecord[]);
    setPendingEngineerReviews(reviewsRes.count ?? 0);
    setProjects((projectsRes.data ?? []) as ProjectRecord[]);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const normalizedProjectCode = useMemo(() => {
    if (projectCode.trim()) return projectCode.trim().toUpperCase();

    const base = projectName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const seed = Date.now().toString().slice(-4);
    return `PRJ-${(base || "AIDA").slice(0, 8)}-${seed}`;
  }, [projectCode, projectName]);

  const workOrdersBySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of openWorkOrders) {
      map.set(row.site_id, (map.get(row.site_id) ?? 0) + 1);
    }
    return map;
  }, [openWorkOrders]);

  const delaysBySite = useMemo(() => {
    const map = new Map<string, { openDelays: number; criticalDelays: number }>();
    for (const row of openDelays) {
      const current = map.get(row.site_id) ?? { openDelays: 0, criticalDelays: 0 };
      current.openDelays += 1;
      if (row.severity === "critical") current.criticalDelays += 1;
      map.set(row.site_id, current);
    }
    return map;
  }, [openDelays]);

  const siteSnapshots = useMemo(() => {
    const rows: SiteSnapshot[] = sites.map((site) => {
      const openWorkOrderCount = workOrdersBySite.get(site.id) ?? 0;
      const delayCounts = delaysBySite.get(site.id) ?? { openDelays: 0, criticalDelays: 0 };
      const snapshotStatus = getSiteSnapshotStatus(
        site,
        openWorkOrderCount,
        delayCounts.openDelays,
        delayCounts.criticalDelays
      );

      return {
        site,
        openWorkOrders: openWorkOrderCount,
        openDelays: delayCounts.openDelays,
        criticalDelays: delayCounts.criticalDelays,
        snapshotStatus,
        nextAction: getNextAction(snapshotStatus, delayCounts.openDelays),
      };
    });

    rows.sort((a, b) => {
      const statusRank = rankBySnapshot[b.snapshotStatus] - rankBySnapshot[a.snapshotStatus];
      if (statusRank !== 0) return statusRank;

      const riskScoreA = a.criticalDelays * 100 + a.openDelays * 10 + a.openWorkOrders;
      const riskScoreB = b.criticalDelays * 100 + b.openDelays * 10 + b.openWorkOrders;
      return riskScoreB - riskScoreA;
    });

    return rows;
  }, [delaysBySite, sites, workOrdersBySite]);

  const blockedSiteCount = useMemo(
    () => siteSnapshots.filter((row) => row.snapshotStatus === "blocked").length,
    [siteSnapshots]
  );
  const atRiskSiteCount = useMemo(
    () => siteSnapshots.filter((row) => row.snapshotStatus === "at_risk").length,
    [siteSnapshots]
  );

  const stats = useMemo(
    () => ({
      activeSites: sites.filter((site) => ["active", "in_progress"].includes(site.status)).length,
      openWorkOrders: openWorkOrders.length,
      unresolvedDelays: openDelays.length,
      pendingEngineerReviews,
    }),
    [openDelays.length, openWorkOrders.length, pendingEngineerReviews, sites]
  );

  const topDelay = openDelays[0] ?? null;
  const highestRiskSite = siteSnapshots[0] ?? null;

  const whereWeAreNowSummary = useMemo(() => {
    if (siteSnapshots.length === 0) {
      return "No sites are set up yet. Create a project and site to start tracking execution.";
    }

    if (blockedSiteCount === 0 && atRiskSiteCount === 0 && stats.unresolvedDelays === 0) {
      return "All tracked sites are currently on track with no open delays.";
    }

    return `${formatNumber(stats.openWorkOrders)} work orders and ${formatNumber(stats.unresolvedDelays)} delays are open. ${formatNumber(blockedSiteCount)} site(s) are blocked and ${formatNumber(atRiskSiteCount)} site(s) are at risk.`;
  }, [atRiskSiteCount, blockedSiteCount, siteSnapshots.length, stats.openWorkOrders, stats.unresolvedDelays]);

  const handleCreateProject = async () => {
    if (!supabase || !activeCompanyId) return;

    setCreateBusy(true);
    setCreateMessage(null);
    setError(null);

    const payload = {
      company_id: activeCompanyId,
      name: projectName.trim(),
      code: normalizedProjectCode,
      status: "planning",
    };

    const { error: insertError } = await supabase.from("projects").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setCreateBusy(false);
      return;
    }

    setProjectName("");
    setProjectCode("");
    setCreateMessage(`Project ${payload.code} created.`);
    await loadDashboardData();
    setCreateBusy(false);
  };

  return (
    <div className="screen-stack">
      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Operations Snapshot</h3>
          <p>{loading ? "Refreshing..." : "Current execution status"}</p>
        </header>
        <div className="snapshot-kpis">
          <article className="snapshot-kpi">
            <p>Active Sites</p>
            <strong>{formatNumber(stats.activeSites)}</strong>
          </article>
          <article className="snapshot-kpi">
            <p>Open Work Orders</p>
            <strong>{formatNumber(stats.openWorkOrders)}</strong>
          </article>
          <article className="snapshot-kpi">
            <p>Open Delays</p>
            <strong>{formatNumber(stats.unresolvedDelays)}</strong>
          </article>
          <article className="snapshot-kpi">
            <p>Pending Engineer Reviews</p>
            <strong>{formatNumber(stats.pendingEngineerReviews)}</strong>
          </article>
        </div>
      </section>

      <section className="data-panel two-col">
        <article className="dashboard-callout">
          <h3>Where We Are Now</h3>
          <p className="dashboard-callout__lead">{whereWeAreNowSummary}</p>
          <ul className="dense-list">
            <li>
              <strong>What is open:</strong> {formatNumber(stats.openWorkOrders)} work orders and{" "}
              {formatNumber(stats.unresolvedDelays)} delays.
            </li>
            <li>
              <strong>What is blocked:</strong> {formatNumber(blockedSiteCount)} blocked site(s).
            </li>
            <li>
              <strong>What needs action now:</strong>{" "}
              {stats.pendingEngineerReviews > 0
                ? `${formatNumber(stats.pendingEngineerReviews)} engineer review(s) are waiting.`
                : "No engineer review backlog right now."}
            </li>
          </ul>
        </article>

        <article className="dashboard-callout">
          <h3>Action Needed</h3>
          <ul className="dense-list">
            <li>
              <strong>Top unresolved delay:</strong>{" "}
              {topDelay
                ? `${topDelay.reason || "Unspecified reason"} (${topDelay.severity}) — ${formatCurrency(topDelay.impact_cost)} impact`
                : "No unresolved delays recorded."}
            </li>
            <li>
              <strong>Highest-risk site:</strong>{" "}
              {highestRiskSite
                ? `${highestRiskSite.site.site_code} (${siteSnapshotLabel[highestRiskSite.snapshotStatus]})`
                : "No sites in dashboard yet."}
            </li>
            <li>
              <strong>Engineer queue:</strong>{" "}
              {stats.pendingEngineerReviews > 0
                ? `${formatNumber(stats.pendingEngineerReviews)} review(s) waiting for response.`
                : "No pending engineer reviews."}
            </li>
          </ul>
        </article>
      </section>

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Site Status</h3>
          <p>{loading ? "Refreshing..." : `${siteSnapshots.length} site(s)`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Operational Status</th>
                <th>Open Work Orders</th>
                <th>Open Delays</th>
                <th>Critical Delays</th>
                <th>Snapshot</th>
                <th>Next Action</th>
              </tr>
            </thead>
            <tbody>
              {siteSnapshots.map((row) => (
                <tr key={row.site.id}>
                  <td>
                    <Link to={`/sites/${row.site.id}`}>{row.site.name}</Link>
                    <div className="muted">{row.site.site_code}</div>
                  </td>
                  <td>
                    <span className="chip">{statusLabel(row.site.status)}</span>
                  </td>
                  <td>{formatNumber(row.openWorkOrders)}</td>
                  <td>{formatNumber(row.openDelays)}</td>
                  <td>{formatNumber(row.criticalDelays)}</td>
                  <td>
                    <span className={`status-chip status-chip--${row.snapshotStatus}`}>
                      {siteSnapshotLabel[row.snapshotStatus]}
                    </span>
                  </td>
                  <td>{row.nextAction}</td>
                </tr>
              ))}
              {!loading && siteSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No sites available yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canCreateProjects ? (
        <section className="data-panel data-panel--subtle">
          <header className="data-panel__header">
            <h3>Quick Add Project</h3>
            <p>Admin / PM action</p>
          </header>
          <form
            className="inline-form inline-form--grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateProject();
            }}
          >
            <label>
              Project Name
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
                placeholder="West Ridge Blade Campaign"
              />
            </label>
            <label>
              Project Code (optional)
              <input
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value)}
                placeholder={normalizedProjectCode}
              />
            </label>
            <button type="submit" disabled={createBusy || !projectName.trim()}>
              {createBusy ? "Creating..." : "Create Project"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Recent Projects</h3>
          <p>{loading ? "Refreshing..." : `${projects.length} shown`}</p>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.code}</td>
                  <td>{project.name}</td>
                  <td>
                    <span className="chip">{statusLabel(project.status)}</span>
                  </td>
                  <td className="row-actions">
                    <Link to={`/projects/${project.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No projects available yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {topDelay ? (
        <p className="message">
          Latest high-impact delay started on {formatDate(topDelay.start_at)} with estimated impact{" "}
          {formatCurrency(topDelay.impact_cost)}.
        </p>
      ) : null}
      {loading ? <p className="message">Refreshing operations snapshot...</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {createMessage ? <p className="message message--success">{createMessage}</p> : null}
      {!activeCompanyId ? <p className="message">No active company selected in your membership context.</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
