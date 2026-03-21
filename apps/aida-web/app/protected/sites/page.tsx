import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ScreenFrame } from "@/app/components/screen-frame";
import { useAuth } from "@/app/lib/auth-context";
import { formatDate, formatNumber } from "@/app/lib/format";
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

export default function SitesPage() {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteSummaryRow[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const sitesRes = await supabase
        .from("sites")
        .select("id,name,site_code,status,planned_start,planned_end,project_id")
        .eq("company_id", activeCompanyId)
        .order("planned_start", { ascending: true });

      if (sitesRes.error) {
        setError(sitesRes.error.message);
        setLoading(false);
        return;
      }

      const rows = (sitesRes.data ?? []) as SiteRow[];
      const siteIds = rows.map((site) => site.id);

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

      const firstError = [assignmentsRes.error, vehiclesRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const crewBySite = new Map<string, number>();
      for (const row of assignmentsRes.data ?? []) {
        const siteId = row.site_id as string;
        crewBySite.set(siteId, (crewBySite.get(siteId) ?? 0) + 1);
      }

      const vehiclesBySite = new Map<string, number>();
      for (const row of vehiclesRes.data ?? []) {
        const siteId = row.site_id as string;
        vehiclesBySite.set(siteId, (vehiclesBySite.get(siteId) ?? 0) + 1);
      }

      const enriched = rows.map((site) => {
        const siteSummary: SiteSummaryRow = {
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

        return siteSummary;
      });

      setSites(enriched);
      setLoading(false);
    };

    void run();
  }, [activeCompanyId]);

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

        {error ? <p className="message message--error">{error}</p> : null}
        {!supabase ? <p className="message">Supabase is not configured for this deployment.</p> : null}
      </section>
    </div>
  );
}
