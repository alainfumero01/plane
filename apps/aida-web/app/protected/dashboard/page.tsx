import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatCurrency, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type DashboardStats = {
  activeSites: number;
  openWorkOrders: number;
  unresolvedDelays: number;
  pendingEngineerReviews: number;
};

type SiteRecord = {
  id: string;
  name: string;
  site_code: string;
  status: string;
};

type DelayRecord = {
  reason: string;
  severity: string;
  impact_cost: number;
  impact_hours: number;
};

type ProjectRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const defaultStats: DashboardStats = {
  activeSites: 0,
  openWorkOrders: 0,
  unresolvedDelays: 0,
  pendingEngineerReviews: 0,
};

export default function DashboardPage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [activeSite, setActiveSite] = useState<SiteRecord | null>(null);
  const [topDelay, setTopDelay] = useState<DelayRecord | null>(null);
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

    const [sitesRes, workOrdersRes, delaysRes, reviewsRes, activeSiteRes, topDelayRes, projectsRes] = await Promise.all(
      [
        supabase
          .from("sites")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("status", ["active", "in_progress", "planned"]),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("status", ["open", "in_progress"]),
        supabase
          .from("delays")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .is("resolved_at", null),
        supabase
          .from("engineer_reviews")
          .select("id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .in("review_status", ["pending", "needs_more_evidence"]),
        supabase
          .from("sites")
          .select("id,name,site_code,status")
          .eq("company_id", activeCompanyId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<SiteRecord>(),
        supabase
          .from("delays")
          .select("reason,severity,impact_cost,impact_hours")
          .eq("company_id", activeCompanyId)
          .is("resolved_at", null)
          .order("impact_cost", { ascending: false })
          .limit(1)
          .maybeSingle<DelayRecord>(),
        supabase
          .from("projects")
          .select("id,name,code,status,start_date,end_date")
          .eq("company_id", activeCompanyId)
          .order("updated_at", { ascending: false })
          .limit(10),
      ]
    );

    const firstError = [
      sitesRes.error,
      workOrdersRes.error,
      delaysRes.error,
      reviewsRes.error,
      activeSiteRes.error,
      topDelayRes.error,
      projectsRes.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setStats({
      activeSites: sitesRes.count ?? 0,
      openWorkOrders: workOrdersRes.count ?? 0,
      unresolvedDelays: delaysRes.count ?? 0,
      pendingEngineerReviews: reviewsRes.count ?? 0,
    });
    setActiveSite(activeSiteRes.data ?? null);
    setTopDelay(topDelayRes.data ?? null);
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
    setCreateMessage(`Project ${payload.code} created successfully.`);
    await loadDashboardData();
    setCreateBusy(false);
  };

  const highlights = useMemo(
    () => [
      { label: "Active Sites", value: formatNumber(stats.activeSites) },
      { label: "Open Work Orders", value: formatNumber(stats.openWorkOrders) },
      { label: "Unresolved Delays", value: formatNumber(stats.unresolvedDelays) },
      { label: "Pending Engineer Reviews", value: formatNumber(stats.pendingEngineerReviews) },
    ],
    [stats]
  );

  const panels = useMemo(
    () => [
      {
        title: "Live Site Operations",
        items: [
          activeSite
            ? `${activeSite.name} (${activeSite.site_code}) is ${activeSite.status.replace("_", " ")}.`
            : "No active site found for this company.",
          `Company has ${formatNumber(stats.openWorkOrders)} open/in-progress work orders.`,
          `Engineer queue contains ${formatNumber(stats.pendingEngineerReviews)} pending reviews.`,
        ],
      },
      {
        title: "Risk and Cost Pulse",
        items: [
          topDelay
            ? `Top delay: ${topDelay.reason || "Unspecified"} (${topDelay.severity})`
            : "No unresolved delays currently logged.",
          topDelay
            ? `Highest delay cost impact: ${formatCurrency(topDelay.impact_cost)}`
            : "Delay cost impact is currently clear.",
          topDelay
            ? `Estimated hours lost: ${formatNumber(topDelay.impact_hours)}`
            : "No current delay-hour loss recorded.",
        ],
      },
    ],
    [activeSite, stats.openWorkOrders, stats.pendingEngineerReviews, topDelay]
  );

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Operational Dashboard"
        description="Company-wide control tower for active wind repair programs, delay risks, and engineering review queues."
        highlights={highlights}
        panels={panels}
        actions={["Open active site details", "Escalate unresolved delays", "Route pending questions to engineers"]}
      />

      {canCreateProjects ? (
        <section className="data-panel">
          <header className="data-panel__header">
            <h3>Create Project</h3>
            <p>Admin / PM action</p>
          </header>
          <form
            className="inline-form"
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
                    <span className="chip">{project.status.replace("_", " ")}</span>
                  </td>
                  <td className="row-actions">
                    <Link to={`/projects/${project.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No projects yet. Create the first project above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {loading ? <p className="message">Loading live operations data...</p> : null}
      {error ? <p className="message message--error">{error}</p> : null}
      {createMessage ? <p className="message message--success">{createMessage}</p> : null}
      {!activeCompanyId ? <p className="message">No active company selected in your membership context.</p> : null}
      {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
    </div>
  );
}
