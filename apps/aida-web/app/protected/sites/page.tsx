import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
import type { RoleCode } from "@/app/lib/roles";
import { supabase } from "@/app/lib/supabase";

type SiteRow = {
  id: string;
  name: string;
  site_code: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  project_id: string;
};

type SiteSummaryRow = SiteRow & {
  crewCount: number;
  activeVehicles: number;
};

type ProjectOption = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export default function SitesPage() {
  const { activeCompanyId, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteSummaryRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [siteProjectId, setSiteProjectId] = useState("");
  const [siteStatus, setSiteStatus] = useState("planned");
  const [sitePlannedStart, setSitePlannedStart] = useState("");
  const [sitePlannedEnd, setSitePlannedEnd] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const canCreateSites = useMemo(
    () => roles.some((role: RoleCode) => role === "business_owner_admin" || role === "project_manager"),
    [roles]
  );

  const loadData = useCallback(async () => {
    if (!supabase || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [sitesRes, projectsRes] = await Promise.all([
      supabase
        .from("sites")
        .select("id,name,site_code,status,planned_start,planned_end,project_id")
        .eq("company_id", activeCompanyId)
        .order("planned_start", { ascending: true }),
      supabase
        .from("projects")
        .select("id,code,name,status")
        .eq("company_id", activeCompanyId)
        .order("updated_at", { ascending: false }),
    ]);

    const rootError = [sitesRes.error, projectsRes.error].find(Boolean);
    if (rootError) {
      setError(rootError.message);
      setLoading(false);
      return;
    }

    const projectRows = (projectsRes.data ?? []) as ProjectOption[];
    const siteRows = (sitesRes.data ?? []) as SiteRow[];
    setProjects(projectRows);

    if (!siteProjectId && projectRows[0]) {
      setSiteProjectId(projectRows[0].id);
    }

    const siteIds = siteRows.map((site) => site.id);
    if (siteIds.length === 0) {
      setSites([]);
      setLoading(false);
      return;
    }

    const [assignmentsRes, vehiclesRes] = await Promise.all([
      supabase
        .from("site_assignments")
        .select("site_id")
        .eq("company_id", activeCompanyId)
        .eq("is_active", true)
        .in("site_id", siteIds),
      supabase
        .from("vehicle_assignments")
        .select("site_id")
        .eq("company_id", activeCompanyId)
        .is("return_at", null)
        .in("site_id", siteIds),
    ]);

    const secondError = [assignmentsRes.error, vehiclesRes.error].find(Boolean);
    if (secondError) {
      setError(secondError.message);
      setLoading(false);
      return;
    }

    const crewBySite = new Map<string, number>();
    for (const row of assignmentsRes.data ?? []) {
      const id = row.site_id as string;
      crewBySite.set(id, (crewBySite.get(id) ?? 0) + 1);
    }

    const vehiclesBySite = new Map<string, number>();
    for (const row of vehiclesRes.data ?? []) {
      const id = row.site_id as string;
      vehiclesBySite.set(id, (vehiclesBySite.get(id) ?? 0) + 1);
    }

    const enriched = siteRows.map((site) => {
      const summary: SiteSummaryRow = {
        id: site.id,
        name: site.name,
        site_code: site.site_code,
        status: site.status,
        planned_start: site.planned_start,
        planned_end: site.planned_end,
        project_id: site.project_id,
        crewCount: crewBySite.get(site.id) ?? 0,
        activeVehicles: vehiclesBySite.get(site.id) ?? 0,
      };

      return summary;
    });

    setSites(enriched);
    setLoading(false);
  }, [activeCompanyId, siteProjectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const computedSiteCode = useMemo(() => {
    if (siteCode.trim()) return siteCode.trim().toUpperCase();

    const base = siteName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `SITE-${(base || "NEW").slice(0, 8)}-${Date.now().toString().slice(-3)}`;
  }, [siteCode, siteName]);

  const highlights = useMemo(
    () => [
      { label: "Total Sites", value: formatNumber(sites.length) },
      {
        label: "Sites In Progress",
        value: formatNumber(sites.filter((site) => ["active", "in_progress"].includes(site.status)).length),
      },
      { label: "Crew On Site", value: formatNumber(sites.reduce((sum, site) => sum + site.crewCount, 0)) },
      {
        label: "Vehicles Deployed",
        value: formatNumber(sites.reduce((sum, site) => sum + site.activeVehicles, 0)),
      },
    ],
    [sites]
  );

  const handleCreateSite = async () => {
    if (!supabase || !activeCompanyId) return;

    setCreateBusy(true);
    setCreateMessage(null);
    setError(null);

    const payload = {
      company_id: activeCompanyId,
      project_id: siteProjectId,
      name: siteName.trim(),
      site_code: computedSiteCode,
      status: siteStatus,
      planned_start: sitePlannedStart || null,
      planned_end: sitePlannedEnd || null,
      location: {},
    };

    const { error: insertError } = await supabase.from("sites").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setCreateBusy(false);
      return;
    }

    setSiteName("");
    setSiteCode("");
    setSitePlannedStart("");
    setSitePlannedEnd("");
    setSiteStatus("planned");
    setCreateMessage(`Site ${payload.site_code} created successfully.`);
    await loadData();
    setCreateBusy(false);
  };

  return (
    <div className="screen-stack">
      <ScreenFrame
        title="Sites Portfolio"
        description="Live portfolio of wind farm operations, schedules, staffing, and site logistics."
        highlights={highlights}
        panels={[
          {
            title: "Operational Focus",
            items: [
              "Company-specific site visibility with assignment-aware access",
              "Crew and vehicle coverage shown per site",
              "Direct drill-down to project, turbine, and work-order execution",
            ],
          },
          {
            title: "AIDA Control Actions",
            items: [
              "Open site detail and evidence history",
              "Check active work and staffing load",
              "Track planned schedule windows and status drift",
            ],
          },
        ]}
        actions={["Open site detail", "Open project detail", "Review work order activity"]}
      />

      {canCreateSites ? (
        <section className="data-panel">
          <header className="data-panel__header">
            <h3>Create Site</h3>
            <p>Admin / PM action</p>
          </header>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateSite();
            }}
          >
            <label>
              Site Name
              <input
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                required
                placeholder="South Plains Farm - Segment A"
              />
            </label>
            <label>
              Site Code (optional)
              <input
                value={siteCode}
                onChange={(event) => setSiteCode(event.target.value)}
                placeholder={computedSiteCode}
              />
            </label>
            <label>
              Project
              <select value={siteProjectId} onChange={(event) => setSiteProjectId(event.target.value)} required>
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={siteStatus} onChange={(event) => setSiteStatus(event.target.value)}>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="in_progress">In Progress</option>
              </select>
            </label>
            <label>
              Planned Start
              <input
                type="date"
                value={sitePlannedStart}
                onChange={(event) => setSitePlannedStart(event.target.value)}
              />
            </label>
            <label>
              Planned End
              <input type="date" value={sitePlannedEnd} onChange={(event) => setSitePlannedEnd(event.target.value)} />
            </label>
            <button type="submit" disabled={createBusy || !siteName.trim() || !siteProjectId}>
              {createBusy ? "Creating..." : "Create Site"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="data-panel">
        <header className="data-panel__header">
          <h3>Live Sites</h3>
          <p>{loading ? "Refreshing site portfolio..." : `${sites.length} site(s) found`}</p>
        </header>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
                <th>Planned Start</th>
                <th>Planned End</th>
                <th>Crew</th>
                <th>Vehicles</th>
                <th>Actions</th>
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
                  <td>{formatDate(site.planned_start)}</td>
                  <td>{formatDate(site.planned_end)}</td>
                  <td>{formatNumber(site.crewCount)}</td>
                  <td>{formatNumber(site.activeVehicles)}</td>
                  <td className="row-actions">
                    <Link to={`/sites/${site.id}`}>Site</Link>
                    <Link to={`/projects/${site.project_id}`}>Project</Link>
                  </td>
                </tr>
              ))}
              {!loading && sites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No sites available for this company yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {createMessage ? <p className="message message--success">{createMessage}</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}
        {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
      </section>
    </div>
  );
}
